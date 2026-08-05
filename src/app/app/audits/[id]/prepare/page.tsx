import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CalendarClock, CheckSquare, ListChecks, ShieldAlert, Sparkles } from 'lucide-react';

import { requireTenant } from '@/lib/tenant';
import { buildPreparationPlan, effortLabel, severityTone } from '@/lib/prepare';
import { computeProjectReadiness } from '@/lib/scoring';
import { SEVERITY_META, type RiskLevel, type Severity } from '@/lib/enums';
import { Card, CardHeader, EmptyState, PageHeader, Stat, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ReadinessRing } from '@/components/ui/readiness';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit preparation' };

const KIND_META = {
  GAP: { label: 'Gap', icon: ShieldAlert },
  ACTION: { label: 'Action', icon: CheckSquare },
  REVIEW: { label: 'Review', icon: Sparkles },
  REQUIREMENT: { label: 'Requirement', icon: ListChecks },
} as const;

export default async function PreparePage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await params;

  const plan = await buildPreparationPlan(tenant.orgId, id);
  if (!plan.project || plan.project.orgId !== tenant.orgId) notFound();

  const readiness = await computeProjectReadiness(tenant.orgId, id);
  const days = plan.daysUntilAudit;

  return (
    <div>
      <PageHeader
        title="Audit preparation"
        description={`A ranked plan for ${plan.project.name}, weighted by impact, urgency and effort.`}
        breadcrumb={[
          { label: 'Audits', href: '/app/audits' },
          { label: plan.project.name, href: `/app/audits/${plan.project.id}` },
          { label: 'Preparation' },
        ]}
      />

      {days === null ? (
        <Alert tone="info" className="mb-5" title="No audit date set">
          Set an audit date on the project to get a countdown and time-weighted prioritisation.{' '}
          <Link href={`/app/audits/${plan.project.id}`} className="link font-medium">
            Set it now
          </Link>
          .
        </Alert>
      ) : (
        <Card className="mb-4 overflow-hidden">
          <div className="grid divide-ink-200 sm:grid-cols-[auto,1fr] sm:divide-x">
            <div
              className={`flex flex-col items-center justify-center px-8 py-6 ${
                days <= 14 ? 'bg-risk-50' : days <= 45 ? 'bg-caution-50' : 'bg-ink-50/60'
              }`}
            >
              <CalendarClock
                className={`h-5 w-5 ${days <= 14 ? 'text-risk-600' : days <= 45 ? 'text-caution-600' : 'text-ink-500'}`}
                aria-hidden
              />
              <div
                className={`tnum mt-2 text-[42px] font-bold leading-none ${
                  days <= 14 ? 'text-risk-700' : days <= 45 ? 'text-caution-700' : 'text-ink-900'
                }`}
              >
                {Math.max(days, 0)}
              </div>
              <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {days < 0 ? 'Days since audit' : days === 1 ? 'Day until audit' : 'Days until audit'}
              </div>
              {plan.project.auditDate && (
                <div className="mt-1.5 text-[12.5px] text-ink-500">{formatDate(plan.project.auditDate)}</div>
              )}
            </div>

            <div className="grid grid-cols-2 divide-ink-200 sm:grid-cols-4 sm:divide-x">
              <Stat label="Open gaps" value={plan.totals.gaps} tone={plan.totals.gaps > 0 ? 'caution' : 'strong'} />
              <Stat label="Open actions" value={plan.totals.actions} />
              <Stat label="Awaiting review" value={plan.totals.pendingReviews} sub="AI matches" />
              <Stat label="Not assessed" value={plan.totals.unassessed} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,300px]">
        <Card>
          <CardHeader
            title="Your top 10 priorities"
            description="Ranked by what will move your readiness the most, soonest, for the least effort."
          />
          {plan.top.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-5 w-5" />}
              title="Nothing outstanding"
              description="No open gaps, actions, unreviewed matches or unassessed requirements on this project. Generate a report to capture where you stand."
              action={
                <Link href={`/app/reports?project=${plan.project.id}`} className="btn-primary btn-md">
                  Generate report
                </Link>
              }
            />
          ) : (
            <ol className="divide-y divide-ink-100">
              {plan.top.map((item, index) => {
                const kind = KIND_META[item.kind];
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-ink-50/70">
                      <span className="tnum mt-0.5 w-6 shrink-0 text-[15px] font-bold text-ink-300">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <kind.icon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                          <span className="text-[14px] font-semibold text-ink-900">{item.title}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-600">{item.detail}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="muted" size="sm">
                            {kind.label}
                          </Badge>
                          {item.severity && (
                            <Badge tone={severityTone(item.severity as Severity)} size="sm">
                              {SEVERITY_META[item.severity as Severity].label}
                            </Badge>
                          )}
                          <Badge tone={item.effort === 'LOW' ? 'strong' : item.effort === 'MEDIUM' ? 'caution' : 'neutral'} size="sm">
                            {effortLabel(item.effort)}
                          </Badge>
                          {item.dueDate && (
                            <span className="text-[12px] text-ink-500">due {formatDate(item.dueDate)}</span>
                          )}
                          {item.owner && <span className="text-[12px] text-ink-500">· {item.owner}</span>}
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {plan.items.length > 10 && (
            <div className="border-t border-ink-200 px-5 py-3 text-[12.5px] text-ink-500">
              {plan.items.length - 10} further item{plan.items.length - 10 === 1 ? '' : 's'} outstanding. Work down the
              list and it will re-rank as you go.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="flex flex-col items-center py-6">
            <ReadinessRing score={readiness.score} size={140} strokeWidth={11} riskLevel={readiness.riskLevel as RiskLevel} />
          </Card>

          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">How this is ranked</p>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>
                <strong className="font-semibold text-ink-800">Impact</strong> — gap severity and the importance of the
                requirement behind it.
              </li>
              <li>
                <strong className="font-semibold text-ink-800">Urgency</strong> — items weight up as the audit date gets
                closer, and overdue work jumps.
              </li>
              <li>
                <strong className="font-semibold text-ink-800">Effort</strong> — at equal impact, quick wins rank first
                so momentum stays with you.
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Next steps</p>
            <div className="mt-3 space-y-2">
              <Link href={`/app/gaps?project=${plan.project.id}`} className="btn-secondary btn-sm w-full">
                Open Gap Center
              </Link>
              <Link href={`/app/matrix?project=${plan.project.id}&review=PENDING`} className="btn-secondary btn-sm w-full">
                Review AI matches
              </Link>
              <Link href={`/app/simulator?project=${plan.project.id}`} className="btn-secondary btn-sm w-full">
                Practise auditor questions
              </Link>
              <Link href={`/app/reports?project=${plan.project.id}`} className="btn-primary btn-sm w-full">
                Generate preparation report
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
