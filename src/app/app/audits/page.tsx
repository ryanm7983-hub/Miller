import type { Metadata } from 'next';
import Link from 'next/link';
import { Gauge, Plus } from 'lucide-react';

import { requireTenant } from '@/lib/tenant';
import { listProjects } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import {
  AUDIT_TYPE_LABELS,
  PROJECT_STATUS_META,
  RISK_LEVEL_META,
  type AuditType,
  type ProjectStatus,
  type RiskLevel,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ReadinessBar } from '@/components/ui/readiness';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audits' };

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const tenant = await requireTenant();
  const { archived } = await searchParams;
  const showArchived = archived === '1';
  const projects = await listProjects(tenant, showArchived);
  const canCreate = can(tenant.role, 'project:create');

  return (
    <div>
      <PageHeader
        title="Audit projects"
        description="Each project pairs a framework with your evidence, gaps and actions."
        action={
          <>
            <Link
              href={showArchived ? '/app/audits' : '/app/audits?archived=1'}
              className="btn-secondary btn-md"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Link>
            {canCreate && (
              <Link href="/app/audits/new" className="btn-primary btn-md">
                <Plus className="h-4 w-4" aria-hidden />
                New audit project
              </Link>
            )}
          </>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Gauge className="h-5 w-5" />}
            title="No audit projects yet"
            description="Create one for the audit you have coming up next — certification, customer, internal or a gap assessment."
            action={
              canCreate ? (
                <Link href="/app/audits/new" className="btn-primary btn-lg">
                  <Plus className="h-4 w-4" aria-hidden />
                  Create audit project
                </Link>
              ) : (
                <p className="text-[13px] text-ink-500">Ask a manager or admin to create one.</p>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 font-medium">Framework</th>
                  <th className="px-3 py-2.5 font-medium">Audit date</th>
                  <th className="px-3 py-2.5 font-medium">Readiness</th>
                  <th className="px-3 py-2.5 font-medium">Risk</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {projects.map((project) => {
                  const days = project.auditDate
                    ? Math.ceil((project.auditDate.getTime() - Date.now()) / 86_400_000)
                    : null;
                  return (
                    <tr key={project.id} className="table-row-link">
                      <td className="px-5 py-3.5">
                        <Link href={`/app/audits/${project.id}`} className="block">
                          <span className="text-[14px] font-semibold text-ink-900">{project.name}</span>
                          <span className="mt-0.5 block text-[12px] text-ink-500">
                            {AUDIT_TYPE_LABELS[project.auditType as AuditType]}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-600">
                        {project.frameworkName}
                        <span className="ml-1 text-ink-400">v{project.frameworkVersion}</span>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-600">
                        {project.auditDate ? (
                          <>
                            {formatDate(project.auditDate)}
                            {days !== null && days >= 0 && (
                              <span className={`ml-1.5 text-[12px] ${days <= 14 ? 'font-semibold text-risk-600' : 'text-ink-400'}`}>
                                {days}d
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-400">Not set</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <ReadinessBar score={project.readinessScore} />
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={RISK_LEVEL_META[project.riskLevel as RiskLevel].tone} size="sm" dot>
                          {RISK_LEVEL_META[project.riskLevel as RiskLevel].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={PROJECT_STATUS_META[project.status as ProjectStatus].tone} size="sm">
                          {PROJECT_STATUS_META[project.status as ProjectStatus].label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
