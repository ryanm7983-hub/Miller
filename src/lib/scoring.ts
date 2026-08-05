import 'server-only';

import { prisma } from '@/lib/db';
import { OPEN_ACTION_STATUSES, type RequirementStatus, type RiskLevel } from '@/lib/enums';

/**
 * Readiness and risk scoring.
 *
 * Both figures are importance-weighted so a critical requirement with no
 * evidence hurts more than an informational one. Weights live here (not spread
 * through the UI) so the model can be tuned in one place.
 */

export const STATUS_CREDIT: Record<RequirementStatus, number> = {
  SATISFIED: 1,
  PARTIALLY_SATISFIED: 0.6,
  NEEDS_REVIEW: 0.35,
  NOT_ASSESSED: 0,
  MISSING: 0,
  NOT_APPLICABLE: 1, // Excluded from the denominator instead of scored.
};

export interface ReadinessBreakdown {
  score: number;
  riskLevel: RiskLevel;
  riskScore: number;
  total: number;
  assessed: number;
  counts: Record<RequirementStatus, number>;
  weightedTotal: number;
  weightedEarned: number;
  evidence: {
    total: number;
    accepted: number;
    pendingReview: number;
    expired: number;
    expiringSoon: number;
  };
  links: { total: number; pending: number; approved: number; rejected: number };
  actions: { total: number; open: number; overdue: number; verified: number };
  gaps: { total: number; open: number; critical: number; high: number };
  daysUntilAudit: number | null;
}

function emptyCounts(): Record<RequirementStatus, number> {
  return {
    NOT_ASSESSED: 0,
    MISSING: 0,
    NEEDS_REVIEW: 0,
    PARTIALLY_SATISFIED: 0,
    SATISFIED: 0,
    NOT_APPLICABLE: 0,
  };
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

/**
 * Computes readiness + risk for one audit project.
 *
 * Readiness: importance-weighted proportion of applicable requirements with
 * credible evidence. Risk: a 0-100 pressure index combining unmet requirement
 * weight, open critical/high gaps, overdue actions, expired evidence and time
 * remaining before the audit date.
 */
export async function computeProjectReadiness(
  orgId: string,
  projectId: string
): Promise<ReadinessBreakdown> {
  const [project, projectRequirements, evidence, links, actions, gaps] = await Promise.all([
    prisma.auditProject.findFirst({ where: { id: projectId, orgId } }),
    prisma.projectRequirement.findMany({
      where: { projectId, orgId },
      select: { status: true, importanceOverride: true, requirement: { select: { importance: true } } },
    }),
    prisma.evidence.findMany({
      where: { orgId, projectId },
      select: { status: true, expiresAt: true },
    }),
    prisma.evidenceLink.findMany({
      where: { orgId, projectRequirement: { projectId } },
      select: { reviewState: true },
    }),
    prisma.action.findMany({
      where: { orgId, projectId },
      select: { status: true, dueDate: true },
    }),
    prisma.gap.findMany({
      where: { orgId, projectId },
      select: { status: true, severity: true },
    }),
  ]);

  const counts = emptyCounts();
  let weightedTotal = 0;
  let weightedEarned = 0;
  let assessed = 0;

  for (const pr of projectRequirements) {
    const status = pr.status as RequirementStatus;
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === 'NOT_APPLICABLE') continue;

    const weight = pr.importanceOverride ?? pr.requirement.importance ?? 3;
    weightedTotal += weight;
    weightedEarned += weight * (STATUS_CREDIT[status] ?? 0);
    if (status !== 'NOT_ASSESSED') assessed++;
  }

  const score = weightedTotal > 0 ? Math.round((weightedEarned / weightedTotal) * 100) : 0;

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 86_400_000);
  const evidenceStats = {
    total: evidence.length,
    accepted: evidence.filter((e) => e.status === 'ACCEPTED').length,
    pendingReview: evidence.filter((e) => e.status === 'PENDING_REVIEW').length,
    expired: evidence.filter((e) => e.status === 'EXPIRED' || (e.expiresAt && e.expiresAt < now)).length,
    expiringSoon: evidence.filter((e) => e.expiresAt && e.expiresAt >= now && e.expiresAt <= soon).length,
  };

  const openActions = actions.filter((a) => OPEN_ACTION_STATUSES.includes(a.status as never));
  const actionStats = {
    total: actions.length,
    open: openActions.length,
    overdue: openActions.filter((a) => a.dueDate && a.dueDate < now).length,
    verified: actions.filter((a) => a.status === 'VERIFIED').length,
  };

  const openGaps = gaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS');
  const gapStats = {
    total: gaps.length,
    open: openGaps.length,
    critical: openGaps.filter((g) => g.severity === 'CRITICAL').length,
    high: openGaps.filter((g) => g.severity === 'HIGH').length,
  };

  const daysUntilAudit = project?.auditDate
    ? Math.ceil((project.auditDate.getTime() - now.getTime()) / 86_400_000)
    : null;

  // Risk pressure index (0-100).
  let risk = (1 - (weightedTotal > 0 ? weightedEarned / weightedTotal : 0)) * 55;
  risk += Math.min(20, gapStats.critical * 7 + gapStats.high * 3);
  risk += Math.min(12, actionStats.overdue * 4);
  risk += Math.min(8, evidenceStats.expired * 2);
  risk += Math.min(5, evidenceStats.pendingReview * 0.5);

  if (daysUntilAudit !== null) {
    // Time pressure only counts when there is still work outstanding.
    const outstanding = gapStats.open + actionStats.open + counts.MISSING;
    if (outstanding > 0) {
      if (daysUntilAudit <= 7) risk += 12;
      else if (daysUntilAudit <= 21) risk += 8;
      else if (daysUntilAudit <= 45) risk += 4;
    }
  }

  const riskScore = Math.max(0, Math.min(100, Math.round(risk)));

  return {
    score,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    total: projectRequirements.length,
    assessed,
    counts,
    weightedTotal,
    weightedEarned: Math.round(weightedEarned * 10) / 10,
    evidence: evidenceStats,
    links: {
      total: links.length,
      pending: links.filter((l) => l.reviewState === 'PENDING').length,
      approved: links.filter((l) => l.reviewState === 'APPROVED').length,
      rejected: links.filter((l) => l.reviewState === 'REJECTED').length,
    },
    actions: actionStats,
    gaps: gapStats,
    daysUntilAudit,
  };
}

