import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { computeProjectReadiness } from '@/lib/scoring';
import { RISK_LEVEL_META, type RiskLevel } from '@/lib/enums';
import { Card, CardHeader, EmptyState, PageHeader, Stat, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ReadinessBar } from '@/components/ui/readiness';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Clients' };

/**
 * Consultant portfolio.
 *
 * Reads the `ClientEngagement` relation established in the schema. Each row is
 * computed from the client organization's own data, accessed only because an
 * active engagement grants it — the same rule `listAccessibleOrgs` enforces.
 */
export default async function ClientsPage() {
  const tenant = await requireTenant();
  if (tenant.org.kind !== 'CONSULTANCY') redirect('/app/dashboard');

  const engagements = await prisma.clientEngagement.findMany({
    where: { consultancyOrgId: tenant.orgId, status: { in: ['ACTIVE', 'PENDING'] } },
    include: {
      client: {
        include: {
          projects: {
            where: { status: { not: 'ARCHIVED' } },
            orderBy: [{ auditDate: 'asc' }],
            take: 1,
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  const rows = await Promise.all(
    engagements.map(async (engagement) => {
      const project = engagement.client.projects[0];
      const readiness = project ? await computeProjectReadiness(engagement.clientOrgId, project.id) : null;
      return {
        engagementId: engagement.id,
        clientId: engagement.clientOrgId,
        clientName: engagement.client.name,
        status: engagement.status,
        grantedRole: engagement.grantedRole,
        projectName: project?.name ?? null,
        auditDate: project?.auditDate ?? null,
        daysUntilAudit: readiness?.daysUntilAudit ?? null,
        readiness: readiness?.score ?? 0,
        riskLevel: (readiness?.riskLevel ?? 'MEDIUM') as RiskLevel,
        criticalGaps: readiness ? readiness.gaps.critical + readiness.gaps.high : 0,
        openActions: readiness?.actions.open ?? 0,
      };
    })
  );

  const portfolioAverage =
    rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length) : 0;
  const atRisk = rows.filter((row) => row.readiness < 70 || row.criticalGaps > 0).length;
  const soon = rows.filter((row) => row.daysUntilAudit !== null && row.daysUntilAudit <= 30).length;

  return (
    <div>
      <PageHeader
        title="Client portfolio"
        description={`Every organization ${tenant.org.name} has an active engagement with.`}
      />

      {rows.length === 0 ? (
        <>
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No client engagements yet"
              description="An engagement grants your consultancy scoped access to a client's workspace, and puts their readiness on this dashboard."
            />
          </Card>
          <Alert tone="info" className="mt-4" title="How engagements work today">
            The data model, access control and this portfolio view are all in place. Engagements are created directly in
            the database while the self-service client-invitation flow is being built — that flow ships with the
            Consultant tier. Once an engagement row exists, the client organization appears in your organization
            switcher and here, with the role the engagement grants.
          </Alert>
        </>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Card>
              <Stat label="Clients" value={rows.length} />
            </Card>
            <Card>
              <Stat
                label="Average readiness"
                value={`${portfolioAverage}%`}
                tone={portfolioAverage >= 80 ? 'strong' : portfolioAverage >= 55 ? 'caution' : 'risk'}
              />
            </Card>
            <Card>
              <Stat label="Need attention" value={atRisk} tone={atRisk > 0 ? 'caution' : 'strong'} />
            </Card>
            <Card>
              <Stat label="Audits within 30 days" value={soon} tone={soon > 0 ? 'risk' : 'default'} />
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Clients" description="Ranked by how soon their audit is." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium">Audit</th>
                    <th className="px-3 py-2.5 font-medium">Readiness</th>
                    <th className="px-3 py-2.5 font-medium">Risk</th>
                    <th className="px-3 py-2.5 font-medium">Critical gaps</th>
                    <th className="px-5 py-2.5 font-medium">Open actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {[...rows]
                    .sort((a, b) => (a.daysUntilAudit ?? 9999) - (b.daysUntilAudit ?? 9999))
                    .map((row) => (
                      <tr key={row.engagementId} className="table-row-link">
                        <td className="px-5 py-3.5">
                          <form action={`/api/orgs/${row.clientId}/activate`} method="post">
                            <button type="submit" className="text-left">
                              <span className="text-[14px] font-semibold text-ink-900">{row.clientName}</span>
                              <span className="mt-0.5 block text-[12px] text-ink-500">
                                {row.projectName ?? 'No active audit project'}
                              </span>
                            </button>
                          </form>
                        </td>
                        <td className="px-3 py-3.5 text-[13px] text-ink-600">
                          {row.daysUntilAudit !== null ? (
                            <span className={row.daysUntilAudit <= 14 ? 'font-semibold text-risk-600' : ''}>
                              {row.daysUntilAudit} days
                              <span className="ml-1 text-[12px] text-ink-400">{formatDate(row.auditDate)}</span>
                            </span>
                          ) : (
                            <span className="text-ink-400">Not set</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <ReadinessBar score={row.readiness} />
                        </td>
                        <td className="px-3 py-3.5">
                          <Badge tone={RISK_LEVEL_META[row.riskLevel].tone} size="sm" dot>
                            {RISK_LEVEL_META[row.riskLevel].label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3.5">
                          <Badge tone={row.criticalGaps > 4 ? 'risk' : row.criticalGaps > 0 ? 'caution' : 'strong'} size="sm">
                            {row.criticalGaps}
                          </Badge>
                        </td>
                        <td className="tnum px-5 py-3.5 text-[13px] text-ink-700">{row.openActions}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="mt-4 text-[12px] text-ink-400">
            Selecting a client switches your active organization to their workspace with the role their engagement
            grants. Every access is recorded in that organization&rsquo;s activity log.
          </p>
        </>
      )}

      <Card className="mt-4">
        <CardHeader title="Add a client" description="Available on the Consultant tier." />
        <Link href="/app/settings/billing" className="block px-5 py-4 text-[13px] text-ink-600 hover:bg-ink-50/70">
          Client onboarding, scoped invitations and white-label reports ship with the Consultant plan.{' '}
          <span className="font-medium text-kelp-700">See plans →</span>
        </Link>
      </Card>
    </div>
  );
}
