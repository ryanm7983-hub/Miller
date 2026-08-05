'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { assertWithinLimit } from '@/lib/billing';
import { recordAudit } from '@/lib/audit-log';
import { consume, LIMITS } from '@/lib/rate-limit';
import { storage, validateUpload, buildStorageKey, sanitizeFilename } from '@/lib/storage';
import { extractDocumentText } from '@/lib/documents/extract';
import { ai, recordAssessment, type RequirementRef } from '@/lib/ai';
import { parseTags, stringifyJson } from '@/lib/json';
import { deriveRequirementStatus, recomputeProjectScores } from '@/lib/scoring';
import { syncProjectGaps, fingerprint } from '@/lib/gaps';
import { notify, notifyRoles } from '@/lib/notifications';
import { DOCUMENT_TYPES, EVIDENCE_STATUSES } from '@/lib/enums';
import { toFormError } from '@/lib/errors';

export interface EvidenceFormState {
  error?: string;
  success?: string;
  uploadedIds?: string[];
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T09:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ------------------------------------------------------------------ upload */

export async function uploadEvidenceAction(
  _prev: EvidenceFormState,
  formData: FormData
): Promise<EvidenceFormState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'evidence:upload');

    const limit = consume(`upload:${tenant.orgId}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
    if (!limit.ok) {
      return { error: `Too many uploads in a short period. Try again in ${limit.retryAfterSeconds} seconds.` };
    }

    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { error: 'Choose at least one file to upload.' };

    const projectId = String(formData.get('projectId') ?? '') || null;
    if (projectId) {
      const project = await prisma.auditProject.findFirst({
        where: { id: projectId, orgId: tenant.orgId },
        select: { id: true },
      });
      if (!project) return { error: 'That audit project could not be found.' };
    }

    const department = String(formData.get('department') ?? '') || null;
    const documentTypeInput = String(formData.get('documentType') ?? '');
    const documentType = DOCUMENT_TYPES.includes(documentTypeInput as never) ? documentTypeInput : null;
    const tags = String(formData.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    const expiresAt = parseDate(String(formData.get('expiresAt') ?? ''));
    const effectiveDate = parseDate(String(formData.get('effectiveDate') ?? ''));

    const uploadedIds: string[] = [];
    const failures: string[] = [];

    for (const file of files) {
      const validation = validateUpload({ name: file.name, type: file.type, size: file.size });
      if (!validation.ok) {
        failures.push(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        await assertWithinLimit(tenant.orgId, 'evidenceItems');
      } catch (error) {
        failures.push(toFormError(error));
        break;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = sanitizeFilename(file.name);
      const key = buildStorageKey(tenant.orgId, filename);
      const stored = await storage().put(key, buffer, validation.mimeType);

      // Extract text synchronously: the user is waiting and it is what makes
      // the document searchable and analysable.
      const extraction = await extractDocumentText(buffer, validation.mimeType);

      const evidence = await prisma.evidence.create({
        data: {
          orgId: tenant.orgId,
          projectId,
          title: filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || filename,
          filename,
          storageKey: stored.key,
          mimeType: validation.mimeType,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          documentType: documentType ?? 'other',
          department,
          tags: stringifyJson(tags),
          expiresAt,
          effectiveDate,
          uploadedById: tenant.user.id,
          ownerUserId: tenant.user.id,
          extractedText: extraction.text || null,
          extractionStatus: extraction.status,
          extractionNote: extraction.note,
          ocrUsed: extraction.ocrUsed,
          pageCount: extraction.pageCount,
          status: 'PENDING_REVIEW',
        },
      });

      uploadedIds.push(evidence.id);

      await recordAudit({
        orgId: tenant.orgId,
        userId: tenant.user.id,
        action: 'evidence.uploaded',
        entityType: 'Evidence',
        entityId: evidence.id,
        metadata: { filename, sizeBytes: stored.sizeBytes, extraction: extraction.status },
      });
    }

    if (uploadedIds.length === 0) {
      return { error: failures.join(' ') || 'No files could be uploaded.' };
    }

    if (projectId) {
      await notifyRoles({
        orgId: tenant.orgId,
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
        type: 'DOCUMENT_UPLOADED',
        title: `${uploadedIds.length} document${uploadedIds.length === 1 ? '' : 's'} uploaded by ${tenant.user.name}`,
        body: 'New evidence is ready for analysis and review.',
        link: `/app/evidence?project=${projectId}`,
        excludeUserId: tenant.user.id,
      });
      await syncProjectGaps(tenant.orgId, projectId);
    }

    revalidatePath('/app', 'layout');

    return {
      success:
        failures.length > 0
          ? `Uploaded ${uploadedIds.length} file(s). ${failures.length} failed: ${failures.join(' ')}`
          : `Uploaded ${uploadedIds.length} file(s).`,
      uploadedIds,
    };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/* ---------------------------------------------------------------- analysis */

/**
 * Runs AI analysis on one evidence item and writes the resulting requirement
 * links, gaps and metadata suggestions.
 *
 * Links created here are always PENDING: they suggest, they do not decide.
 */
export async function analyzeEvidenceAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'ai:run');

  const limit = consume(`ai:${tenant.orgId}`, LIMITS.aiAnalysis.limit, LIMITS.aiAnalysis.windowMs);
  if (!limit.ok) {
    throw new Error(`AI analysis is rate limited. Try again in ${limit.retryAfterSeconds} seconds.`);
  }

  const evidenceId = String(formData.get('evidenceId') ?? '');
  const projectId = await analyzeEvidence(tenant.orgId, tenant.user.id, evidenceId);

  // Re-detect gaps so findings the analysis has just resolved (for example
  // "not linked to any requirement") disappear straight away.
  if (projectId) {
    await syncProjectGaps(tenant.orgId, projectId);
    await recomputeProjectScores(tenant.orgId, projectId);
  }

  revalidatePath('/app', 'layout');
}

/** Analyzes every not-yet-analyzed document on a project. */
export async function analyzeProjectEvidenceAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'ai:run');

  const limit = consume(`ai-batch:${tenant.orgId}`, LIMITS.aiHeavy.limit, LIMITS.aiHeavy.windowMs);
  if (!limit.ok) {
    throw new Error(`Batch analysis is rate limited. Try again in ${limit.retryAfterSeconds} seconds.`);
  }

  const projectId = String(formData.get('projectId') ?? '');
  const project = await prisma.auditProject.findFirst({
    where: { id: projectId, orgId: tenant.orgId },
    select: { id: true },
  });
  if (!project) throw new Error('That audit project could not be found.');

  const pending = await prisma.evidence.findMany({
    where: {
      orgId: tenant.orgId,
      projectId: project.id,
      analysisStatus: { in: ['NOT_ANALYZED', 'FAILED'] },
      extractionStatus: { in: ['COMPLETE', 'PARTIAL'] },
    },
    select: { id: true },
    take: 40,
  });

  for (const doc of pending) {
    await analyzeEvidence(tenant.orgId, tenant.user.id, doc.id).catch((error) => {
      console.error('[analyze] failed for', doc.id, error);
    });
  }

  await syncProjectGaps(tenant.orgId, project.id);
  await recomputeProjectScores(tenant.orgId, project.id);

  await notify({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    type: 'ANALYSIS_COMPLETE',
    title: `Analysis complete for ${pending.length} document${pending.length === 1 ? '' : 's'}`,
    body: 'Suggested requirement matches are waiting for your review in the matrix.',
    link: `/app/matrix?project=${project.id}&review=PENDING`,
  });

  revalidatePath('/app', 'layout');
}

async function analyzeEvidence(orgId: string, userId: string, evidenceId: string): Promise<string | null> {
  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, orgId },
    include: {
      project: { include: { frameworkVersion: { include: { framework: true } } } },
      org: { select: { name: true } },
    },
  });
  if (!evidence) throw new Error('That document could not be found in this organization.');

  if (!evidence.projectId || !evidence.project) {
    throw new Error('Assign this document to an audit project before analysing it.');
  }
  if (!evidence.extractedText || evidence.extractedText.trim().length === 0) {
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: { analysisStatus: 'FAILED', analyzedAt: new Date() },
    });
    throw new Error(
      evidence.extractionNote ??
        'No readable text was extracted from this document, so it cannot be analysed automatically.'
    );
  }

  await prisma.evidence.update({ where: { id: evidence.id }, data: { analysisStatus: 'ANALYZING' } });

  const projectRequirements = await prisma.projectRequirement.findMany({
    where: { orgId, projectId: evidence.projectId },
    include: { requirement: true },
  });

  const requirements: RequirementRef[] = projectRequirements.map((pr) => ({
    projectRequirementId: pr.id,
    identifier: pr.requirement.identifier,
    title: pr.requirement.title,
    text: pr.requirement.text,
    guidance: pr.requirement.guidance,
    evidenceSuggestions: parseTags(pr.requirement.evidenceSuggestions),
    importance: pr.importanceOverride ?? pr.requirement.importance,
  }));

  try {
    const result = await ai().analyzeDocument({
      filename: evidence.filename,
      mimeType: evidence.mimeType,
      text: evidence.extractedText,
      requirements,
      today: new Date().toISOString().slice(0, 10),
      organizationName: evidence.org.name,
      frameworkName: evidence.project.frameworkVersion.framework.name,
    });

    const analysis = result.data;
    const validIds = new Set(projectRequirements.map((pr) => pr.id));

    // Persist suggested links. Human decisions are never overwritten.
    for (const match of analysis.matches) {
      if (!validIds.has(match.projectRequirementId)) continue;

      const existing = await prisma.evidenceLink.findUnique({
        where: {
          evidenceId_projectRequirementId: {
            evidenceId: evidence.id,
            projectRequirementId: match.projectRequirementId,
          },
        },
      });

      if (existing && (existing.reviewState !== 'PENDING' || existing.source === 'HUMAN')) continue;

      await prisma.evidenceLink.upsert({
        where: {
          evidenceId_projectRequirementId: {
            evidenceId: evidence.id,
            projectRequirementId: match.projectRequirementId,
          },
        },
        create: {
          orgId,
          evidenceId: evidence.id,
          projectRequirementId: match.projectRequirementId,
          source: 'AI',
          relevance: match.relevance,
          confidence: match.confidence,
          strength: match.strength,
          rationale: match.rationale,
          concerns: stringifyJson(match.concerns),
          reviewState: 'PENDING',
        },
        update: {
          relevance: match.relevance,
          confidence: match.confidence,
          strength: match.strength,
          rationale: match.rationale,
          concerns: stringifyJson(match.concerns),
        },
      });
    }

    // Mark touched requirements as needing review, unless a human already ruled.
    const touched = analysis.matches.map((m) => m.projectRequirementId).filter((id) => validIds.has(id));
    if (touched.length > 0) {
      await prisma.projectRequirement.updateMany({
        where: { id: { in: touched }, orgId, statusSource: { not: 'HUMAN' }, status: { in: ['NOT_ASSESSED', 'MISSING'] } },
        data: { status: 'NEEDS_REVIEW', statusSource: 'AI', lastAssessedAt: new Date() },
      });
    }

    // Record AI-detected document-level gaps.
    for (const gap of analysis.potentialGaps.slice(0, 8)) {
      const fp = fingerprint(['AI', gap.type, evidence.id, gap.title]);
      await prisma.gap.upsert({
        where: { projectId_fingerprint: { projectId: evidence.projectId, fingerprint: fp } },
        create: {
          orgId,
          projectId: evidence.projectId,
          evidenceId: evidence.id,
          type: gap.type,
          severity: gap.severity,
          title: gap.title,
          description: gap.description,
          recommendation: gap.recommendation,
          detectedBy: 'AI',
          department: evidence.department,
          fingerprint: fp,
        },
        update: { severity: gap.severity, description: gap.description, recommendation: gap.recommendation },
      });
    }

    // Apply metadata suggestions only where the user left the field empty.
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        analysisStatus: 'COMPLETE',
        analyzedAt: new Date(),
        documentType:
          evidence.documentType === 'other' && analysis.documentType ? analysis.documentType : evidence.documentType,
        revision: evidence.revision ?? analysis.revision ?? null,
        department: evidence.department ?? analysis.department ?? null,
        effectiveDate: evidence.effectiveDate ?? parseDate(analysis.effectiveDate ?? null),
        expiresAt: evidence.expiresAt ?? parseDate(analysis.expiresAt ?? null),
      },
    });

    await recordAssessment({
      orgId,
      subjectType: 'EVIDENCE',
      subjectId: evidence.id,
      kind: 'DOCUMENT_ANALYSIS',
      result,
      summary: analysis.summary,
      confidence: analysis.overallConfidence,
    });

    await recordAudit({
      orgId,
      userId,
      action: 'ai.analysis_run',
      entityType: 'Evidence',
      entityId: evidence.id,
      metadata: {
        provider: result.provider,
        model: result.model,
        matches: analysis.matches.length,
        gaps: analysis.potentialGaps.length,
        degraded: result.degraded ?? null,
      },
    });

    await recomputeProjectScores(orgId, evidence.projectId);

    return evidence.projectId;
  } catch (error) {
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: { analysisStatus: 'FAILED', analyzedAt: new Date() },
    });
    throw error;
  }
}

/* ------------------------------------------------------------ link review */

const reviewSchema = z.object({
  linkId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
});

/** A human accepts or rejects a suggested evidence↔requirement link. */
export async function reviewEvidenceLinkAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'evidence:review');

  const parsed = reviewSchema.safeParse({
    linkId: formData.get('linkId'),
    decision: formData.get('decision'),
  });
  if (!parsed.success) throw new Error('Invalid review decision.');

  const link = await prisma.evidenceLink.findFirst({
    where: { id: parsed.data.linkId, orgId: tenant.orgId },
    include: { projectRequirement: true, evidence: { select: { title: true, filename: true } } },
  });
  if (!link) throw new Error('That evidence link could not be found.');

  await prisma.evidenceLink.update({
    where: { id: link.id },
    data: {
      reviewState: parsed.data.decision,
      decidedById: parsed.data.decision === 'PENDING' ? null : tenant.user.id,
      decidedAt: parsed.data.decision === 'PENDING' ? null : new Date(),
    },
  });

  await applyDerivedStatus(tenant.orgId, link.projectRequirementId);

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'evidence.link_reviewed',
    entityType: 'EvidenceLink',
    entityId: link.id,
    metadata: {
      decision: parsed.data.decision,
      evidence: link.evidence.title || link.evidence.filename,
    },
  });

  await Promise.all([
    recomputeProjectScores(tenant.orgId, link.projectRequirement.projectId),
    syncProjectGaps(tenant.orgId, link.projectRequirement.projectId),
  ]);

  revalidatePath('/app', 'layout');
}

/** Manually links a document to a requirement (source = HUMAN, auto-approved). */
export async function linkEvidenceAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'evidence:review');

  const evidenceId = String(formData.get('evidenceId') ?? '');
  const projectRequirementId = String(formData.get('projectRequirementId') ?? '');

  const [evidence, projectRequirement] = await Promise.all([
    prisma.evidence.findFirst({ where: { id: evidenceId, orgId: tenant.orgId }, select: { id: true } }),
    prisma.projectRequirement.findFirst({
      where: { id: projectRequirementId, orgId: tenant.orgId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!evidence || !projectRequirement) throw new Error('That document or requirement could not be found.');

  await prisma.evidenceLink.upsert({
    where: { evidenceId_projectRequirementId: { evidenceId: evidence.id, projectRequirementId: projectRequirement.id } },
    create: {
      orgId: tenant.orgId,
      evidenceId: evidence.id,
      projectRequirementId: projectRequirement.id,
      source: 'HUMAN',
      relevance: 1,
      confidence: 1,
      strength: 'STRONG',
      rationale: `Linked manually by ${tenant.user.name}.`,
      reviewState: 'APPROVED',
      decidedById: tenant.user.id,
      decidedAt: new Date(),
    },
    update: {
      source: 'HUMAN',
      reviewState: 'APPROVED',
      decidedById: tenant.user.id,
      decidedAt: new Date(),
    },
  });

  await applyDerivedStatus(tenant.orgId, projectRequirement.id);
  await Promise.all([
    recomputeProjectScores(tenant.orgId, projectRequirement.projectId),
    syncProjectGaps(tenant.orgId, projectRequirement.projectId),
  ]);

  revalidatePath('/app', 'layout');
}

export async function unlinkEvidenceAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'evidence:review');

  const linkId = String(formData.get('linkId') ?? '');
  const link = await prisma.evidenceLink.findFirst({
    where: { id: linkId, orgId: tenant.orgId },
    include: { projectRequirement: { select: { id: true, projectId: true } } },
  });
  if (!link) throw new Error('That evidence link could not be found.');

  await prisma.evidenceLink.delete({ where: { id: link.id } });
  await applyDerivedStatus(tenant.orgId, link.projectRequirement.id);
  await Promise.all([
    recomputeProjectScores(tenant.orgId, link.projectRequirement.projectId),
    syncProjectGaps(tenant.orgId, link.projectRequirement.projectId),
  ]);

  revalidatePath('/app', 'layout');
}

/** Recomputes a requirement's status from its links, unless a human set it. */
async function applyDerivedStatus(orgId: string, projectRequirementId: string) {
  const projectRequirement = await prisma.projectRequirement.findFirst({
    where: { id: projectRequirementId, orgId },
    include: { links: { select: { reviewState: true, strength: true, relevance: true } } },
  });
  if (!projectRequirement) return;
  if (projectRequirement.statusSource === 'HUMAN') return;
  if (projectRequirement.status === 'NOT_APPLICABLE') return;

  const derived = deriveRequirementStatus(projectRequirement.links);
  if (derived !== projectRequirement.status) {
    await prisma.projectRequirement.update({
      where: { id: projectRequirement.id },
      data: { status: derived, statusSource: 'SYSTEM', lastAssessedAt: new Date() },
    });
  }
}

/* ------------------------------------------------------------ maintenance */

const updateEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  title: z.string().trim().min(1, 'Give this document a title.').max(200),
  documentType: z.string().trim().max(60),
  status: z.enum(EVIDENCE_STATUSES),
  ownerUserId: z.string().trim().optional(),
  department: z.string().trim().max(80).optional(),
  revision: z.string().trim().max(40).optional(),
  effectiveDate: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
  tags: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(4000).optional(),
  projectId: z.string().trim().optional(),
});

export async function updateEvidenceAction(
  _prev: EvidenceFormState,
  formData: FormData
): Promise<EvidenceFormState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'evidence:edit');

    const parsed = updateEvidenceSchema.safeParse({
      evidenceId: formData.get('evidenceId'),
      title: formData.get('title'),
      documentType: formData.get('documentType') ?? 'other',
      status: formData.get('status') ?? 'PENDING_REVIEW',
      ownerUserId: formData.get('ownerUserId') || undefined,
      department: formData.get('department') || undefined,
      revision: formData.get('revision') || undefined,
      effectiveDate: formData.get('effectiveDate') || undefined,
      expiresAt: formData.get('expiresAt') || undefined,
      tags: formData.get('tags') || undefined,
      notes: formData.get('notes') || undefined,
      projectId: formData.get('projectId') || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
    }

    const evidence = await prisma.evidence.findFirst({
      where: { id: parsed.data.evidenceId, orgId: tenant.orgId },
      select: { id: true, projectId: true },
    });
    if (!evidence) return { error: 'That document could not be found.' };

    if (parsed.data.projectId) {
      const project = await prisma.auditProject.findFirst({
        where: { id: parsed.data.projectId, orgId: tenant.orgId },
        select: { id: true },
      });
      if (!project) return { error: 'That audit project could not be found.' };
    }

    await prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        title: parsed.data.title,
        documentType: parsed.data.documentType,
        status: parsed.data.status,
        ownerUserId: parsed.data.ownerUserId || null,
        department: parsed.data.department || null,
        revision: parsed.data.revision || null,
        effectiveDate: parseDate(parsed.data.effectiveDate),
        expiresAt: parseDate(parsed.data.expiresAt),
        notes: parsed.data.notes || null,
        projectId: parsed.data.projectId || evidence.projectId,
        tags: stringifyJson(
          (parsed.data.tags ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12)
        ),
      },
    });

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'evidence.updated',
      entityType: 'Evidence',
      entityId: evidence.id,
      metadata: { title: parsed.data.title, status: parsed.data.status },
    });

    const projectId = parsed.data.projectId || evidence.projectId;
    if (projectId) {
      await syncProjectGaps(tenant.orgId, projectId);
      await recomputeProjectScores(tenant.orgId, projectId);
    }

    revalidatePath('/app', 'layout');
    return { success: 'Document updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function deleteEvidenceAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'evidence:delete');

  const evidenceId = String(formData.get('evidenceId') ?? '');
  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, orgId: tenant.orgId },
    select: { id: true, storageKey: true, filename: true, projectId: true },
  });
  if (!evidence) throw new Error('That document could not be found.');

  await prisma.evidence.delete({ where: { id: evidence.id } });

  // Remove the stored object last: a failure here leaves an orphaned file
  // rather than a database row pointing at nothing.
  await storage()
    .delete(evidence.storageKey)
    .catch((error) => console.error('[storage] failed to delete object', evidence.storageKey, error));

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'evidence.deleted',
    entityType: 'Evidence',
    entityId: evidence.id,
    metadata: { filename: evidence.filename },
  });

  if (evidence.projectId) {
    await syncProjectGaps(tenant.orgId, evidence.projectId);
    await recomputeProjectScores(tenant.orgId, evidence.projectId);
  }

  revalidatePath('/app', 'layout');
  redirect('/app/evidence');
}
