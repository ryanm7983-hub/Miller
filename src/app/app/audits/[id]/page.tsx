import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarClock,
  FileText,
  ListChecks,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
} from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { computeProjectReadiness } from '@/lib/scoring';
import {
  AUDIT_TYPE_LABELS,
  PROJECT_STATUS_META,
  type AuditType,
  type ProjectStatus,
  type RiskLevel,
} from '@/lib/enums';
import { Card, CardHeader, PageHeader, Stat } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ReadinessRing } from '@/components/ui/readiness';
import { SubmitButton } from '@/components/ui/form';
import { formatDate, formatDateTime } from '@/lib/utils';
import { refreshProjectAction } from '../actions';
import { EditProjectForm } from './edit-project-form';

export const metadata: Metadata = { title: 'Audit project' };

export default async function AuditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const project = await prisma.auditProject.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      frameworkVersion: { include: { framework: true } },
      lead: { select: { id: true, name: true } },
    },
  });
  if (!project) notFound();

  const [readiness, members, reports] = await Promise.all([
    computeProjectReadiness(tenant.orgId, project.id),
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditReport.findMany({
      where: { orgId: tenant.orgId, projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { generatedBy: { select: { name: true } } },
    }),
  ]);

  const canEdit = can(tenant.role, 'project:edit');

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.frameworkVersion.framework.name} v${project.frameworkVersion.version} · ${AUDIT_TYPE_LABELS[project.auditType as AuditType]}`}
        breadcrumb={[{ label: 'Audits', href: '/app/audits' }, { label: project.name }]}
        action={
          <>
            {canEdit && (
              <form action={refreshProjectAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <SubmitButton variant="secondary" pendingLabel="Re-checking…">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Re-run gap detection
                </SubmitButton>
              </form>
            )}
            <Link href={`/app/evidence/upload?project=${project.id}`} className="btn-primary btn-md">
              <Upload className="h-4 w-4" aria-hidden />
              Upload evidence
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="space-y-4">
          <Card className="flex flex-col items-center py-7">
            <ReadinessRing score={readiness.score} riskLevel={readiness.riskLevel as RiskLevel} />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Badge tone={PROJECT_STATUS_META[project.status as ProjectStatus].tone} size="sm">
                {PROJECT_STATUS_META[project.status as ProjectStatus].label}
              </Badge>
              {project.scoredAt && (
                <span className="text-[11.5px] text-ink-400">Scored {formatDateTime(project.scoredAt)}</span>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Jump to" />
            <div className="divide-y divide-ink-100">
              {[
                { href: `/app/requirements?project=${project.id}`, label: 'Requirements', icon: ListChecks, value: `${readiness.total}` },
                { href: `/app/matrix?project=${project.id}`, label: 'Evidence matrix', icon: Sparkles, value: `${readiness.links.total} links` },
                { href: `/app/evidence?project=${project.id}`, label: 'Evidence library', icon: FileText, value: `${readiness.evidence.total}` },
                { href: `/app/gaps?project=${project.id}`, label: 'Gap Center', icon: ShieldAlert, value: `${readiness.gaps.open} open` },
                { href: `/app/simulator?project=${project.id}`, label: 'Audit simulator', icon: MessagesSquare, value: '' },
                { href: `/app/audits/${project.id}/prepare`, label: 'Preparation mode', icon: CalendarClock, value: readiness.daysUntilAudit !== null ? `${readiness.daysUntilAudit}d` : '' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-colors hover:bg-ink-50/70"
                >
                  <link.icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="flex-1 font-medium text-ink-800">{link.label}</span>
                  {link.value && <span className="text-[12px] text-ink-500">{link.value}</span>}
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <Stat label="Requirements" value={readiness.total} sub={`${readiness.assessed} assessed`} />
            </Card>
            <Card>
              <Stat
                label="Evidence"
                value={readiness.evidence.total}
                sub={`${readiness.evidence.expiringSoon} expiring soon`}
                tone={readiness.evidence.expired > 0 ? 'risk' : 'default'}
              />
            </Card>
            <Card>
              <Stat
                label="Open gaps"
                value={readiness.gaps.open}
                tone={readiness.gaps.critical > 0 ? 'risk' : readiness.gaps.high > 0 ? 'caution' : 'strong'}
                sub={`${readiness.gaps.critical} critical · ${readiness.gaps.high} high`}
              />
            </Card>
            <Card>
              <Stat
                label="Actions"
                value={readiness.actions.open}
                tone={readiness.actions.overdue > 0 ? 'risk' : 'default'}
                sub={`${readiness.actions.overdue} overdue`}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Project settings"
              description={canEdit ? 'Changes apply immediately.' : 'Read-only — your role cannot edit this project.'}
            />
            <div className="p-5">
              <EditProjectForm
                project={{
                  id: project.id,
                  name: project.name,
                  auditType: project.auditType,
                  status: project.status,
                  scope: project.scope,
                  auditDate: project.auditDate?.toISOString() ?? null,
                  leadUserId: project.leadUserId,
                }}
                members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                canEdit={canEdit}
                canDelete={can(tenant.role, 'project:delete')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Reports"
              description="Point-in-time snapshots you can share or print."
              action={
                <Link href={`/app/reports?project=${project.id}`} className="btn-secondary btn-sm">
                  All reports
                </Link>
              }
            />
            {reports.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-500">
                No reports generated yet.{' '}
                <Link href={`/app/reports?project=${project.id}`} className="link">
                  Generate one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Link href={`/app/reports/${report.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink-900">{report.title}</p>
                        <p className="text-[12px] text-ink-500">
                          {report.generatedBy.name} · {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <span className="tnum text-[13px] font-semibold text-ink-700">{report.readinessScore}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
