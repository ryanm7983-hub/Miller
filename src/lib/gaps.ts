import 'server-only';

import crypto from 'node:crypto';

import { prisma } from '@/lib/db';
import type { GapType, Severity } from '@/lib/enums';

/**
 * Gap detection.
 *
 * Runs across a whole project and produces a de-duplicated set of findings.
 * Each gap carries a stable `fingerprint` so a re-run updates the existing row
 * (preserving human status changes) instead of creating duplicates, and so
 * gaps that no longer apply can be auto-resolved.
 */

export interface DetectedGap {
  type: GapType;
  severity: Severity;
  title: string;
  description: string;
  recommendation?: string;
  projectRequirementId?: string | null;
  evidenceId?: string | null;
  department?: string | null;
  detectedBy?: 'SYSTEM' | 'AI';
}

export function fingerprint(parts: Array<string | null | undefined>): string {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 24);
}

const EXPIRY_WARNING_DAYS = 45;

export async function detectProjectGaps(orgId: string, projectId: string): Promise<DetectedGap[]> {
  const now = new Date();
  const warnBy = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

  const [projectRequirements, evidence, actions] = await Promise.all([
    prisma.projectRequirement.findMany({
      where: { orgId, projectId },
      include: {
        requirement: { select: { identifier: true, title: true, importance: true } },
        links: { select: { reviewState: true, strength: true, relevance: true } },
      },
    }),
    prisma.evidence.findMany({
      where: { orgId, projectId },
      select: {
        id: true,
        title: true,
        filename: true,
        status: true,
        expiresAt: true,
        effectiveDate: true,
        revision: true,
        ownerUserId: true,
        department: true,
        documentType: true,
        extractionStatus: true,
        analysisStatus: true,
        createdAt: true,
        _count: { select: { links: true } },
      },
    }),
    prisma.action.findMany({
      where: { orgId, projectId },
      select: { id: true, title: true, status: true, dueDate: true, department: true },
    }),
  ]);

  const gaps: DetectedGap[] = [];
  const importanceToSeverity = (importance: number): Severity =>
    importance >= 5 ? 'CRITICAL' : importance >= 4 ? 'HIGH' : importance >= 3 ? 'MEDIUM' : 'LOW';

  // ----- Requirement-level -------------------------------------------------
  for (const pr of projectRequirements) {
    if (pr.status === 'NOT_APPLICABLE') continue;
    const ref = `${pr.requirement.identifier} — ${pr.requirement.title}`;

    if (pr.links.length === 0) {
      gaps.push({
        type: 'NO_EVIDENCE',
        severity: importanceToSeverity(pr.importanceOverride ?? pr.requirement.importance),
        title: `No evidence linked to ${pr.requirement.identifier}`,
        description: `${ref} has no evidence associated with it. An auditor will ask what demonstrates this requirement is met.`,
        recommendation: 'Upload the relevant record or document, or mark the requirement as not applicable with a justification.',
        projectRequirementId: pr.id,
        department: pr.department,
      });
      continue;
    }

    const pending = pr.links.filter((l) => l.reviewState === 'PENDING');
    if (pending.length > 0) {
      gaps.push({
        type: 'UNREVIEWED_EVIDENCE',
        severity: pending.length > 2 ? 'MEDIUM' : 'LOW',
        title: `${pending.length} suggested match${pending.length === 1 ? '' : 'es'} awaiting review on ${pr.requirement.identifier}`,
        description: `The AI has suggested evidence for ${ref} but nobody has confirmed it yet. Suggested matches do not count toward readiness until a person approves them.`,
        recommendation: 'Open the requirement and approve or reject each suggested match.',
        projectRequirementId: pr.id,
        department: pr.department,
      });
    }

    const approved = pr.links.filter((l) => l.reviewState === 'APPROVED');
    if (approved.length > 0 && approved.every((l) => l.strength === 'WEAK')) {
      gaps.push({
        type: 'WEAK_EVIDENCE',
        severity: 'MEDIUM',
        title: `Evidence for ${pr.requirement.identifier} looks thin`,
        description: `All approved evidence for ${ref} was assessed as weak. It may not stand up to questioning.`,
        recommendation: 'Add a stronger primary record, or add context notes explaining how the existing evidence demonstrates the requirement.',
        projectRequirementId: pr.id,
        department: pr.department,
      });
    }

    if (!pr.ownerUserId) {
      gaps.push({
        type: 'MISSING_OWNER',
        severity: 'LOW',
        title: `No owner assigned to ${pr.requirement.identifier}`,
        description: `Nobody in your organization is accountable for ${ref}. Unowned requirements are the ones that slip.`,
        recommendation: 'Assign an owner so questions and follow-ups have a clear destination.',
        projectRequirementId: pr.id,
      });
    }
  }

  // ----- Evidence-level ----------------------------------------------------
  const byTypeAndDept = new Map<string, typeof evidence>();

  for (const doc of evidence) {
    const label = doc.title || doc.filename;

    if (doc.expiresAt && doc.expiresAt < now) {
      const days = Math.floor((now.getTime() - doc.expiresAt.getTime()) / 86_400_000);
      gaps.push({
        type: 'EXPIRED_DOCUMENT',
        severity: days > 90 ? 'CRITICAL' : 'HIGH',
        title: `“${label}” expired ${days} day${days === 1 ? '' : 's'} ago`,
        description: `This evidence expired on ${doc.expiresAt.toISOString().slice(0, 10)} and no longer supports any requirement it is linked to.`,
        recommendation: 'Replace it with the current version and supersede the expired record.',
        evidenceId: doc.id,
        department: doc.department,
      });
    } else if (doc.expiresAt && doc.expiresAt <= warnBy) {
      const days = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 86_400_000);
      gaps.push({
        type: 'EXPIRING_SOON',
        severity: days <= 14 ? 'MEDIUM' : 'LOW',
        title: `“${label}” expires in ${days} day${days === 1 ? '' : 's'}`,
        description: `This evidence expires on ${doc.expiresAt.toISOString().slice(0, 10)}. Renew it before the audit so you are not explaining an expired record on the day.`,
        recommendation: 'Schedule the renewal now and upload the replacement when it is available.',
        evidenceId: doc.id,
        department: doc.department,
      });
    }

    if (doc._count.links === 0) {
      gaps.push({
        type: 'MISSING_DOCUMENT',
        severity: 'LOW',
        title: `“${label}” is not linked to any requirement`,
        description: 'This document is in the library but does not support any requirement, so it contributes nothing to your readiness score.',
        recommendation: 'Link it to the requirements it supports, or archive it if it is background material.',
        evidenceId: doc.id,
        department: doc.department,
      });
    }

    if (['policy', 'procedure', 'work_instruction'].includes(doc.documentType) && !doc.revision) {
      gaps.push({
        type: 'MISSING_REVISION',
        severity: 'MEDIUM',
        title: `“${label}” has no revision recorded`,
        description: 'Controlled documents need a revision or version so you can prove people are working to the current issue.',
        recommendation: 'Record the revision on the evidence record and confirm it matches the document itself.',
        evidenceId: doc.id,
        department: doc.department,
      });
    }

    if (!doc.ownerUserId) {
      gaps.push({
        type: 'MISSING_OWNER',
        severity: 'LOW',
        title: `“${label}” has no owner`,
        description: 'No person is responsible for keeping this evidence current.',
        recommendation: 'Assign an owner from your team.',
        evidenceId: doc.id,
        department: doc.department,
      });
    }

    if (doc.extractionStatus === 'FAILED' || doc.extractionStatus === 'UNSUPPORTED') {
      gaps.push({
        type: 'INCOMPLETE_RECORD',
        severity: 'LOW',
        title: `“${label}” could not be read automatically`,
        description: 'No searchable text could be extracted, so this document has not been analysed and will not appear in search results.',
        recommendation: 'Upload a text-based version, enable OCR, or summarise the content in the notes field.',
        evidenceId: doc.id,
        department: doc.department,
      });
    }

    if (doc.effectiveDate) {
      const ageDays = Math.floor((now.getTime() - doc.effectiveDate.getTime()) / 86_400_000);
      if (ageDays > 1095) {
        gaps.push({
          type: 'OUTDATED_EVIDENCE',
          severity: 'MEDIUM',
          title: `“${label}” is over three years old`,
          description: `The effective date is ${doc.effectiveDate.toISOString().slice(0, 10)}. Evidence this old is usually challenged.`,
          recommendation: 'Confirm it is still current or replace it with a recent record.',
          evidenceId: doc.id,
          department: doc.department,
        });
      }
    }

    const key = `${doc.documentType}::${doc.department ?? 'none'}`;
    const bucket = byTypeAndDept.get(key) ?? [];
    bucket.push(doc);
    byTypeAndDept.set(key, bucket);
  }

  // Conflicting documents: several current documents of the same controlled
  // type in the same department is a classic "which one is the real one?" find.
  for (const [key, docs] of byTypeAndDept) {
    const [type] = key.split('::');
    if (!['policy', 'procedure', 'work_instruction'].includes(type)) continue;
    const current = docs.filter((d) => d.status !== 'SUPERSEDED' && d.status !== 'REJECTED');
    if (current.length >= 3) {
      gaps.push({
        type: 'CONFLICTING_DOCUMENTS',
        severity: 'MEDIUM',
        title: `${current.length} current ${type.replace('_', ' ')} documents in the same area`,
        description: `There are ${current.length} active documents of the same type${docs[0].department ? ` in ${docs[0].department}` : ''}: ${current
          .slice(0, 4)
          .map((d) => `“${d.title || d.filename}”`)
          .join(', ')}. If they overlap, an auditor will ask which one people actually follow.`,
        recommendation: 'Confirm each one has a distinct scope, or supersede the ones that are no longer used.',
        department: docs[0].department,
      });
    }
  }

  // ----- Action-level ------------------------------------------------------
  for (const action of actions) {
    if (action.status === 'COMPLETE' || action.status === 'VERIFIED') continue;
    if (action.dueDate && action.dueDate < now) {
      const days = Math.floor((now.getTime() - action.dueDate.getTime()) / 86_400_000);
      gaps.push({
        type: 'OVERDUE_ACTION',
        severity: days > 30 ? 'HIGH' : 'MEDIUM',
        title: `Action overdue by ${days} day${days === 1 ? '' : 's'}: ${action.title}`,
        description: `This action was due on ${action.dueDate.toISOString().slice(0, 10)} and is still ${action.status.toLowerCase().replace('_', ' ')}.`,
        recommendation: 'Complete it, reassign it, or agree a new due date with the owner.',
        department: action.department,
      });
    } else if (action.status === 'BLOCKED') {
      gaps.push({
        type: 'UNRESOLVED_ACTION',
        severity: 'MEDIUM',
        title: `Action blocked: ${action.title}`,
        description: 'This action is marked blocked. Blocked work does not resolve itself before an audit.',
        recommendation: 'Identify what is blocking it and escalate to whoever can unblock it.',
        department: action.department,
      });
    }
  }

  return gaps;
}

