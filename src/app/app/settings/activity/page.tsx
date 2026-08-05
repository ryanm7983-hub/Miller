import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { parseJson } from '@/lib/json';
import { Card, CardHeader, EmptyState, Avatar } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Activity log' };

const SENSITIVE_ACTIONS = new Set([
  'auth.login_failed',
  'member.role_changed',
  'member.removed',
  'evidence.deleted',
  'project.deleted',
  'billing.plan_changed',
  'billing.canceled',
  'auth.password_changed',
]);

export default async function ActivityLogPage() {
  const tenant = await requireTenant();
  if (!can(tenant.role, 'org:manage')) redirect('/app/settings');

  const entries = await prisma.auditLog.findMany({
    where: { orgId: tenant.orgId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <Card>
      <CardHeader
        title="Activity log"
        description="An append-only record of sensitive operations: authentication, membership and role changes, evidence access, AI runs, billing and exports."
      />

      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" description="Activity appears here as your team uses AuditReady." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {entries.map((entry) => {
            const metadata = parseJson<Record<string, unknown>>(entry.metadata, {});
            const details = Object.entries(metadata)
              .filter(([, value]) => value !== null && value !== undefined && value !== '')
              .slice(0, 4)
              .map(([key, value]) => `${key}: ${String(value).slice(0, 60)}`)
              .join(' · ');

            return (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                {entry.user ? (
                  <Avatar name={entry.user.name} seed={entry.user.email} size="sm" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[9px] font-semibold text-ink-500">
                    SYS
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
                      {entry.action}
                    </code>
                    {SENSITIVE_ACTIONS.has(entry.action) && (
                      <Badge tone="caution" size="sm">
                        Sensitive
                      </Badge>
                    )}
                    <span className="text-[11.5px] text-ink-400">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-600">
                    {entry.user?.name ?? 'System'}
                    {entry.entityType && ` · ${entry.entityType}`}
                    {entry.ip && ` · ${entry.ip}`}
                  </p>
                  {details && <p className="mt-0.5 truncate text-[12px] text-ink-500">{details}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
