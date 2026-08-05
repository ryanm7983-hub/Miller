'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission, type TenantContext } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { recordAudit } from '@/lib/audit-log';
import { notify } from '@/lib/notifications';
import { ai, recordAssessment } from '@/lib/ai';
import { syncProjectGaps } from '@/lib/gaps';
import { recomputeProjectScores } from '@/lib/scoring';
import { consume, LIMITS } from '@/lib/rate-limit';
import { ACTION_STATUSES, SEVERITIES, type Severity } from '@/lib/enums';
import { toFormError } from '@/lib/errors';

export interface ActionFormState {
  error?: string;
  success?: string;
  suggestion?: {
    title: string;
    description: string;
    priority: string;
    dueInDays: number;
    ownerRole: string;
  };
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T17:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Sequential, human-readable reference per organization: CA-0001. */
async function nextReference(orgId: string): Promise<string> {
  const count = await prisma.action.count({ where: { orgId } });
  return `CA-${String(count + 1).padStart(4, '0')}`;
}

const createSchema = z.object({
  projectId: z.string().min(1, 'Choose an audit project.'),
  gapId: z.string().trim().optional(),
  title: z.string().trim().min(3, 'Give the action a clear title.').max(160),
  description: z.string().trim().max(6000).optional(),
  ownerUserId: z.string().trim().optional(),
  department: z.string().trim().max(80).optional(),
  dueDate: z.string().trim().optional(),
  priority: z.enum(SEVERITIES),
});

export async function createActionAction(
  _prev: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  let created: { id: string } | null = null;

  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'action:create');

    const parsed = createSchema.safeParse({
      projectId: formData.get('projectId'),
      gapId: formData.get('gapId') || undefined,
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      ownerUserId: formData.get('ownerUserId') || undefined,
      department: formData.get('department') || undefined,
      dueDate: formData.get('dueDate') || undefined,
      priority: formData.get('priority') || 'MEDIUM',
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
    }

    const project = await prisma.auditProject.findFirst({
      where: { id: parsed.data.projectId, orgId: tenant.orgId },
      select: { id: true },
    });
    if (!project) return { error: 'That audit project could not be found.' };

    if (parsed.data.gapId) {
      const gap = await prisma.gap.findFirst({
        where: { id: parsed.data.gapId, orgId: tenant.orgId, projectId: project.id },
        select: { id: true },
      });
      if (!gap) return { error: 'That gap could not be found on this project.' };
    }

    if (parsed.data.ownerUserId) {
      const member = await prisma.membership.findFirst({
        where: { orgId: tenant.orgId, userId: parsed.data.ownerUserId, status: 'ACTIVE' },
      });
      if (!member) return { error: 'That person is not an active member of this organization.' };
    }

    const action = await prisma.action.create({
      data: {
        orgId: tenant.orgId,
        projectId: project.id,
        gapId: parsed.data.gapId || null,
        reference: await nextReference(tenant.orgId),
        title: parsed.data.title,
        description: parsed.data.description || null,
        ownerUserId: parsed.data.ownerUserId || null,
        department: parsed.data.department || null,
        dueDate: parseDate(parsed.data.dueDate),
        priority: parsed.data.priority,
        status: 'OPEN',
        source: String(formData.get('source') ?? '') === 'AI' ? 'AI' : 'HUMAN',
        createdById: tenant.user.id,
      },
    });

    // A gap with an action attached is being worked on.
    if (parsed.data.gapId) {
      await prisma.gap.updateMany({
        where: { id: parsed.data.gapId, orgId: tenant.orgId, status: 'OPEN' },
        data: { status: 'IN_PROGRESS' },
      });
    }

    if (action.ownerUserId && action.ownerUserId !== tenant.user.id) {
      await notify({
        orgId: tenant.orgId,
        userId: action.ownerUserId,
        type: 'ACTION_ASSIGNED',
        title: `${action.reference}: ${action.title}`,
        body: `${tenant.user.name} assigned this action to you${action.dueDate ? `, due ${action.dueDate.toISOString().slice(0, 10)}` : ''}.`,
        link: `/app/actions/${action.id}`,
        alsoEmail: true,
      });
    }

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'action.created',
      entityType: 'Action',
      entityId: action.id,
      metadata: { reference: action.reference, priority: action.priority, fromGap: !!parsed.data.gapId },
    });

    await recomputeProjectScores(tenant.orgId, project.id);
    created = { id: action.id };
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath('/app', 'layout');
  redirect(`/app/actions/${created.id}`);
}

