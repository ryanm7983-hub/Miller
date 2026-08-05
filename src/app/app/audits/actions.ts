'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { assertWithinLimit } from '@/lib/billing';
import { toFormError } from '@/lib/errors';
import { recordAudit } from '@/lib/audit-log';
import { syncProjectGaps } from '@/lib/gaps';
import { recomputeProjectScores } from '@/lib/scoring';
import { AUDIT_TYPES, PROJECT_STATUSES } from '@/lib/enums';

export interface ProjectFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Give this audit project a name.').max(140),
  frameworkVersionId: z.string().min(1, 'Choose a framework.'),
  auditType: z.enum(AUDIT_TYPES),
  scope: z.string().trim().max(2000).optional(),
  auditDate: z.string().trim().optional(),
});

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T09:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  let projectId: string;

  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'project:create');
    await assertWithinLimit(tenant.orgId, 'auditProjects');

    const parsed = createSchema.safeParse({
      name: formData.get('name'),
      frameworkVersionId: formData.get('frameworkVersionId'),
      auditType: formData.get('auditType') || 'INTERNAL',
      scope: formData.get('scope') || undefined,
      auditDate: formData.get('auditDate') || undefined,
    });

    if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

    // The framework version must be a system framework or owned by this org.
    const version = await prisma.frameworkVersion.findFirst({
      where: {
        id: parsed.data.frameworkVersionId,
        framework: { OR: [{ isSystem: true }, { orgId: tenant.orgId }] },
      },
      include: { requirements: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!version) return { fieldErrors: { frameworkVersionId: 'That framework is not available to your organization.' } };
    if (version.requirements.length === 0) {
      return { fieldErrors: { frameworkVersionId: 'That framework version has no requirements yet.' } };
    }

    const project = await prisma.auditProject.create({
      data: {
        orgId: tenant.orgId,
        name: parsed.data.name,
        frameworkVersionId: version.id,
        auditType: parsed.data.auditType,
        scope: parsed.data.scope,
        auditDate: parseDate(parsed.data.auditDate),
        status: 'PLANNING',
        leadUserId: tenant.user.id,
        requirements: {
          create: version.requirements.map((requirement) => ({
            orgId: tenant.orgId,
            requirementId: requirement.id,
            status: 'NOT_ASSESSED',
          })),
        },
      },
    });

    await recomputeProjectScores(tenant.orgId, project.id);
    await syncProjectGaps(tenant.orgId, project.id);

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'project.created',
      entityType: 'AuditProject',
      entityId: project.id,
      metadata: { name: project.name, framework: version.frameworkId, requirements: version.requirements.length },
    });

    projectId = project.id;
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath('/app', 'layout');
  redirect(`/app/audits/${projectId}?created=1`);
}

const updateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2, 'Give this audit project a name.').max(140),
  auditType: z.enum(AUDIT_TYPES),
  status: z.enum(PROJECT_STATUSES),
  scope: z.string().trim().max(2000).optional(),
  auditDate: z.string().trim().optional(),
  leadUserId: z.string().trim().optional(),
});

export async function updateProjectAction(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'project:edit');

    const parsed = updateSchema.safeParse({
      projectId: formData.get('projectId'),
      name: formData.get('name'),
      auditType: formData.get('auditType') || 'INTERNAL',
      status: formData.get('status') || 'PLANNING',
      scope: formData.get('scope') || undefined,
      auditDate: formData.get('auditDate') || undefined,
      leadUserId: formData.get('leadUserId') || undefined,
    });

    if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

    // Scoped update: a project id from another tenant matches zero rows.
    const result = await prisma.auditProject.updateMany({
      where: { id: parsed.data.projectId, orgId: tenant.orgId },
      data: {
        name: parsed.data.name,
        auditType: parsed.data.auditType,
        status: parsed.data.status,
        scope: parsed.data.scope || null,
        auditDate: parseDate(parsed.data.auditDate),
        leadUserId: parsed.data.leadUserId || null,
      },
    });

    if (result.count === 0) return { error: 'That audit project could not be found.' };

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'project.updated',
      entityType: 'AuditProject',
      entityId: parsed.data.projectId,
      metadata: { name: parsed.data.name, status: parsed.data.status },
    });

    revalidatePath('/app', 'layout');
    return { success: 'Audit project updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function deleteProjectAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'project:delete');

  const projectId = String(formData.get('projectId') ?? '');
  const confirmation = String(formData.get('confirmName') ?? '').trim();

  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId: tenant.orgId },
    select: { id: true, name: true },
  });
  if (!project) throw new Error('That audit project could not be found.');

  if (confirmation !== project.name) {
    throw new Error('Type the project name exactly to confirm deletion.');
  }

  await prisma.auditProject.delete({ where: { id: project.id } });
  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'project.deleted',
    entityType: 'AuditProject',
    entityId: project.id,
    metadata: { name: project.name },
  });

  revalidatePath('/app', 'layout');
  redirect('/app/audits');
}

/** Re-runs gap detection and scoring for a project. */
export async function refreshProjectAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'gap:manage');

  const projectId = String(formData.get('projectId') ?? '');
  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId: tenant.orgId },
    select: { id: true },
  });
  if (!project) throw new Error('That audit project could not be found.');

  await syncProjectGaps(tenant.orgId, project.id);
  await recomputeProjectScores(tenant.orgId, project.id);

  revalidatePath('/app', 'layout');
}
