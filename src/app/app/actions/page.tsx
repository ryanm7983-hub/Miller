import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckSquare } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import {
  ACTION_STATUSES,
  ACTION_STATUS_META,
  OPEN_ACTION_STATUSES,
  SEVERITIES,
  SEVERITY_META,
  type ActionStatus,
  type Severity,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ProjectPicker } from '@/components/app/project-picker';
import { FilterBar } from '@/components/app/filter-bar';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Actions' };

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    status?: string;
    priority?: string;
    owner?: string;
    department?: string;
    q?: string;
  }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Actions" />
        <Card>
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title="No audit project yet"
            description="Actions are raised from gaps inside an audit project."
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
  const now = new Date();

  const [actions, all, members, departments] = await Promise.all([
    prisma.action.findMany({
      where: {
        orgId: tenant.orgId,
        projectId: project.id,
        ...(sp.status && ACTION_STATUSES.includes(sp.status as ActionStatus)
          ? { status: sp.status }
          : { status: { in: OPEN_ACTION_STATUSES } }),
        ...(sp.priority && SEVERITIES.includes(sp.priority as Severity) ? { priority: sp.priority } : {}),
        ...(sp.owner === 'me' ? { ownerUserId: tenant.user.id } : sp.owner ? { ownerUserId: sp.owner } : {}),
        ...(sp.department ? { department: sp.department } : {}),
        ...(query ? { OR: [{ title: { contains: query } }, { description: { contains: query } }, { reference: { contains: query } }] } : {}),
      },
      include: {
        owner: { select: { name: true } },
        gap: { select: { id: true, title: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
      take: 400,
    }),
    prisma.action.findMany({
      where: { orgId: tenant.orgId, projectId: project.id },
      select: { status: true, dueDate: true },
    }),
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
  ]);

  const open = all.filter((a) => OPEN_ACTION_STATUSES.includes(a.status as ActionStatus));
  const stats = {
    open: open.length,
    overdue: open.filter((a) => a.dueDate && a.dueDate < now).length,
    complete: all.filter((a) => a.status === 'COMPLETE').length,
    verified: all.filter((a) => a.status === 'VERIFIED').length,
  };

  return (
    <div>
      <PageHeader
        title="Actions"
        description={`Corrective and preparation work on ${project.name}.`}
        action={<ProjectPicker projects={projects} activeId={project.id} basePath="/app/actions" />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Open" value={stats.open} />
        </Card>
        <Card>
          <Stat label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'risk' : 'default'} />
        </Card>
        <Card>
          <Stat label="Complete" value={stats.complete} tone="caution" sub="Awaiting verification" />
        </Card>
        <Card>
          <Stat label="Verified" value={stats.verified} tone="strong" />
        </Card>
      </div>

      <FilterBar
        basePath="/app/actions"
        params={{ project: project.id }}
        current={{
          status: sp.status,
          priority: sp.priority,
          owner: sp.owner,
          department: sp.department,
          q: sp.q,
        }}
        searchPlaceholder="Search reference, title or description…"
        filters={[
          { key: 'status', label: 'Status', options: ACTION_STATUSES.map((s) => ({ value: s, label: ACTION_STATUS_META[s].label })) },
          { key: 'priority', label: 'Priority', options: SEVERITIES.map((s) => ({ value: s, label: SEVERITY_META[s].label })) },
          {
            key: 'owner',
            label: 'Owner',
            options: [{ value: 'me', label: 'Assigned to me' }, ...members.map((m) => ({ value: m.user.id, label: m.user.name }))],
          },
          { key: 'department', label: 'Department', options: departments.map((d) => ({ value: d.name, label: d.name })) },
        ]}
      />

      {actions.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title={sp.status || sp.owner || sp.q ? 'Nothing matches these filters' : 'No open actions'}
            description="Actions are created from gaps. Open the Gap Center to convert a finding into tracked work."
            action={
              <Link href={`/app/gaps?project=${project.id}`} className="btn-primary btn-md">
                Open Gap Center
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2.5 font-medium">Ref</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {actions.map((action) => {
                  const overdue =
                    action.dueDate && action.dueDate < now && OPEN_ACTION_STATUSES.includes(action.status as ActionStatus);
                  return (
                    <tr key={action.id} className="table-row-link">
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link href={`/app/actions/${action.id}`} className="font-mono text-[12px] font-medium text-ink-600">
                          {action.reference}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/app/actions/${action.id}`} className="block">
                          <span className="text-[13.5px] font-medium text-ink-900">{action.title}</span>
                          {action.gap && (
                            <span className="mt-0.5 block truncate text-[12px] text-ink-500">from: {action.gap.title}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink-600">
                        {action.owner?.name ?? <span className="text-ink-400">Unassigned</span>}
                      </td>
                      <td className="px-3 py-3 text-[12.5px]">
                        {action.dueDate ? (
                          <span className={overdue ? 'font-semibold text-risk-600' : 'text-ink-600'}>
                            {formatDate(action.dueDate)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={SEVERITY_META[action.priority as Severity].tone} size="sm">
                          {SEVERITY_META[action.priority as Severity].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ACTION_STATUS_META[action.status as ActionStatus].tone} size="sm" dot>
                          {ACTION_STATUS_META[action.status as ActionStatus].label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