const updateSchema = z.object({
  actionId: z.string().min(1),
  title: z.string().trim().min(3, 'Give the action a clear title.').max(160),
  description: z.string().trim().max(6000).optional(),
  ownerUserId: z.string().trim().optional(),
  department: z.string().trim().max(80).optional(),
  dueDate: z.string().trim().optional(),
  priority: z.enum(SEVERITIES),
  status: z.enum(ACTION_STATUSES),
});

export async function updateActionAction(
  _prev: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  try {
    const tenant = await requireTenantStrict();

    const parsed = updateSchema.safeParse({
      actionId: formData.get('actionId'),
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      ownerUserId: formData.get('ownerUserId') || undefined,
      department: formData.get('department') || undefined,
      dueDate: formData.get('dueDate') || undefined,
      priority: formData.get('priority') || 'MEDIUM',
      status: formData.get('status') || 'OPEN',
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
    }

    const existing = await prisma.action.findFirst({
      where: { id: parsed.data.actionId, orgId: tenant.orgId },
    });
    if (!existing) return { error: 'That action could not be found.' };

    assertActionPermission(tenant, existing, parsed.data.status);

    const nowComplete = parsed.data.status === 'COMPLETE' || parsed.data.status === 'VERIFIED';
    const verified = parsed.data.status === 'VERIFIED';

    await prisma.action.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        ownerUserId: parsed.data.ownerUserId || null,
        department: parsed.data.department || null,
        dueDate: parseDate(parsed.data.dueDate),
        priority: parsed.data.priority,
        status: parsed.data.status,
        completedAt: nowComplete ? (existing.completedAt ?? new Date()) : null,
        verifiedById: verified ? tenant.user.id : null,
        verifiedAt: verified ? (existing.verifiedAt ?? new Date()) : null,
      },
    });

    // Resolve the originating gap when the action is verified.
    if (verified && existing.gapId) {
      await prisma.gap.updateMany({
        where: { id: existing.gapId, orgId: tenant.orgId },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }

    if (parsed.data.ownerUserId && parsed.data.ownerUserId !== existing.ownerUserId) {
      await notify({
        orgId: tenant.orgId,
        userId: parsed.data.ownerUserId,
        type: 'ACTION_ASSIGNED',
        title: `${existing.reference}: ${parsed.data.title}`,
        body: `${tenant.user.name} assigned this action to you.`,
        link: `/app/actions/${existing.id}`,
        alsoEmail: true,
      });
    }

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'action.updated',
      entityType: 'Action',
      entityId: existing.id,
      metadata: { reference: existing.reference, from: existing.status, to: parsed.data.status },
    });

    await Promise.all([
      recomputeProjectScores(tenant.orgId, existing.projectId),
      syncProjectGaps(tenant.orgId, existing.projectId),
    ]);

    revalidatePath('/app', 'layout');
    return { success: 'Action updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/**
 * Contributors may progress their own assigned actions but not create,
 * reassign or verify. Verification is deliberately a separate permission from
 * completion so the same person cannot mark and sign off their own work
 * unless their role allows it.
 */
function assertActionPermission(
  tenant: TenantContext,
  action: { ownerUserId: string | null; createdById: string },
  nextStatus: string
) {
  if (can(tenant.role, 'action:edit')) {
    if (nextStatus === 'VERIFIED' && !can(tenant.role, 'action:verify')) {
      throw new Error('Your role cannot verify actions.');
    }
    return;
  }

  const isOwner = action.ownerUserId === tenant.user.id;
  if (!isOwner || !can(tenant.role, 'action:complete_assigned')) {
    throw new Error('You can only update actions assigned to you.');
  }
  if (nextStatus === 'VERIFIED') {
    throw new Error('Only a manager or admin can verify an action as complete.');
  }
}

/* --------------------------------------------------------------- comments */

export async function addCommentAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'comment:create');

  const entityType = String(formData.get('entityType') ?? '');
  const entityId = String(formData.get('entityId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  if (!body) return;
  if (!['ACTION', 'GAP', 'EVIDENCE', 'PROJECT_REQUIREMENT'].includes(entityType)) {
    throw new Error('Unsupported comment target.');
  }

  // Confirm the target belongs to this tenant before writing.
  const exists = await entityBelongsToOrg(tenant.orgId, entityType, entityId);
  if (!exists) throw new Error('That item could not be found in this organization.');

  await prisma.comment.create({
    data: { orgId: tenant.orgId, entityType, entityId, userId: tenant.user.id, body: body.slice(0, 4000) },
  });

  revalidatePath('/app', 'layout');
}

async function entityBelongsToOrg(orgId: string, entityType: string, entityId: string): Promise<boolean> {
  switch (entityType) {
    case 'ACTION':
      return !!(await prisma.action.findFirst({ where: { id: entityId, orgId }, select: { id: true } }));
    case 'GAP':
      return !!(await prisma.gap.findFirst({ where: { id: entityId, orgId }, select: { id: true } }));
    case 'EVIDENCE':
      return !!(await prisma.evidence.findFirst({ where: { id: entityId, orgId }, select: { id: true } }));
    case 'PROJECT_REQUIREMENT':
      return !!(await prisma.projectRequirement.findFirst({ where: { id: entityId, orgId }, select: { id: true } }));
    default:
      return false;
  }
}

/* --------------------------------------------------- AI action suggestion */

/** Turns a gap into a drafted corrective action. Nothing is saved yet. */
export async function suggestActionAction(
  _prev: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'ai:run');

    const limit = consume(`ai-suggest:${tenant.orgId}`, LIMITS.aiAnalysis.limit, LIMITS.aiAnalysis.windowMs);
    if (!limit.ok) {
      return { error: `AI is rate limited right now. Try again in ${limit.retryAfterSeconds} seconds.` };
    }

    const gapId = String(formData.get('gapId') ?? '');
    const gap = await prisma.gap.findFirst({
      where: { id: gapId, orgId: tenant.orgId },
      include: {
        projectRequirement: { include: { requirement: { select: { identifier: true, title: true } } } },
        org: { select: { name: true } },
      },
    });
    if (!gap) return { error: 'That gap could not be found.' };

    const result = await ai().suggestAction({
      gapTitle: gap.title,
      gapDescription: gap.description,
      requirementIdentifier: gap.projectRequirement?.requirement.identifier,
      requirementTitle: gap.projectRequirement?.requirement.title,
      severity: gap.severity as Severity,
      organizationName: gap.org.name,
      department: gap.department,
    });

    await recordAssessment({
      orgId: tenant.orgId,
      subjectType: 'GAP',
      subjectId: gap.id,
      kind: 'ACTION_SUGGESTION',
      result,
      summary: result.data.title,
    });

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'ai.analysis_run',
      entityType: 'Gap',
      entityId: gap.id,
      metadata: { kind: 'ACTION_SUGGESTION', provider: result.provider, model: result.model },
    });

    return {
      suggestion: {
        title: result.data.title,
        description: result.data.description,
        priority: result.data.suggestedPriority,
        dueInDays: result.data.suggestedDueInDays,
        ownerRole: result.data.suggestedOwnerRole,
      },
      success: 'Draft generated. Review and edit it before saving — it has not been checked by a person.',
    };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/* ------------------------------------------------------------ gap status */

