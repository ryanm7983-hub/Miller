import type { Metadata } from 'next';
import Link from 'next/link';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import {
  GAP_STATUSES,
  GAP_STATUS_META,
  GAP_TYPES,
  GAP_TYPE_LABELS,
  SEVERITIES,
  SEVERITY_META,
  type GapStatus,
  type GapType,
  type Severity,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { ProjectPicker } from '@/components/app/project-picker';
import { FilterBar } from '@/components/app/filter-bar';
import { formatDate } from '@/lib/utils';
import { refreshProjectAction } from '../audits/actions';

export const metadata: Metadata = { title: 'Gap Center' };

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default async function GapsPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    severity?: string;
    status?: string;
    type?: string;
    department?: string;
    owner?: string;
    q?: string;
  }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Gap Center" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" />}
            title="No audit project yet"
            description="Gaps are detected against the requirements and evidence in an audit project."
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
  const statusFilter = sp.status && GAP_STATUSES.includes(sp.status as GapStatus) ? sp.status : undefined;

  const [gaps, allGaps, departments, members] = await Promise.all([
    prisma.gap.findMany({
      where: {
        orgId: tenant.orgId,
        projectId: project.id,
        ...(statusFilter ? { status: statusFilter } : { status: { in: ['OPEN', 'IN_PROGRESS'] } }),
        ...(sp.severity && SEVERITIES.includes(sp.severity as Severity) ? { severity: sp.severity } : {}),
        ...(sp.type && GAP_TYPES.includes(sp.type as GapType) ? { type: sp.type } : {}),
        ...(sp.department ? { department: sp.department } : {}),
        ...(sp.owner === 'me' ? { ownerUserId: tenant.user.id } : sp.owner ? { ownerUserId: sp.owner } : {}),
        ...(query ? { OR: [{ title: { contains: query } }, { description: { contains: query } }] } : {}),
      },
      include: {
        projectRequirement: { include: { requirement: { select: { identifier: true, title: true } } } },
        evidence: { select: { id: true, title: true, filename: true } },
        owner: { select: { name: true } },
        _count: { select: { actions: true } },
      },
      take: 400,
    }),
    prisma.gap.findMany({
      where: { orgId: tenant.orgId, projectId: project.id },
      select: { severity: true, status: true },
    }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
    prisma.membership.findMany({
      where: { orgId: tenant.orgId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const sorted = [...gaps].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  const open = allGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS');
  const counts = {
    critical: open.filter((g) => g.severity === 'CRITICAL').length,
    high: open.filter((g) => g.severity === 'HIGH').length,
    medium: open.filter((g) => g.severity === 'MEDIUM').length,
    low: open.filter((g) => g.severity === 'LOW').length,
    resolved: allGaps.filter((g) => g.status === 'RESOLVED').length,
  };

  return (
    <div>
      <PageHeader
        title="Gap Center"
        description={`Everything currently flagged on ${project.name}, ranked by how much trouble it is likely to cause.`}
        action={
          <>
            <ProjectPicker projects={projects} activeId={project.id} basePath="/app/gaps" />
            {can(tenant.role, 'gap:manage') && (
              <form action={refreshProjectAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <SubmitButton variant="secondary" pendingLabel="Re-checking…">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Re-run detection
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Critical', value: counts.critical, tone: 'risk' as const, severity: 'CRITICAL' },
          { label: 'High', value: counts.high, tone: 'risk' as const, severity: 'HIGH' },
          { label: 'Medium', value: counts.medium, tone: 'caution' as const, severity: 'MEDIUM' },
          { label: 'Low', value: counts.low, tone: 'default' as const, severity: 'LOW' },
          { label: 'Resolved', value: counts.resolved, tone: 'strong' as const, severity: '' },
        ].map((tile) => (
          <Link
            key={tile.label}
            href={
              tile.severity
                ? `/app/gaps?project=${project.id}&severity=${tile.severity}`
                : `/app/gaps?project=${project.id}&status=RESOLVED`
            }
          >
            <Card className="card-hover">
              <Stat label={tile.label} value={tile.value} tone={tile.tone} />
            </Card>
          </Link>
        ))}
      </div>

      <FilterBar
        basePath="/app/gaps"
        params={{ project: project.id }}
        current={{
          severity: sp.severity,
          status: sp.status,
          type: sp.type,
          department: sp.department,
          owner: sp.owner,
          q: sp.q,
        }}
        searchPlaceholder="Search gap titles and descriptions…"
        filters={[
          { key: 'severity', label: 'Severity', options: SEVERITIES.map((s) => ({ value: s, label: SEVERITY_META[s].label })) },
          { key: 'status', label: 'Status', options: GAP_STATUSES.map((s) => ({ value: s, label: GAP_STATUS_META[s].label })) },
          { key: 'type', label: 'Type', options: GAP_TYPES.map((t) => ({ value: t, label: GAP_TYPE_LABELS[t] })) },
          { key: 'department', label: 'Department', options: departments.map((d) => ({ value: d.name, label: d.name })) },
          {
            key: 'owner',
            label: 'Owner',
            options: [{ value: 'me', label: 'Assigned to me' }, ...members.map((m) => ({ value: m.user.id, label: m.user.name }))],
          },
        ]}
      />

      {sorted.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title={statusFilter ? 'Nothing matches these filters' : 'No open gaps'}
            description={
              statusFilter
                ? 'Try clearing the filters.'
                : 'Nothing is currently flagged on this project. Keep uploading evidence — detection re-runs automatically as your library grows.'
            }
          />
        </Card>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sorted.map((gap) => (
            <li key={gap.id}>
              <Link href={`/app/gaps/${gap.id}`}>
                <Card className="card-hover p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge tone={SEVERITY_META[gap.severity as Severity].tone} className="mt-0.5 w-[70px] justify-center">
                      {SEVERITY_META[gap.severity as Severity].label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ink-900">{gap.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{gap.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                        <Badge tone="muted" size="sm">
                          {GAP_TYPE_LABELS[gap.type as GapType] ?? gap.type}
                        </Badge>
                        {gap.projectRequirement && (
                          <span className="font-mono text-[11.5px]">
                            {gap.projectRequirement.requirement.identifier}
                          </span>
                        )}
                        {gap.evidence && <span>{gap.evidence.title || gap.evidence.filename}</span>}
                        {gap.department && <span>· {gap.department}</span>}
                        {gap.owner && <span>· {gap.owner.name}</span>}
                        {gap.dueDate && <span>· due {formatDate(gap.dueDate)}</span>}
                        <Badge tone={gap.detectedBy === 'AI' ? 'info' : 'muted'} size="sm">
                          {gap.detectedBy === 'AI' ? 'AI detected' : gap.detectedBy === 'HUMAN' ? 'Raised by a person' : 'System detected'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={GAP_STATUS_META[gap.status as GapStatus].tone} size="sm">
                        {GAP_STATUS_META[gap.status as GapStatus].label}
                      </Badge>
                      {gap._count.actions > 0 && (
                        <span className="text-[11.5px] text-ink-500">
                          {gap._count.actions} action{gap._count.actions === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
