import type { Metadata } from 'next';
import Link from 'next/link';
import { Table2 } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import { parseTags } from '@/lib/json';
import {
  AI_STRENGTH_META,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_META,
  REVIEW_STATES,
  type AiStrength,
  type RequirementStatus,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ProjectPicker } from '@/components/app/project-picker';
import { FilterBar } from '@/components/app/filter-bar';
import { MatrixTable } from './matrix-table';

export const metadata: Metadata = { title: 'Evidence matrix' };

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; status?: string; review?: string; q?: string; row?: string }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Evidence matrix" />
        <Card>
          <EmptyState
            icon={<Table2 className="h-5 w-5" />}
            title="No audit project yet"
            description="The matrix maps every requirement to the evidence that supports it."
            action={
              <Link href="/app/audits/new" className="btn-primary btn-md">
                Create audit project
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const query = sp.q?.trim();
  const rows = await prisma.projectRequirement.findMany({
    where: {
      orgId: tenant.orgId,
      projectId: project.id,
      ...(sp.status && REQUIREMENT_STATUSES.includes(sp.status as RequirementStatus) ? { status: sp.status } : {}),
      ...(sp.review ? { links: { some: { reviewState: sp.review } } } : {}),
      ...(query
        ? {
            requirement: {
              OR: [{ identifier: { contains: query } }, { title: { contains: query } }],
            },
          }
        : {}),
    },
    include: {
      requirement: { select: { identifier: true, title: true, text: true, importance: true } },
      owner: { select: { name: true } },
      links: {
        include: {
          evidence: { select: { id: true, title: true, filename: true, expiresAt: true } },
          decidedBy: { select: { name: true } },
        },
        orderBy: [{ reviewState: 'asc' }, { relevance: 'desc' }],
      },
    },
    orderBy: [{ requirement: { sortOrder: 'asc' } }],
  });

  const pendingCount = rows.reduce(
    (sum, row) => sum + row.links.filter((l) => l.reviewState === 'PENDING').length,
    0
  );

  return (
    <div>
      <PageHeader
        title="Evidence → requirement matrix"
        description={`Every requirement in ${project.name}, the evidence attached to it, what the AI thought, and where a person has ruled.`}
        action={<ProjectPicker projects={projects} activeId={project.id} basePath="/app/matrix" />}
      />

      <FilterBar
        basePath="/app/matrix"
        params={{ project: project.id }}
        current={{ status: sp.status, review: sp.review, q: sp.q }}
        searchPlaceholder="Search requirement identifier or title…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: REQUIREMENT_STATUSES.map((s) => ({ value: s, label: REQUIREMENT_STATUS_META[s].label })),
          },
          {
            key: 'review',
            label: 'Review',
            options: REVIEW_STATES.map((s) => ({
              value: s,
              label: s === 'PENDING' ? `Awaiting review (${pendingCount})` : s.charAt(0) + s.slice(1).toLowerCase(),
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Table2 className="h-5 w-5" />}
            title="Nothing matches these filters"
            description="Try clearing the filters."
          />
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <MatrixTable
            rows={rows.map((row) => ({
              id: row.id,
              identifier: row.requirement.identifier,
              title: row.requirement.title,
              text: row.requirement.text,
              status: row.status,
              statusSource: row.statusSource,
              ownerName: row.owner?.name ?? null,
              links: row.links.map((link) => ({
                id: link.id,
                evidenceId: link.evidence.id,
                evidenceLabel: link.evidence.title || link.evidence.filename,
                evidenceExpired: !!(link.evidence.expiresAt && link.evidence.expiresAt < new Date()),
                source: link.source,
                strength: link.strength,
                strengthLabel: AI_STRENGTH_META[link.strength as AiStrength]?.label ?? link.strength,
                relevance: link.relevance,
                confidence: link.confidence,
                rationale: link.rationale,
                concerns: parseTags(link.concerns),
                reviewState: link.reviewState,
                decidedByName: link.decidedBy?.name ?? null,
                decidedAt: link.decidedAt?.toISOString() ?? null,
              })),
            }))}
            canReview={can(tenant.role, 'evidence:review')}
            initialRowId={sp.row}
          />
        </Card>
      )}

      <p className="mt-4 text-[12px] text-ink-400">
        {rows.length} requirement{rows.length === 1 ? '' : 's'} shown
        {pendingCount > 0 && ` · ${pendingCount} AI match${pendingCount === 1 ? '' : 'es'} awaiting review`}
      </p>
    </div>
  );
}