export async function updateGapStatusAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'gap:manage');

  const gapId = String(formData.get('gapId') ?? '');
  const status = String(formData.get('status') ?? '');
  const ownerUserId = String(formData.get('ownerUserId') ?? '');
  const dueDate = String(formData.get('dueDate') ?? '');

  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK', 'DISMISSED'].includes(status)) {
    throw new Error('Invalid gap status.');
  }

  const gap = await prisma.gap.findFirst({
    where: { id: gapId, orgId: tenant.orgId },
    select: { id: true, status: true, projectId: true, title: true },
  });
  if (!gap) throw new Error('That gap could not be found.');

  await prisma.gap.update({
    where: { id: gap.id },
    data: {
      status,
      ownerUserId: ownerUserId || null,
      dueDate: parseDate(dueDate),
      resolvedAt: status === 'RESOLVED' ? new Date() : null,
      // Human decisions survive re-detection.
      detectedBy: status === 'DISMISSED' || status === 'ACCEPTED_RISK' ? 'HUMAN' : undefined,
    },
  });

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'gap.status_changed',
    entityType: 'Gap',
    entityId: gap.id,
    metadata: { title: gap.title, from: gap.status, to: status },
  });

  await recomputeProjectScores(tenant.orgId, gap.projectId);
  revalidatePath('/app', 'layout');
}
