import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, FileText, Sparkles } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { listProjects } from '@/lib/projects';
import { parseJson, parseTags } from '@/lib/json';
import type { DocumentAnalysis } from '@/lib/ai/types';
import {
  AI_ASSESSMENT_CAVEAT,
  AI_STRENGTH_META,
  EVIDENCE_STATUS_META,
  documentTypeLabel,
  type AiStrength,
  type EvidenceStatus,
} from '@/lib/enums';
import { Card, CardHeader, PageHeader, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { formatBytes, formatDate, formatDateTime, truncate } from '@/lib/utils';
import { analyzeEvidenceAction } from '../actions';
import { EvidenceDetailForm } from './evidence-detail-form';
import { LinkReviewRow } from './link-review-row';

export const metadata: Metadata = { title: 'Evidence' };

export default async function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const evidence = await prisma.evidence.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      owner: { select: { id: true, name: true } },
      uploadedBy: { select: { name: true } },
      project: { select: { id: true, name: true } },
      links: {
        include: {
          projectRequirement: { include: { requirement: true } },
          decidedBy: { select: { name: true } },
        },
        orderBy: { relevance: 'desc' },
      },
      gaps: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { severity: 'asc' } },
    },
  });
  if (!evidence) notFound();

  const [assessment, members, departments, projects] = await Promise.all([
    prisma.aiAssessment.findFirst({
      where: {
        orgId: tenant.orgId,
        subjectType: 'EVIDENCE',
        subjectId: evidence.id,
        kind: 'DOCUMENT_ANALYSIS',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
    listProjects(tenant),
  ]);

  const analysis = assessment ? parseJson<DocumentAnalysis | null>(assessment.output, null) : null;
  const tags = parseTags(evidence.tags);
  const canAnalyze = can(tenant.role, 'ai:run');
  const canReview = can(tenant.role, 'evidence:review');
  const statusMeta = EVIDENCE_STATUS_META[evidence.status as EvidenceStatus];

  return (
    <div>
      <PageHeader
        title={evidence.title || evidence.filename}
        description={`${documentTypeLabel(evidence.documentType)} · ${formatBytes(evidence.sizeBytes)} · uploaded by ${evidence.uploadedBy.name} on ${formatDate(evidence.createdAt)}`}
        breadcrumb={[{ label: 'Evidence', href: '/app/evidence' }, { label: truncate(evidence.title || evidence.filename, 40) }]}
        action={
          <>
            <a href={`/api/evidence/${evidence.id}/download`} className="btn-secondary btn-md">
              <Download className="h-4 w-4" aria-hidden />
              Download
            </a>
            {canAnalyze && evidence.projectId && (
              <form action={analyzeEvidenceAction}>
                <input type="hidden" name="evidenceId" value={evidence.id} />
                <SubmitButton pendingLabel="Analyzing…">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {evidence.analysisStatus === 'COMPLETE' ? 'Re-analyze' : 'Analyze'}
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusMeta.tone} dot>
          {statusMeta.label}
        </Badge>
        {evidence.project && (
          <Link href={`/app/audits/${evidence.project.id}`} className="text-[13px] text-ink-600 hover:underline">
            {evidence.project.name}
          </Link>
        )}
        {tags.map((tag) => (
          <Badge key={tag} tone="muted" size="sm">
            {tag}
          </Badge>
        ))}
      </div>

      {!evidence.projectId && (
        <Alert tone="warning" className="mb-4">
          This document is in the library but not attached to an audit project, so it cannot be analysed or counted
          toward readiness. Assign it below.
        </Alert>
      )}

      {evidence.extractionStatus !== 'COMPLETE' && evidence.extractionNote && (
        <Alert
          tone={evidence.extractionStatus === 'FAILED' || evidence.extractionStatus === 'UNSUPPORTED' ? 'warning' : 'info'}
          className="mb-4"
          title="Text extraction"
        >
          {evidence.extractionNote}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          {/* AI assessment */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-info-500" aria-hidden />
                  AI assessment
                </span>
              }
              description={
                assessment
                  ? `${assessment.provider} · ${assessment.model} · prompt ${assessment.promptVersion} · ${formatDateTime(assessment.createdAt)}`
                  : 'This document has not been analysed yet.'
              }
              action={
                assessment?.confidence != null ? (
                  <Badge tone="info">{Math.round(assessment.confidence * 100)}% confidence</Badge>
                ) : undefined
              }
            />

            {!analysis ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13.5px] text-ink-500">
                  {evidence.projectId
                    ? 'Run analysis to match this document to your requirements and surface potential gaps.'
                    : 'Assign this document to an audit project first, then run analysis.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Summary</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-700">{analysis.summary}</p>
                </div>

                {analysis.humanVerification.length > 0 && (
                  <div className="rounded-lg border border-info-500/25 bg-info-50 p-4">
                    <p className="text-[12.5px] font-semibold text-info-700">What a reviewer should verify</p>
                    <ul className="mt-2 space-y-1.5">
                      {analysis.humanVerification.map((item, index) => (
                        <li key={index} className="flex gap-2 text-[13px] leading-relaxed text-info-700/90">
                          <span aria-hidden>·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.identifiedDates.length > 0 && (
                  <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                      Dates found in the document
                    </p>
                    <ul className="mt-2 space-y-1">
                      {analysis.identifiedDates.slice(0, 6).map((entry, index) => (
                        <li key={index} className="flex gap-3 text-[12.5px]">
                          <span className="tnum w-[86px] shrink-0 font-medium text-ink-800">{entry.date}</span>
                          <span className="min-w-0 flex-1 truncate text-ink-500">{entry.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="border-t border-ink-100 pt-4 text-[12px] leading-relaxed text-ink-500">
                  {AI_ASSESSMENT_CAVEAT}
                </p>
              </div>
            )}
          </Card>

          {/* Requirement links */}
          <Card>
            <CardHeader
              title="Linked requirements"
              description="Suggested matches only count toward readiness once a person approves them."
            />
            {evidence.links.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-ink-500">
                No requirements linked yet.{' '}
                {evidence.projectId
                  ? 'Run analysis, or link a requirement manually from the requirement page.'
                  : 'Assign this document to a project first.'}
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {evidence.links.map((link) => (
                  <LinkReviewRow
                    key={link.id}
                    link={{
                      id: link.id,
                      source: link.source,
                      relevance: link.relevance,
                      confidence: link.confidence,
                      strength: link.strength,
                      rationale: link.rationale,
                      concerns: parseTags(link.concerns),
                      reviewState: link.reviewState,
                      decidedByName: link.decidedBy?.name ?? null,
                      decidedAt: link.decidedAt?.toISOString() ?? null,
                    }}
                    requirement={{
                      id: link.projectRequirement.id,
                      identifier: link.projectRequirement.requirement.identifier,
                      title: link.projectRequirement.requirement.title,
                    }}
                    canReview={canReview}
                  />
                ))}
              </ul>
            )}
          </Card>

          {/* Gaps raised against this document */}
          {evidence.gaps.length > 0 && (
            <Card>
              <CardHeader title="Open gaps on this document" />
              <ul className="divide-y divide-ink-100">
                {evidence.gaps.map((gap) => (
                  <li key={gap.id}>
                    <Link href={`/app/gaps/${gap.id}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/70">
                      <Badge
                        tone={gap.severity === 'CRITICAL' || gap.severity === 'HIGH' ? 'risk' : gap.severity === 'MEDIUM' ? 'caution' : 'info'}
                        size="sm"
                        className="mt-0.5 w-[64px] justify-center"
                      >
                        {gap.severity.charAt(0) + gap.severity.slice(1).toLowerCase()}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink-900">{gap.title}</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{gap.description}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Extracted text */}
          {evidence.extractedText && (
            <Card>
              <CardHeader
                title="Extracted text"
                description={`Searchable representation${evidence.ocrUsed ? ' (recovered by OCR — verify accuracy)' : ''}. ${evidence.pageCount ? `${evidence.pageCount} page(s).` : ''}`}
              />
              <div className="max-h-[380px] overflow-y-auto px-5 py-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-600">
                  {evidence.extractedText.slice(0, 20000)}
                  {evidence.extractedText.length > 20000 && '\n\n…[truncated for display]'}
                </pre>
              </div>
            </Card>
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Document details" />
            <div className="p-5">
              <EvidenceDetailForm
                evidence={{
                  id: evidence.id,
                  title: evidence.title,
                  documentType: evidence.documentType,
                  status: evidence.status,
                  ownerUserId: evidence.ownerUserId,
                  department: evidence.department,
                  revision: evidence.revision,
                  effectiveDate: evidence.effectiveDate?.toISOString() ?? null,
                  expiresAt: evidence.expiresAt?.toISOString() ?? null,
                  tags,
                  notes: evidence.notes,
                  projectId: evidence.projectId,
                }}
                members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                departments={departments.map((d) => d.name)}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                canEdit={can(tenant.role, 'evidence:edit')}
                canDelete={can(tenant.role, 'evidence:delete')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="File" />
            <dl className="divide-y divide-ink-100 text-[12.5px]">
              {[
                ['Filename', evidence.filename],
                ['Size', formatBytes(evidence.sizeBytes)],
                ['Type', evidence.mimeType],
                ['Checksum', `${evidence.checksum.slice(0, 16)}…`],
                ['Extraction', evidence.extractionStatus],
                ['Analysis', evidence.analysisStatus],
                ['Analyzed', evidence.analyzedAt ? formatDateTime(evidence.analyzedAt) : 'Never'],
              ].map(([term, value]) => (
                <div key={term} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                  <dt className="shrink-0 text-ink-500">{term}</dt>
                  <dd className="truncate text-right font-medium text-ink-800" title={String(value)}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-ink-200 px-5 py-3">
              <a
                href={`/api/evidence/${evidence.id}/download?inline=1`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[13px] font-medium text-kelp-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Open in a new tab
              </a>
            </div>
          </Card>

          {analysis && analysis.matches.length > 0 && (
            <Card>
              <CardHeader title="Match strength" />
              <ul className="divide-y divide-ink-100">
                {analysis.matches.slice(0, 6).map((match) => (
                  <li key={match.identifier} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="font-mono text-[11.5px] font-medium text-ink-700">{match.identifier}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={
                          match.strength === 'STRONG'
                            ? 'h-full bg-strong-500'
                            : match.strength === 'PARTIAL'
                              ? 'h-full bg-caution-500'
                              : 'h-full bg-risk-500'
                        }
                        style={{ width: `${Math.round(match.relevance * 100)}%` }}
                      />
                    </div>
                    <Badge tone={AI_STRENGTH_META[match.strength as AiStrength].tone} size="sm">
                      {AI_STRENGTH_META[match.strength as AiStrength].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
