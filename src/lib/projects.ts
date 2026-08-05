import 'server-only';

import { prisma } from '@/lib/db';
import type { TenantContext } from '@/lib/tenant';

export interface ProjectSummary {
  id: string;
  name: string;
  auditType: string;
  status: string;
  auditDate: Date | null;
  readinessScore: number;
  riskLevel: string;
  frameworkName: string;
  frameworkVersion: string;
  frameworkVersionId: string;
}

/** All non-archived projects for the tenant, most urgent first. */
export async function listProjects(tenant: TenantContext, includeArchived = false): Promise<ProjectSummary[]> {
  const projects = await prisma.auditProject.findMany({
    where: {
      orgId: tenant.orgId,
      ...(includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
    },
    include: { frameworkVersion: { include: { framework: true } } },
    orderBy: [{ status: 'asc' }, { auditDate: 'asc' }, { createdAt: 'desc' }],
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    auditType: p.auditType,
    status: p.status,
    auditDate: p.auditDate,
    readinessScore: p.readinessScore,
    riskLevel: p.riskLevel,
    frameworkName: p.frameworkVersion.framework.name,
    frameworkVersion: p.frameworkVersion.version,
    frameworkVersionId: p.frameworkVersionId,
  }));
}

/**
 * Resolves the project a project-scoped page should show.
 *
 * Precedence: an explicit `?project=` id that belongs to this tenant, then the
 * project with the nearest audit date, then the most recently created. Returns
 * null when the organization has no projects yet.
 */
export async function resolveProject(
  tenant: TenantContext,
  requestedId?: string | null
): Promise<{ project: ProjectSummary | null; projects: ProjectSummary[] }> {
  const projects = await listProjects(tenant);
  if (projects.length === 0) return { project: null, projects };

  if (requestedId) {
    const match = projects.find((p) => p.id === requestedId);
    if (match) return { project: match, projects };
  }

  const dated = projects.filter((p) => p.auditDate).sort((a, b) => a.auditDate!.getTime() - b.auditDate!.getTime());
  return { project: dated[0] ?? projects[0], projects };
}

/** Throws if the id does not belong to the tenant. Use for detail routes. */
export async function requireProject(tenant: TenantContext, projectId: string) {
  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId: tenant.orgId },
    include: { frameworkVersion: { include: { framework: true } }, lead: true },
  });
  if (!project) throw new Error('That audit project does not exist in this organization.');
  return project;
}
