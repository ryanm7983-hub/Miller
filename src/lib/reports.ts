import 'server-only';

import { prisma } from '@/lib/db';
import { computeProjectReadiness } from '@/lib/scoring';
import { buildPreparationPlan } from '@/lib/prepare';
import { aiProviderLabel } from '@/lib/ai';
import { AI_DISCLAIMER, GAP_TYPE_LABELS, type GapType } from '@/lib/enums';

/**
 * Report payloads are immutable snapshots.
 *
 * Everything the report shows is captured at generation time and stored as
 * JSON, so a report from three months ago still renders exactly as it did —
 * even after the underlying gaps have been resolved and the data has moved on.
 */
export interface ReportPayload {
  version: 1;
  generatedAt: string;
  organization: { name: string; industry: string | null; country: string | null };
  project: {
    id: string;
    name: string;
    auditType: string;
    scope: string | null;
    auditDate: string | null;
    daysUntilAudit: number | null;
    framework: string;
    frameworkVersion: string;
  };
  readiness: {
    score: number;
    riskLevel: string;
    riskScore: number;
    total: number;
    assessed: number;
    counts: Record<string, number>;
  };
  evidence: { total: number; accepted: number; pendingReview: number; expired: number; expiringSoon: number };
  links: { total: number; approved: number; pending: number; rejected: number };
  actions: { total: number; open: number; overdue: number; verified: number };
  majorGaps: Array<{
    title: string;
    description: string;
    severity: string;
    type: string;
    typeLabel: string;
    requirement: string | null;
    status: string;
    owner: string | null;
    dueDate: string | null;
  }>;
  requirementsNeedingReview: Array<{ identifier: string; title: string; status: string; owner: string | null }>;
  openActions: Array<{
    reference: string;
    title: string;
    owner: string | null;
    dueDate: string | null;
    priority: string;
    status: string;
    overdue: boolean;
  }>;
  recommendations: string[];
  aiProvider: { name: string; model: string; live: boolean };
  disclaimer: string;
}

export async function buildReportPayload(orgId: string, projectId: string): Promise<ReportPayload> {
  const now = new Date();

  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId },
    include: { frameworkVersion: { include: { framework: true } }, org: true },
  });
  if (!project) throw new Error('That audit project could not be found.');

  const [readiness, gaps, needingReview, openActions, plan] = await Promise.all([
    computeProjectReadiness(orgId, projectId),
    prisma.gap.findMany({
      where: { orgId, projectId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      include: {
        projectRequirement: { include: { requirement: { select: { identifier: true, title: true } } } },
        owner: { select: { name: true } },
      },
      take: 60,
    }),
    prisma.projectRequirement.findMany({
      where: { orgId, projectId, status: { in: ['NEEDS_REVIEW', 'PARTIALLY_SATISFIED', 'MISSING', 'NOT_ASSESSED'] } },
      include: { requirement: { select: { identifier: true, title: true } }, owner: { select: { name: true } } },
      orderBy: { requirement: { sortOrder: 'asc' } },
      take: 80,
    }),
    prisma.action.findMany({
      where: { orgId, projectId, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } },
      include: { owner: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }],
      take: 60,
    }),
    buildPreparationPlan(orgId, projectId),
  ]);

  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedGaps = [...gaps].sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  return {
    version: 1,
    generatedAt: now.toISOString(),
    organization: {
      name: project.org.name,
      industry: project.org.industry,
      country: project.org.country,
    },
    project: {
      id: project.id,
      name: project.name,
      auditType: project.auditType,
      scope: project.scope,
      auditDate: project.auditDate?.toISOString() ?? null,
      daysUntilAudit: readiness.daysUntilAudit,
      framework: project.frameworkVersion.framework.name,
      frameworkVersion: project.frameworkVersion.version,
    },
    readiness: {
      score: readiness.score,
      riskLevel: readiness.riskLevel,
      riskScore: readiness.riskScore,
      total: readiness.total,
      assessed: readiness.assessed,
      counts: readiness.counts,
    },
    evidence: readiness.evidence,
    links: readiness.links,
    actions: readiness.actions,
    majorGaps: sortedGaps.map((gap) => ({
      title: gap.title,
      description: gap.description,
      severity: gap.severity,
      type: gap.type,
      typeLabel: GAP_TYPE_LABELS[gap.type as GapType] ?? gap.type,
      requirement: gap.projectRequirement
        ? `${gap.projectRequirement.requirement.identifier} — ${gap.projectRequirement.requirement.title}`
        : null,
      status: gap.status,
      owner: gap.owner?.name ?? null,
      dueDate: gap.dueDate?.toISOString() ?? null,
    })),
    requirementsNeedingReview: needingReview.map((r) => ({
      identifier: r.requirement.identifier,
      title: r.requirement.title,
      status: r.status,
      owner: r.owner?.name ?? null,
    })),
    openActions: openActions.map((a) => ({
      reference: a.reference,
      title: a.title,
      owner: a.owner?.name ?? null,
      dueDate: a.dueDate?.toISOString() ?? null,
      priority: a.priority,
      status: a.status,
      overdue: !!(a.dueDate && a.dueDate < now),
    })),
    recommendations: buildRecommendations(readiness, plan.top.length, sortedGaps.length),
    aiProvider: aiProviderLabel(),
    disclaimer: AI_DISCLAIMER,
  };
}

