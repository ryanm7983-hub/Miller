import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, FileText, Plus, ShieldAlert } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { parseTags } from '@/lib/json';
import {
  IMPORTANCE_LABELS,
  REQUIREMENT_STATUS_META,
  SEVERITY_META,
  type RequirementStatus,
  type Severity,
} from '@/lib/enums';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { LinkReviewRow } from '../../evidence/[id]/link-review-row';
import { RequirementForm } from './requirement-form';
import { LinkEvidencePicker } from './link-evidence-picker';
import { formatDateTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Requirement' };

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const projectRequirement = await prisma.projectRequirement.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      requirement: { include: { category: true } },
      project: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      links: {
        include: {
          evidence: { select: { id: true, title: true, filename: true } },
          decidedBy: { select: { name: true } },
        },
        orderBy: [{ reviewState: 'asc' }, { relevance: 'desc' }],
      },
      gaps: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { severity: 'asc' } },
    },
  });
  if (!projectRequirement) notFound();

  const [members, departments, linkableEvidence, actions] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
    prisma.evidence.findMany({
      where: {
        orgId: tenant.orgId,
        projectId: projectRequirement.projectId,
        id: { notIn: projectRequirement.links.map((l) => l.evidenceId) },
      },
      select: { id: true, title: true, filename: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.action.findMany({
      where: {
        orgId: tenant.orgId,
        gap: { projectRequirementId: projectRequirement.id },
      },
      select: { id: true, reference: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const meta = REQUIREMENT_STATUS_META[projectRequirement.status as RequirementStatus];
  const evidenceSuggestions = parseTags(projectRequirement.requirement.evidenceSuggestions);
  const importance = projectRequirement.importanceOverride ?? projectRequirement.requirement.importance;
  const canEdit = can(tenant.role, 'requirement:edit');
  const canReview = can(tenant.role, 'evidence:review');

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-[17px] text-ink-500">{projectRequirement.requirement.identifier}</span>
            {projectRequirement.requirement.title}
          </span>
        }
        description={projectRequirement.requirement.category?.name}
        breadcrumb={[
          { label: 'Requirements', href: `/app/requirements?project=${projectRequirement.projectId}` },
          { label: truncate(projectRequirement.requirement.title, 40) },
        ]}
        action={
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Requirement"
              description={`Importance: ${IMPORTANCE_LABELS[importance] ?? importance} · ${projectRequirement.project.name}`}
            />
            <div className="space-y-5 p-5">
              <p className="text-[14.5px] leading-relaxed text-ink-800">{projectRequirement.requirement.text}</p>

              {projectRequirement.requirement.guidance && (
                <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    Guidance
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-700">
                    {projectRequirement.requirement.guidance}
                  </p>
                </div>
              )}

              {evidenceSuggestions.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                    Evidence auditors typically ask for
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidenceSuggestions.map((suggestion) => (
                      <Badge key={suggestion} tone="neutral" size="sm">
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Evidence"
              description="Only approved links count toward readiness."
              action={
                canReview && linkableEvidence.length > 0 ? (
                  <LinkEvidencePicker
                    projectRequirementId={projectRequirement.id}
                    evidence={linkableEvidence.map((e) => ({ id: e.id, label: e.title || e.filename }))}
                  />
                ) : undefined
              }
            />
            {projectRequirement.links.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <FileText className="mx-auto h-5 w-5 text-ink-400" aria-hidden />
                <p className="mt-2.5 text-[13.5px] font-medium text-ink-900">No evidence linked yet</p>
                <p className="mt-1 text-[13px] text-ink-500">
                  Upload the record that demonstrates this requirement, or link one already in your library.
                </p>
                <Link
                  href={`/app/evidence/upload?project=${projectRequirement.projectId}`}
                  className="btn-primary btn-md mt-4"
                >
                  Upload evidence
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {projectRequirement.links.map((link) => (
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
                      id: projectRequirement.id,
                      identifier: projectRequirement.requirement.identifier,
                      title: projectRequirement.requirement.title,
                    }}
                    canReview={canReview}
                    evidenceHref={`/app/evidence/${link.evidence.id}`}
                    evidenceLabel={link.evidence.title || link.evidence.filename}
                  />
                ))}
              </ul>
            )}
          </Card>

          {projectRequirement.gaps.length > 0 && (
            <Card>
              <CardHeader title="Open gaps" description="Detected against this requirement." />
              <ul className="divide-y divide-ink-100">
                {projectRequirement.gaps.map((gap) => (
                  <li key={gap.id}>
                    <Link href={`/app/gaps/${gap.id}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/70">
                      <Badge tone={SEVERITY_META[gap.severity as Severity].tone} size="sm" className="mt-0.5 w-[64px] justify-center">
                        {SEVERITY_META[gap.severity as Severity].label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink-900">{gap.title}</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{gap.description}</p>
                      </div>
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {actions.length > 0 && (
            <Card>
              <CardHeader title="Related actions" />
              <ul className="divide-y divide-ink-100">
                {actions.map((action) => (
                  <li key={action.id}>
                    <Link href={`/app/actions/${action.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <span className="font-mono text-[11.5px] text-ink-500">{action.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-800">{action.title}</span>
                      <Badge tone="muted" size="sm">
                        {action.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Assessment"
              description={
                projectRequirement.statusSource === 'HUMAN'
                  ? 'Set by a person — automatic derivation will not overwrite it.'
                  : projectRequirement.statusSource === 'AI'
                    ? 'Suggested by AI — confirm or change it.'
                    : 'Derived from approved evidence links.'
              }
            />
            <div className="p-5">
              <RequirementForm
                requirement={{
                  id: projectRequirement.id,
                  status: projectRequirement.status,
                  ownerUserId: projectRequirement.ownerUserId,
                  department: projectRequirement.department,
                  notes: projectRequirement.notes,
                  naJustification: projectRequirement.naJustification,
                  importanceOverride: projectRequirement.importanceOverride,
                  baseImportance: projectRequirement.requirement.importance,
                }}
                members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                departments={departments.map((d) => d.name)}
                canEdit={canEdit}
              />
            </div>
            {projectRequirement.lastAssessedAt && (
              <div className="border-t border-ink-200 px-5 py-2.5 text-[11.5px] text-ink-400">
                Last assessed {formatDateTime(projectRequirement.lastAssessedAt)}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Quick actions</p>
            <div className="mt-3 space-y-2">
              <Link
                href={`/app/evidence/upload?project=${projectRequirement.projectId}`}
                className="btn-secondary btn-sm w-full"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Upload evidence for this
              </Link>
              <Link
                href={`/app/gaps?project=${projectRequirement.projectId}`}
                className="btn-secondary btn-sm w-full"
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Open Gap Center
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