/**
 * Persists detected gaps.
 *
 * - New findings are inserted.
 * - Findings that already exist keep their human-set status, owner and due date
 *   but get refreshed text and severity.
 * - Previously-open system gaps that are no longer detected are auto-resolved.
 */
export async function syncProjectGaps(orgId: string, projectId: string) {
  const detected = await detectProjectGaps(orgId, projectId);
  const existing = await prisma.gap.findMany({ where: { orgId, projectId } });
  const existingByFingerprint = new Map(existing.map((g) => [g.fingerprint, g]));

  const seen = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const gap of detected) {
    const fp = fingerprint([gap.type, gap.projectRequirementId, gap.evidenceId, gap.title]);
    if (seen.has(fp)) continue;
    seen.add(fp);

    const current = existingByFingerprint.get(fp);
    if (current) {
      if (current.status === 'RESOLVED') {
        // The condition came back — reopen it.
        await prisma.gap.update({
          where: { id: current.id },
          data: { status: 'OPEN', resolvedAt: null, description: gap.description, severity: gap.severity },
        });
        updated++;
      } else if (current.description !== gap.description || current.severity !== gap.severity) {
        await prisma.gap.update({
          where: { id: current.id },
          data: { description: gap.description, severity: gap.severity, title: gap.title },
        });
        updated++;
      }
      continue;
    }

    await prisma.gap.create({
      data: {
        orgId,
        projectId,
        projectRequirementId: gap.projectRequirementId ?? null,
        evidenceId: gap.evidenceId ?? null,
        type: gap.type,
        severity: gap.severity,
        title: gap.title,
        description: gap.description,
        recommendation: gap.recommendation,
        detectedBy: gap.detectedBy ?? 'SYSTEM',
        department: gap.department ?? null,
        fingerprint: fp,
      },
    });
    created++;
  }

  // Auto-resolve system-detected gaps whose condition has cleared.
  const stale = existing.filter(
    (g) => g.detectedBy !== 'HUMAN' && !seen.has(g.fingerprint) && (g.status === 'OPEN' || g.status === 'IN_PROGRESS')
  );
  if (stale.length > 0) {
    await prisma.gap.updateMany({
      where: { id: { in: stale.map((g) => g.id) } },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  return { created, updated, resolved: stale.length, total: seen.size };
}
