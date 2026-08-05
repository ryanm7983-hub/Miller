import 'server-only';

import { prisma } from '@/lib/db';
import { OPEN_ACTION_STATUSES, SEVERITY_META, type Severity } from '@/lib/enums';

/**
 * Audit preparation planning.
 *
 * Produces a ranked priority list from everything outstanding on a project.
 * The score blends impact (severity and requirement importance), urgency
 * (due dates and days remaining) and effort (cheap wins rank above expensive
 * ones at equal impact), so the list is genuinely actionable rather than just
 * "everything, sorted by severity".
 */

export type PriorityKind = 'GAP' | 'ACTION' | 'REVIEW' | 'REQUIREMENT';

export interface PriorityItem {
  id: string;
  kind: PriorityKind;
  title: string;
  detail: string;
  href: string;
  score: number;
  impact: number;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  severity?: Severity;
  dueDate?: Date | null;
  owner?: string | null;
}

const SEVERITY_IMPACT: Record<string, number> = { CRITICAL: 40, HIGH: 26, MEDIUM: 14, LOW: 6 };

export async function buildPreparationPlan(orgId: string, projectId: string) {
  const now = new Date();

  const [project, gaps, actions, pendingLinks, unassessed] = await Promise.all([
    prisma.auditProject.findFirst({ where: { id: projectId, orgId } }),
    prisma.gap.findMany({
      where: { orgId, projectId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      include: {
        projectRequirement: { include: { requirement: { select: { identifier: true, importance: true } } } },
        owner: { select: { name: true } },
      },
    }),
    prisma.action.findMany({
      where: { orgId, projectId, status: { in: OPEN_ACTION_STATUSES } },
      include: { owner: { select: { name: true } } },
    }),
    prisma.evidenceLink.findMany({
      where: { orgId, reviewState: 'PENDING', projectRequirement: { projectId } },
      include: {
        projectRequirement: { include: { requirement: { select: { identifier: true, title: true, importance: true } } } },
      },
    }),
    prisma.projectRequirement.findMany({
      where: { orgId, projectId, status: 'NOT_ASSESSED' },
      include: { requirement: { select: { identifier: true, title: true, importance: true } } },
    }),
  ]);

  const daysUntilAudit = project?.auditDate
    ? Math.ceil((project.auditDate.getTime() - now.getTime()) / 86_400_000)
    : null;

  // Urgency multiplier: work matters more when the audit is close.
  const urgency = daysUntilAudit === null ? 1 : daysUntilAudit <= 7 ? 1.6 : daysUntilAudit <= 21 ? 1.35 : daysUntilAudit <= 45 ? 1.15 : 1;

  const items: PriorityItem[] = [];

  for (const gap of gaps) {
    const importance = gap.projectRequirement?.requirement.importance ?? 3;
    const impact = (SEVERITY_IMPACT[gap.severity] ?? 10) + importance * 2;
    const overdueBoost = gap.dueDate && gap.dueDate < now ? 12 : 0;
    // Gaps of these types are usually a quick administrative fix.
    const effort: PriorityItem['effort'] =
      ['MISSING_OWNER', 'MISSING_REVISION', 'UNREVIEWED_EVIDENCE', 'EXPIRING_SOON'].includes(gap.type)
        ? 'LOW'
        : ['NO_EVIDENCE', 'MISSING_DOCUMENT', 'CONFLICTING_DOCUMENTS'].includes(gap.type)
          ? 'HIGH'
          : 'MEDIUM';
    const effortBonus = effort === 'LOW' ? 6 : effort === 'MEDIUM' ? 2 : 0;

    items.push({
      id: gap.id,
      kind: 'GAP',
      title: gap.title,
      detail: gap.description,
      href: `/app/gaps/${gap.id}`,
      impact,
      score: (impact + overdueBoost + effortBonus) * urgency,
      effort,
      severity: gap.severity as Severity,
      dueDate: gap.dueDate,
      owner: gap.owner?.name ?? null,
    });
  }

  for (const action of actions) {
    const overdue = action.dueDate && action.dueDate < now;
    const impact = (SEVERITY_IMPACT[action.priority] ?? 10) + (overdue ? 16 : 0) + (action.status === 'BLOCKED' ? 8 : 0);
    items.push({
      id: action.id,
      kind: 'ACTION',
      title: action.title,
      detail: overdue
        ? `Overdue since ${action.dueDate?.toISOString().slice(0, 10)}. ${action.owner?.name ?? 'Nobody'} owns it.`
        : `${action.status.replace('_', ' ').toLowerCase()} · ${action.owner?.name ?? 'unassigned'}`,
      href: `/app/actions/${action.id}`,
      impact,
      score: impact * urgency,
      effort: 'MEDIUM',
      severity: action.priority as Severity,
      dueDate: action.dueDate,
      owner: action.owner?.name ?? null,
    });
  }

  // Group pending AI matches by requirement: reviewing them is cheap and
  // directly converts into readiness.
  const byRequirement = new Map<string, { identifier: string; title: string; importance: number; count: number; prId: string }>();
  for (const link of pendingLinks) {
    const key = link.projectRequirementId;
    const current = byRequirement.get(key);
    if (current) current.count++;
    else
      byRequirement.set(key, {
        identifier: link.projectRequirement.requirement.identifier,
        title: link.projectRequirement.requirement.title,
        importance: link.projectRequirement.requirement.importance,
        count: 1,
        prId: link.projectRequirementId,
      });
  }

  for (const entry of byRequirement.values()) {
    const impact = 10 + entry.importance * 3 + Math.min(entry.count * 2, 8);
    items.push({
      id: entry.prId,
      kind: 'REVIEW',
      title: `Review ${entry.count} suggested match${entry.count === 1 ? '' : 'es'} on ${entry.identifier}`,
      detail: `${entry.title} — approving verified evidence is the fastest way to move the readiness score.`,
      href: `/app/requirements/${entry.prId}`,
      impact,
      score: (impact + 8) * urgency,
      effort: 'LOW',
    });
  }

  for (const requirement of unassessed) {
    const impact = 8 + requirement.requirement.importance * 3;
    items.push({
      id: requirement.id,
      kind: 'REQUIREMENT',
      title: `Assess ${requirement.requirement.identifier} — ${requirement.requirement.title}`,
      detail: 'This requirement has not been looked at yet. Even marking it not applicable, with a justification, is progress.',
      href: `/app/requirements/${requirement.id}`,
      impact,
      score: impact * urgency,
      effort: 'MEDIUM',
    });
  }

  items.sort((a, b) => b.score - a.score);

  return {
    project,
    daysUntilAudit,
    items,
    top: items.slice(0, 10),
    totals: {
      gaps: gaps.length,
      actions: actions.length,
      pendingReviews: pendingLinks.length,
      unassessed: unassessed.length,
    },
  };
}

export function effortLabel(effort: PriorityItem['effort']): string {
  return effort === 'LOW' ? 'Quick win' : effort === 'MEDIUM' ? 'Moderate' : 'Significant';
}

export function severityTone(severity?: Severity) {
  return severity ? SEVERITY_META[severity].tone : 'neutral';
}
