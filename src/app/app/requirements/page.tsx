import type { Metadata } from 'next';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import {
  IMPORTANCE_LABELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_META,
  type RequirementStatus,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge, StatusDot } from '@/components/ui/badge';
import { ProjectPicker } from '@/components/app/project-picker';
import { FilterBar } from '@/components/app/filter-bar';
import { truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Requirements' };

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; status?: string; q?: string; category?: string; owner?: string }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Requirements" />
        <Card>
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No audit project yet"
            description="Requirements are imported when you create an audit project from a framework."
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

  const statusFilter = sp.status && REQUIREMENT_STATUSES.includes(sp.status as RequirementStatus) ? sp.status : undefined;
  const query = sp.q?.trim();

  const [rows, categories, members] = await Promise.all([
    prisma.projectRequirement.findMany({
      where: {
        orgId: tenant.orgId,
        projectId: project.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(sp.owner === 'me' ? { ownerUserId: tenant.user.id } : sp.owner ? { ownerUserId: sp.owner } : {}),
        ...(sp.category ? { requirement: { categoryId: sp.category } } : {}),
        ...(query
          ? {
              requirement: {
                OR: [
                  { identifier: { contains: query } },
                  { title: { contains: query } },
                  { text: { contains: query } },
                ],
              },
            }
          : {}),
      },
      include: {
        requirement: { include: { category: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { links: true } },
      },
      orderBy: [{ requirement: { sortOrder: 'asc' } }],
    }),
    prisma.requirementCategory.findMany({
      where: { frameworkVersionId: project.frameworkVersionId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const counts = REQUIREMENT_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  const allRows = await prisma.projectRequirement.findMany({
    where: { orgId: tenant.orgId, projectId: project.id },
    select: { status: true },
  });
  for (const row of allRows) counts[row.status] = (counts[row.status] ?? 0) + 1;

  return (
    <div>
      <PageHeader
        title="Requirements"
        description={`${project.frameworkName} v${project.frameworkVersion} — ${allRows.length} requirements in scope.`}
        action={<ProjectPicker projects={projects} activeId={project.id} basePath="/app/requirements" />}
      />

      <FilterBar
        basePath="/app/requirements"
        params={{ project: project.id }}
        current={{ status: sp.status, q: sp.q, category: sp.category, owner: sp.owner }}
        searchPlaceholder="Search identifier, title or requirement text…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: REQUIREMENT_STATUSES.map((status) => ({
              value: status,
              label: `${REQUIREMENT_STATUS_META[status].label} (${counts[status] ?? 0})`,
            })),
          },
          {
            key: 'category',
            label: 'Category',
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            key: 'owner',
            label: 'Owner',
            options: [
              { value: 'me', label: 'Assigned to me' },
              ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No requirements match these filters"
            description="Try clearing the filters or searching for something else."
          />
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2.5 font-medium">ID</th>
                  <th className="px-3 py-2.5 font-medium">Requirement</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Evidence</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Importance</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((row) => {
                  const meta = REQUIREMENT_STATUS_META[row.status as RequirementStatus];
                  const importance = row.importanceOverride ?? row.requirement.importance;
                  return (
                    <tr key={row.id} className="table-row-link">
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link href={`/app/requirements/${row.id}`} className="font-mono text-[12px] font-medium text-ink-700">
                          {row.requirement.identifier}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/app/requirements/${row.id}`} className="block">
                          <span className="text-[13.5px] font-medium text-ink-900">{row.requirement.title}</span>
                          <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
                            {truncate(row.requirement.text, 110)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink-600">{row.requirement.category?.name ?? '—'}</td>
                      <td className="px-3 py-3">
                        {row._count.links > 0 ? (
                          <Badge tone="info" size="sm">
                            {row._count.links}
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-ink-400">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink-600">{row.owner?.name ?? <span className="text-ink-400">Unassigned</span>}</td>
                      <td className="px-3 py-3">
                        <span className="text-[12.5px] text-ink-600">{IMPORTANCE_LABELS[importance] ?? importance}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <StatusDot tone={meta.tone} />
                          <span className="whitespace-nowrap text-[12.5px] font-medium text-ink-700">{meta.short}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-[12px] text-ink-400">
        Showing {rows.length} of {allRows.length} requirements.
      </p>
    </div>
  );
}
