'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { recordAudit } from '@/lib/audit-log';
import { notify } from '@/lib/notifications';
import { recomputeProjectScores } from '@/lib/scoring';
import { syncProjectGaps } from '@/lib/gaps';
import { REQUIREMENT_STATUSES } from '@/lib/enums';
import { toFormError } from '@/lib/errors';

export interface RequirementFormState {
  error?: string;
  success?: string;
}

const updateSchema = z.object({
  projectRequirementId: z.string().min(1),
  status: z.enum(REQUIREMENT_STATUSES),
  ownerUserId: z.string().trim().optional(),
  department: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  naJustification: z.string().trim().max(1000).optional(),
  importanceOverride: z.string().trim().optional(),
});

/**
 * Human update of a requirement's state.
 *
 * Setting the status here marks `statusSource = HUMAN`, which stops the
 * automatic derivation from overwriting a person's judgement later.
 */
export async function updateRequirementAction(
  _prev: RequirementFormState,
  formData: FormData
): Promise<RequirementFormState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'requirement:edit');

    const parsed = updateSchema.safeParse({
      projectRequirementId: formData.get('projectRequirementId'),
      status: formData.get('status'),
      ownerUserId: formData.get('ownerUserId') || undefined,
      department: formData.get('department') || undefined,
      notes: formData.get('notes') || undefined,
      naJustification: formData.get('naJustification') || undefined,
      importanceOverride: formData.get('importanceOverride') || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
    }

    const existing = await prisma.projectRequirement.findFirst({
      where: { id: parsed.data.projectRequirementId, orgId: tenant.orgId },
      include: { requirement: { select: { identifier: true, title: true } } },
    });
    if (!existing) return { error: 'That requirement could not be found in this organization.' };

    if (parsed.data.status === 'NOT_APPLICABLE' && !parsed.data.naJustification) {
      return { error: 'Marking a requirement not applicable needs a justification an auditor would accept.' };
    }

    const importance = parsed.data.importanceOverride ? Number(parsed.data.importanceOverride) : null;

    await prisma.projectRequirement.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        statusSource: 'HUMAN',
        ownerUserId: parsed.data.ownerUserId || null,
        department: parsed.data.department || null,
        notes: parsed.data.notes || null,
        naJustification: parsed.data.status === 'NOT_APPLICABLE' ? parsed.data.naJustification : null,
        importanceOverride: importance && importance >= 1 && importance <= 5 ? importance : null,
        lastAssessedAt: new Date(),
      },
    });

    if (existing.status !== parsed.data.status) {
      await recordAudit({
        orgId: tenant.orgId,
        userId: tenant.user.id,
        action: 'requirement.status_overridden',
        entityType: 'ProjectRequirement',
        entityId: existing.id,
        metadata: {
          identifier: existing.requirement.identifier,
          from: existing.status,
          to: parsed.data.status,
        },
      });
    }

    // Notify a newly-assigned owner.
    if (parsed.data.ownerUserId && parsed.data.ownerUserId !== existing.ownerUserId) {
      await notify({
        orgId: tenant.orgId,
        userId: parsed.data.ownerUserId,
        type: 'REQUIREMENT_CHANGED',
        title: `You now own ${existing.requirement.identifier} — ${existing.requirement.title}`,
        body: 'You have been assigned as the owner of this requirement.',
        link: `/app/requirements/${existing.id}`,
      });
    }

    await Promise.all([
      recomputeProjectScores(tenant.orgId, existing.projectId),
      syncProjectGaps(tenant.orgId, existing.projectId),
    ]);

    revalidatePath('/app', 'layout');
    return { success: 'Requirement updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/** Bulk owner/department assignment from the requirements list. */
export async function bulkAssignRequirementsAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'requirement:edit');

  const ids = formData.getAll('requirementIds').map(String).filter(Boolean);
  const ownerUserId = String(formData.get('ownerUserId') ?? '');
  const department = String(formData.get('department') ?? '');
  if (ids.length === 0) return;

  // Verify ownership of every id before writing anything.
  const owned = await prisma.projectRequirement.findMany({
    where: { id: { in: ids }, orgId: tenant.orgId },
    select: { id: true, projectId: true },
  });
  if (owned.length === 0) return;

  if (ownerUserId) {
    const member = await prisma.membership.findFirst({
      where: { orgId: tenant.orgId, userId: ownerUserId, status: 'ACTIVE' },
    });
    if (!member) throw new Error('That person is not an active member of this organization.');
  }

  await prisma.projectRequirement.updateMany({
    where: { id: { in: owned.map((r) => r.id) }, orgId: tenant.orgId },
    data: {
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(department ? { department } : {}),
    },
  });

  const projectIds = [...new Set(owned.map((r) => r.projectId))];
  await Promise.all(projectIds.map((projectId) => syncProjectGaps(tenant.orgId, projectId)));

  revalidatePath('/app', 'layout');
}