/** Recomputes and caches the project's readiness figures. */
export async function recomputeProjectScores(orgId: string, projectId: string) {
  const breakdown = await computeProjectReadiness(orgId, projectId);
  await prisma.auditProject.updateMany({
    where: { id: projectId, orgId },
    data: {
      readinessScore: breakdown.score,
      riskLevel: breakdown.riskLevel,
      scoredAt: new Date(),
    },
  });
  return breakdown;
}

/**
 * Derives a requirement's status from its approved evidence links.
 * Human overrides (statusSource === 'HUMAN') are never touched.
 */
export function deriveRequirementStatus(links: Array<{
  reviewState: string;
  strength: string;
  relevance: number;
}>): RequirementStatus {
  if (links.length === 0) return 'MISSING';

  const approved = links.filter((l) => l.reviewState === 'APPROVED');
  if (approved.length === 0) {
    return links.some((l) => l.reviewState === 'PENDING') ? 'NEEDS_REVIEW' : 'MISSING';
  }

  const strong = approved.filter((l) => l.strength === 'STRONG');
  const partial = approved.filter((l) => l.strength === 'PARTIAL');

  if (strong.length > 0) {
    // A strong approved link plus no unreviewed noise reads as satisfied.
    const unreviewed = links.filter((l) => l.reviewState === 'PENDING').length;
    return unreviewed > 0 ? 'PARTIALLY_SATISFIED' : 'SATISFIED';
  }
  if (partial.length > 0) return 'PARTIALLY_SATISFIED';
  return 'NEEDS_REVIEW';
}
