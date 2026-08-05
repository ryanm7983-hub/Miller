import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import { RISK_LEVEL_META, type RiskLevel } from '@/lib/enums';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { ProjectPicker } from '@/components/app/project-picker';
import { formatDateTime } from '@/lib/utils';
import { generateReportAction } from './actions';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Reports" />
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No audit project yet"
            description="Reports snapshot the readiness of an audit project."
            action={
              <Link href="/app/audits/new" className="btn-primary btn-md">
                Create audit project
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const reports = await prisma.auditReport.findMany({
    where: { orgId: tenant.orgId, projectId: project.id },
    include: { generatedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const canGenerate = can(tenant.role, 'report:generate');

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Point-in-time snapshots of readiness, gaps, actions and recommendations. Once generated, a report never changes."
        action={<ProjectPicker projects={projects} activeId={project.id} basePath="/app/reports" />}
      />

      {canGenerate && (
        <Card className="mb-4">
          <CardHeader
            title="Generate a report"
            description={`Captures the current state of ${project.name} — readiness score, evidence statistics, major gaps, open actions and recommendations.`}
          />
          <form action={generateReportAction} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="flex-1">
              <label htmlFor="title" className="label mb-1.5 block">
                Report title
              </label>
              <input
                id="title"
                name="title"
                className="input"
                placeholder={`${project.name} — audit preparation report`}
              />
            </div>
            <SubmitButton size="lg" pendingLabel="Generating…">
              <Plus className="h-4 w-4" aria-hidden />
              Generate report
            </SubmitButton>
          </form>
        </Card>
      )}

      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No reports yet"
            description="Generate one before a management review, to share with a consultant, or to keep a record of where you stood at a point in time."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/app/reports/${report.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50/70">
                  <FileText className="h-4.5 w-4.5 shrink-0 text-ink-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink-900">{report.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {report.generatedBy.name} · {formatDateTime(report.createdAt)}
                    </p>
                  </div>
                  <Badge tone={RISK_LEVEL_META[report.riskLevel as RiskLevel].tone} size="sm">
                    {RISK_LEVEL_META[report.riskLevel as RiskLevel].label} risk
                  </Badge>
                  <span className="tnum text-[18px] font-bold text-ink-900">{report.readinessScore}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
