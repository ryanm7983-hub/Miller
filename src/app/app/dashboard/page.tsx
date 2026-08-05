import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  Plus,
  ShieldAlert,
  Sparkles,
  Upload,
} from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { computeProjectReadiness } from '@/lib/scoring';
import { runNotificationSweep } from '@/lib/notifications';
import { aiProviderLabel } from '@/lib/ai';
import {
  AUDIT_TYPE_LABELS,
  SEVERITY_META,
  type AuditType,
  type RiskLevel,
  type Severity,
} from '@/lib/enums';
import { Card, CardHeader, EmptyState, PageHeader, Stat, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ReadinessRing } from '@/components/ui/readiness';
import { ProjectPicker } from '@/components/app/project-picker';
import { formatDate, relativeTime, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const tenant = await requireTenant();
  const { project: requested } = await searchParams;
  const { project, projects } = await resolveProject(tenant, requested);

  // Keep time-based notifications current. Cheap and idempotent.
  await runNotificationSweep(tenant.orgId).catch(() => undefined);

  if (!project) return <NoProjects orgName={tenant.org.name} />;

  const [readiness, topGaps, recentEvidence, myActions, pendingLinks] = await Promise.all([
    computeProjectReadiness(tenant.orgId, project.id),
    prisma.gap.findMany({
      where: { orgId: tenant.orgId, projectId: project.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      include: { projectRequirement: { include: { requirement: true } } },
    }),
    prisma.evidence.findMany({
      where: { orgId: tenant.orgId, projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { uploadedBy: { select: { name: true } } },
    }),
    prisma.action.findMany({
      where: {
        orgId: tenant.orgId,
        projectId: project.id,
        ownerUserId: tenant.user.id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] },
      },
      orderBy: [{ dueDate: 'asc' }],
      take: 5,
    }),
    prisma.evidenceLink.count({
      where: {
        orgId: tenant.orgId,
        reviewState: 'PENDING',
        projectRequirement: { projectId: project.id },
      },
    }),
  ]);

  const ai = aiProviderLabel();
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedGaps = [...topGaps].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${tenant.user.name.split(' ')[0]}`}
        description={`Here is where ${tenant.org.name} stands on ${project.name}.`}
        action={
          <>
            <ProjectPicker projects={projects} activeId={project.id} basePath="/app/dashboard" />
            <Link href={`/app/evidence/upload?project=${project.id}`} className="btn-primary btn-md">
              <Upload className="h-4 w-4" aria-hidden />
              Upload evidence
            </Link>
          </>
        }
      />

      {!ai.live && (
        <Alert tone="info" className="mb-5">
          Running on the built-in analysis engine. It works fully offline and produces real, explainable results — set{' '}
          <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[12px]">ANTHROPIC_API_KEY</code> to switch to
          the Claude-powered provider for deeper document understanding.
        </Alert>
      )}

      {/* Headline */}
      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <Card className="flex flex-col items-center justify-center py-7">
          <ReadinessRing score={readiness.score} riskLevel={readiness.riskLevel as RiskLevel} />
          {readiness.daysUntilAudit !== null && (
            <Link
              href={`/app/audits/${project.id}/prepare`}
              className="mt-5 flex items-center gap-1.5 text-[13px] font-medium text-kelp-700 hover:underline"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {readiness.daysUntilAudit >= 0
                ? `${readiness.daysUntilAudit} days until audit`
                : `Audit date passed ${Math.abs(readiness.daysUntilAudit)} days ago`}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader
              title="Requirement status"
              description={`${readiness.assessed} of ${readiness.total} requirements assessed · ${AUDIT_TYPE_LABELS[project.auditType as AuditType]}`}
              action={
                <Link href={`/app/requirements?project=${project.id}`} className="btn-secondary btn-sm">
                  View all
                </Link>
              }
            />
            <div className="grid grid-cols-2 divide-ink-200 sm:grid-cols-3 sm:divide-x">
              <StatusTile
                label="Strong"
                value={readiness.counts.SATISFIED}
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-strong-500" />}
                href={`/app/requirements?project=${project.id}&status=SATISFIED`}
              />
              <StatusTile
                label="Needs review"
                value={readiness.counts.NEEDS_REVIEW + readiness.counts.PARTIALLY_SATISFIED}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-caution-500" />}
                href={`/app/requirements?project=${project.id}&status=NEEDS_REVIEW`}
              />
              <StatusTile
                label="Missing"
                value={readiness.counts.MISSING}
                icon={<ShieldAlert className="h-3.5 w-3.5 text-risk-500" />}
                href={`/app/requirements?project=${project.id}&status=MISSING`}
              />
              <StatusTile
                label="Not assessed"
                value={readiness.counts.NOT_ASSESSED}
                icon={<CircleDashed className="h-3.5 w-3.5 text-ink-400" />}
                href={`/app/requirements?project=${project.id}&status=NOT_ASSESSED`}
              />
              <StatusTile
                label="Not applicable"
                value={readiness.counts.NOT_APPLICABLE}
                icon={<CircleDashed className="h-3.5 w-3.5 text-ink-300" />}
                href={`/app/requirements?project=${project.id}&status=NOT_APPLICABLE`}
              />
              <StatusTile
                label="Awaiting review"
                value={pendingLinks}
                icon={<Sparkles className="h-3.5 w-3.5 text-info-500" />}
                href={`/app/matrix?project=${project.id}&review=PENDING`}
                sub="AI matches"
              />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <Stat
                label="Evidence"
                value={readiness.evidence.total}
                sub={`${readiness.evidence.accepted} accepted · ${readiness.evidence.pendingReview} pending`}
              />
            </Card>
            <Card>
              <Stat
                label="Open actions"
                value={readiness.actions.open}
                tone={readiness.actions.overdue > 0 ? 'risk' : 'default'}
                sub={
                  readiness.actions.overdue > 0
                    ? `${readiness.actions.overdue} overdue`
                    : `${readiness.actions.verified} verified`
                }
              />
            </Card>
            <Card>
              <Stat
                label="High-risk gaps"
                value={readiness.gaps.critical + readiness.gaps.high}
                tone={readiness.gaps.critical > 0 ? 'risk' : readiness.gaps.high > 0 ? 'caution' : 'strong'}
                sub={`${readiness.gaps.open} open in total`}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Highest-priority gaps"
            description="What an auditor is most likely to write up."
            action={
              <Link href={`/app/gaps?project=${project.id}`} className="btn-secondary btn-sm">
                Gap Center
              </Link>
            }
          />
          {sortedGaps.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="No open gaps"
              description="Nothing is currently flagged on this project. Upload more evidence to keep the picture accurate."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {sortedGaps.map((gap) => (
                <li key={gap.id}>
                  <Link href={`/app/gaps/${gap.id}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/70">
                    <Badge tone={SEVERITY_META[gap.severity as Severity].tone} size="sm" className="mt-0.5 w-[64px] justify-center">
                      {SEVERITY_META[gap.severity as Severity].label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink-900">{gap.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-500">{gap.description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Your open actions"
              description="Assigned to you on this project."
              action={
                <Link href={`/app/actions?project=${project.id}&owner=me`} className="btn-secondary btn-sm">
                  All actions
                </Link>
              }
            />
            {myActions.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Nothing assigned to you"
                description="When a gap becomes an action assigned to you, it appears here."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {myActions.map((action) => {
                  const overdue = action.dueDate && action.dueDate < new Date();
                  return (
                    <li key={action.id}>
                      <Link href={`/app/actions/${action.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-ink-900">{action.title}</p>
                          <p className="mt-0.5 text-[12px] text-ink-500">{action.reference}</p>
                        </div>
                        <Badge tone={overdue ? 'risk' : 'muted'} size="sm">
                          {action.dueDate ? (overdue ? 'Overdue' : formatDate(action.dueDate)) : 'No due date'}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent evidence"
              action={
                <Link href={`/app/evidence?project=${project.id}`} className="btn-secondary btn-sm">
                  Library
                </Link>
              }
            />
            {recentEvidence.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No evidence yet"
                description="Upload the documents you already have — procedures, records, certificates, spreadsheets."
                action={
                  <Link href={`/app/evidence/upload?project=${project.id}`} className="btn-primary btn-md">
                    <Upload className="h-4 w-4" aria-hidden />
                    Upload evidence
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentEvidence.map((doc) => (
                  <li key={doc.id}>
                    <Link href={`/app/evidence/${doc.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink-900">{doc.title || doc.filename}</p>
                        <p className="mt-0.5 text-[12px] text-ink-500">
                          {doc.uploadedBy.name} · {relativeTime(doc.createdAt)}
                        </p>
                      </div>
                      {doc.analysisStatus === 'COMPLETE' ? (
                        <Badge tone="info" size="sm">
                          Analyzed
                        </Badge>
                      ) : (
                        <Badge tone="muted" size="sm">
                          Not analyzed
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-ink-400">
        Readiness is weighted by requirement importance and reflects only evidence a person has approved.{' '}
        {pendingLinks > 0 && `${pluralize(pendingLinks, 'AI match')} are still awaiting review and do not count yet.`}
      </p>
    </div>
  );
}

function StatusTile({
  label,
  value,
  icon,
  href,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  sub?: string;
}) {
  return (
    <Link href={href} className="px-5 py-3.5 transition-colors hover:bg-ink-50/70">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-ink-500">{label}</span>
      </div>
      <div className="tnum mt-1 text-[22px] font-bold leading-none text-ink-900">{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-400">{sub}</div>}
    </Link>
  );
}

function NoProjects({ orgName }: { orgName: string }) {
  return (
    <div>
      <PageHeader
        title={`Welcome to ${orgName}`}
        description="Create your first audit project to get a readiness score."
      />
      <Card>
        <EmptyState
          icon={<Plus className="h-5 w-5" />}
          title="No audit projects yet"
          description="An audit project holds a framework, its requirements, your evidence and your actions. Most teams start with the audit they have coming up next."
          action={
            <Link href="/app/audits/new" className="btn-primary btn-lg">
              <Plus className="h-4 w-4" aria-hidden />
              Create your first audit project
            </Link>
          }
        />
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: '1. Pick a framework',
            body: 'Start with a bundled demo framework, or build your own from the standard you are licensed to use.',
          },
          {
            title: '2. Upload evidence',
            body: 'Drag in the procedures, records and certificates you already have. Text is extracted automatically.',
          },
          {
            title: '3. Run the analysis',
            body: 'Evidence is matched to requirements, gaps are detected, and you get a readiness score.',
          },
        ].map((step) => (
          <Card key={step.title} className="p-5">
            <h3 className="text-[14px] font-semibold text-ink-900">{step.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{step.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