function buildRecommendations(
  readiness: Awaited<ReturnType<typeof computeProjectReadiness>>,
  topCount: number,
  gapCount: number
): string[] {
  const recommendations: string[] = [];

  if (readiness.counts.MISSING > 0) {
    recommendations.push(
      `Close the ${readiness.counts.MISSING} requirement${readiness.counts.MISSING === 1 ? '' : 's'} with no sufficient evidence. These are the findings an auditor is most likely to raise, and each one is a direct hit to the readiness score.`
    );
  }
  if (readiness.links.pending > 0) {
    recommendations.push(
      `Review the ${readiness.links.pending} suggested evidence match${readiness.links.pending === 1 ? '' : 'es'} awaiting human confirmation. Suggested matches do not count toward readiness until a person approves them, so this is usually the fastest score improvement available.`
    );
  }
  if (readiness.gaps.critical > 0 || readiness.gaps.high > 0) {
    recommendations.push(
      `Prioritise the ${readiness.gaps.critical} critical and ${readiness.gaps.high} high-severity gaps. Convert each into an owned action with a due date before the audit rather than tracking them informally.`
    );
  }
  if (readiness.actions.overdue > 0) {
    recommendations.push(
      `Resolve or re-plan the ${readiness.actions.overdue} overdue action${readiness.actions.overdue === 1 ? '' : 's'}. Overdue corrective actions are themselves a common audit finding, independent of the issue they were raised for.`
    );
  }
  if (readiness.evidence.expired > 0) {
    recommendations.push(
      `Replace the ${readiness.evidence.expired} expired evidence item${readiness.evidence.expired === 1 ? '' : 's'} currently in the library. Expired records linked to a requirement can be worse than no record at all.`
    );
  }
  if (readiness.evidence.expiringSoon > 0) {
    recommendations.push(
      `Schedule renewal for the ${readiness.evidence.expiringSoon} document${readiness.evidence.expiringSoon === 1 ? '' : 's'} expiring within 60 days so nothing lapses between now and the audit.`
    );
  }
  if (readiness.counts.NOT_ASSESSED > 0) {
    recommendations.push(
      `Assess the ${readiness.counts.NOT_ASSESSED} requirement${readiness.counts.NOT_ASSESSED === 1 ? '' : 's'} not yet looked at. Marking one not applicable with a written justification is a valid and quick outcome.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'No outstanding gaps, overdue actions or unreviewed matches were identified at the time this report was generated. Continue to keep evidence current and re-run detection after each upload.'
    );
  }
  if (topCount > 0 && gapCount > 0) {
    recommendations.push(
      'Work the prioritised list in Audit Preparation rather than the raw gap list — it weights each item by impact, urgency and effort so the highest-value work happens first.'
    );
  }

  return recommendations;
}
