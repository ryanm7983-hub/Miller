import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, ListChecks } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import {
  ACTION_STATUS_META,
  GAP_STATUS_META,
  GAP_TYPE_LABELS,
  SEVERITY_META,
  type ActionStatus,
  type GapStatus,
  type GapType,
  type Severity,
} from '@/lib/enums';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { CommentThread } from '@/components/app/comment-thread';
import { GapStatusForm } from './gap-status-form';
import { CreateActionPanel } from './create-action-panel';
import { formatDate, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Gap' };

export default async function GapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await params;

  const gap = await prisma.gap.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      project: { select: { id: true, name: true } },
      projectRequirement: { include: { requirement: { select: { identifier: true, title: true, text: true } } } },
      evidence: { select: { id: true, title: true, filename: true } },
      owner: { select: { id: true, name: true } },
      actions: {
        include: { owner: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!gap) notFound();

  const [members, departments, comments] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
    prisma.comment.findMany({
      where: { orgId: tenant.orgId, entityType: 'GAP', entityId: id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const severity = SEVERITY_META[gap.severity as Severity];

  return (
    <div>
      <PageHeader
        title={gap.title}
        description={GAP_TYPE_LABELS[gap.type as GapType] ?? gap.type}
        breadcrumb={[
          { label: 'Gap Center', href: `/app/gaps?project=${gap.projectId}` },
          { label: truncate(gap.title, 40) },
        ]}
        action={
          <>
            <Badge tone={severity.tone} dot>
              {severity.label}
            </Badge>
            <Badge tone={GAP_STATUS_META[gap.status as GapStatus].tone}>
              {GAP_STATUS_META[gap.status as GapStatus].label}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="What was found"
              description={
                gap.detectedBy === 'AI'
                  ? 'Detected by AI document analysis — verify before acting.'
                  : gap.detectedBy === 'HUMAN'
                    ? 'Raised by a person.'
                    : 'Detected by the rule-based gap engine.'
              }
            />
            <div className="space-y-4 p-5">
              <p className="text-[14px] leading-relaxed text-ink-700">{gap.description}</p>

              {gap.recommendation && (
                <div className="rounded-lg border border-kelp-200 bg-kelp-50/60 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-kelp-700">Recommended fix</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-kelp-900">{gap.recommendation}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {gap.projectRequirement && (
                  <Link href={`/app/requirements/${gap.projectRequirement.id}`} className="btn-secondary btn-sm">
                    <ListChecks className="h-3.5 w-3.5" aria-hidden />
                    {gap.projectRequirement.requirement.identifier} — {truncate(gap.projectRequirement.requirement.title, 28)}
                  </Link>
                )}
                {gap.evidence && (
                  <Link href={`/app/evidence/${gap.evidence.id}`} className="btn-secondary btn-sm">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {truncate(gap.evidence.title || gap.evidence.filename, 32)}
                  </Link>
                )}
              </div>
            </div>
          </Card>

          <CreateActionPanel
            gap={{
              id: gap.id,
              projectId: gap.projectId,
              title: gap.title,
              severity: gap.severity,
              department: gap.department,
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
            departments={departments.map((d) => d.name)}
            canCreate={can(tenant.role, 'action:create')}
            canUseAi={can(tenant.role, 'ai:run')}
          />

          {gap.actions.length > 0 && (
            <Card>
              <CardHeader title="Actions raised from this gap" />
              <ul className="divide-y divide-ink-100">
                {gap.actions.map((action) => (
                  <li key={action.id}>
                    <Link href={`/app/actions/${action.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <span className="font-mono text-[11.5px] text-ink-500">{action.reference}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink-900">{action.title}</p>
                        <p className="text-[12px] text-ink-500">
                          {action.owner?.name ?? 'Unassigned'}
                          {action.dueDate && ` · due ${formatDate(action.dueDate)}`}
                        </p>
                      </div>
                      <Badge tone={ACTION_STATUS_META[action.status as ActionStatus].tone} size="sm">
                        {ACTION_STATUS_META[action.status as ActionStatus].label}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <CommentThread
            entityType="GAP"
            entityId={gap.id}
            comments={comments.map((c) => ({
              id: c.id,
              body: c.body,
              userName: c.user.name,
              userEmail: c.user.email,
              createdAt: c.createdAt.toISOString(),
            }))}
            canComment={can(tenant.role, 'comment:create')}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Triage" />
            <div className="p-5">
              <GapStatusForm
                gap={{
                  id: gap.id,
                  status: gap.status,
                  ownerUserId: gap.ownerUserId,
                  dueDate: gap.dueDate?.toISOString() ?? null,
                }}
                members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                canManage={can(tenant.role, 'gap:manage')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-ink-100 text-[12.5px]">
              {[
                ['Project', gap.project.name],
                ['Type', GAP_TYPE_LABELS[gap.type as GapType] ?? gap.type],
                ['Severity', severity.label],
                ['Department', gap.department ?? 'Not specified'],
                ['Detected', formatDate(gap.createdAt)],
                ['Detected by', gap.detectedBy === 'AI' ? 'AI analysis' : gap.detectedBy === 'HUMAN' ? 'A person' : 'Rule engine'],
                ['Resolved', gap.resolvedAt ? formatDate(gap.resolvedAt) : '—'],
              ].map(([term, value]) => (
                <div key={term} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                  <dt className="shrink-0 text-ink-500">{term}</dt>
                  <dd className="text-right font-medium text-ink-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
