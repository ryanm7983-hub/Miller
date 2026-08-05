import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import {
  ACTION_STATUS_META,
  SEVERITY_META,
  type ActionStatus,
  type Severity,
} from '@/lib/enums';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { CommentThread } from '@/components/app/comment-thread';
import { ActionForm } from './action-form';
import { formatDate, formatDateTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Action' };

export default async function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await params;

  const action = await prisma.action.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      project: { select: { id: true, name: true } },
      gap: {
        select: {
          id: true,
          title: true,
          severity: true,
          description: true,
          projectRequirement: { select: { id: true, requirement: { select: { identifier: true, title: true } } } },
        },
      },
      owner: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      verifiedBy: { select: { name: true } },
    },
  });
  if (!action) notFound();

  const [members, departments, comments] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
    prisma.comment.findMany({
      where: { orgId: tenant.orgId, entityType: 'ACTION', entityId: id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const isOwner = action.ownerUserId === tenant.user.id;
  const canEdit = can(tenant.role, 'action:edit');
  const canProgress = canEdit || (isOwner && can(tenant.role, 'action:complete_assigned'));
  const statusMeta = ACTION_STATUS_META[action.status as ActionStatus];

  return (
    <div>
      <PageHeader
        title={action.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-ink-500">{action.reference}</span>
            <span>·</span>
            <span>
              Raised by {action.createdBy.name} on {formatDate(action.createdAt)}
            </span>
            {action.source === 'AI' && (
              <Badge tone="info" size="sm">
                AI-drafted
              </Badge>
            )}
          </span>
        }
        breadcrumb={[
          { label: 'Actions', href: `/app/actions?project=${action.projectId}` },
          { label: truncate(action.title, 40) },
        ]}
        action={
          <>
            <Badge tone={SEVERITY_META[action.priority as Severity].tone}>
              {SEVERITY_META[action.priority as Severity].label} priority
            </Badge>
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          {action.description && (
            <Card>
              <CardHeader title="What needs to happen" />
              <div className="p-5">
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-700">{action.description}</p>
              </div>
            </Card>
          )}

          {action.gap && (
            <Card>
              <CardHeader title="Originating gap" />
              <Link href={`/app/gaps/${action.gap.id}`} className="block p-5 transition-colors hover:bg-ink-50/70">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={SEVERITY_META[action.gap.severity as Severity].tone} size="sm">
                        {SEVERITY_META[action.gap.severity as Severity].label}
                      </Badge>
                      <span className="text-[13.5px] font-medium text-ink-900">{action.gap.title}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{action.gap.description}</p>
                    {action.gap.projectRequirement && (
                      <p className="mt-1.5 font-mono text-[11.5px] text-ink-500">
                        {action.gap.projectRequirement.requirement.identifier} —{' '}
                        {action.gap.projectRequirement.requirement.title}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </Card>
          )}

          <CommentThread
            entityType="ACTION"
            entityId={action.id}
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
            <CardHeader
              title="Manage"
              description={
                canEdit
                  ? undefined
                  : isOwner
                    ? 'You can progress this action but not reassign or verify it.'
                    : 'Read-only — this action is not assigned to you.'
              }
            />
            <div className="p-5">
              <ActionForm
                action={{
                  id: action.id,
                  title: action.title,
                  description: action.description,
                  ownerUserId: action.ownerUserId,
                  department: action.department,
                  dueDate: action.dueDate?.toISOString() ?? null,
                  priority: action.priority,
                  status: action.status,
                }}
                members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                departments={departments.map((d) => d.name)}
                canEdit={canEdit}
                canProgress={canProgress}
                canVerify={can(tenant.role, 'action:verify')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <dl className="divide-y divide-ink-100 text-[12.5px]">
              {[
                ['Project', action.project.name],
                ['Created', formatDateTime(action.createdAt)],
                ['Created by', action.createdBy.name],
                ['Due', action.dueDate ? formatDate(action.dueDate) : 'No due date'],
                ['Completed', action.completedAt ? formatDateTime(action.completedAt) : '—'],
                ['Verified by', action.verifiedBy?.name ?? '—'],
                ['Verified', action.verifiedAt ? formatDateTime(action.verifiedAt) : '—'],
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
