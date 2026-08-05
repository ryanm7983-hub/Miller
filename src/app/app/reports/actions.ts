'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { recordAudit } from '@/lib/audit-log';
import { buildReportPayload } from '@/lib/reports';
import { stringifyJson } from '@/lib/json';
import { formatDate } from '@/lib/utils';

export async function generateReportAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'report:generate');

  const projectId = String(formData.get('projectId') ?? '');
  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId: tenant.orgId },
    select: { id: true, name: true },
  });
  if (!project) throw new Error('That audit project could not be found.');

  const payload = await buildReportPayload(tenant.orgId, project.id);
  const customTitle = String(formData.get('title') ?? '').trim();

  const report = await prisma.auditReport.create({
    data: {
      orgId: tenant.orgId,
      projectId: project.id,
      title: customTitle || `${project.name} — audit preparation report, ${formatDate(new Date())}`,
      generatedById: tenant.user.id,
      readinessScore: payload.readiness.score,
      riskLevel: payload.readiness.riskLevel,
      data: stringifyJson(payload),
    },
  });

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'report.generated',
    entityType: 'AuditReport',
    entityId: report.id,
    metadata: { project: project.name, score: payload.readiness.score },
  });

  revalidatePath('/app', 'layout');
  redirect(`/app/reports/${report.id}`);
}

export async function deleteReportAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'report:generate');

  const reportId = String(formData.get('reportId') ?? '');
  const result = await prisma.auditReport.deleteMany({
    where: { id: reportId, orgId: tenant.orgId },
  });
  if (result.count === 0) throw new Error('That report could not be found.');

  revalidatePath('/app', 'layout');
  redirect('/app/reports');
}
