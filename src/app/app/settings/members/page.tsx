import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can, assignableRoles } from '@/lib/auth/rbac';
import { getSubscription, getUsage } from '@/lib/billing';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from '@/lib/enums';
import { Card, CardHeader, Avatar, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { AddMemberForm } from './add-member-form';
import { MemberRow } from './member-row';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  const tenant = await requireTenant();

  const [members, subscription, usage] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: tenant.orgId },
      include: { user: { select: { id: true, name: true, email: true, jobTitle: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    getSubscription(tenant.orgId),
    getUsage(tenant.orgId),
  ]);

  const canManage = can(tenant.role, 'members:manage');
  const assignable = assignableRoles(tenant.role);
  const limit = subscription.plan.limits.members;
  const atLimit = limit !== -1 && usage.members >= limit;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`Members (${members.length}${limit === -1 ? '' : ` of ${limit}`})`}
          description="Everyone who can access this organization's audits, evidence and reports."
        />
        <ul className="divide-y divide-ink-100">
          {members.map((membership) => (
            <MemberRow
              key={membership.id}
              membership={{
                id: membership.id,
                role: membership.role,
                createdAt: membership.createdAt.toISOString(),
                isSelf: membership.userId === tenant.user.id,
              }}
              user={{
                name: membership.user.name,
                email: membership.user.email,
                jobTitle: membership.user.jobTitle,
                lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
              }}
              assignableRoles={assignable}
              canManage={canManage}
            />
          ))}
        </ul>
      </Card>

      {canManage && (
        <Card>
          <CardHeader
            title="Add a member"
            description="Creates their account with a temporary password you hand over. They change it after signing in."
          />
          <div className="p-5">
            {atLimit ? (
              <Alert tone="warning" title="Plan limit reached">
                Your {subscription.plan.name} plan includes {limit} member{limit === 1 ? '' : 's'}. Upgrade in Billing to
                add more.
              </Alert>
            ) : (
              <AddMemberForm assignableRoles={assignable} />
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="What each role can do" />
        <ul className="divide-y divide-ink-100">
          {ROLES.filter((role) => role !== 'CONSULTANT').map((role) => (
            <li key={role} className="flex items-start gap-3 px-5 py-3">
              <Badge tone={role === 'OWNER' ? 'strong' : role === 'VIEWER' ? 'muted' : 'neutral'} size="sm" className="mt-0.5 w-[92px] justify-center">
                {ROLE_LABELS[role]}
              </Badge>
              <p className="text-[13px] leading-relaxed text-ink-600">{ROLE_DESCRIPTIONS[role]}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Keep the avatar + date helpers exercised in this file's own summary. */}
      <p className="text-center text-[12px] text-ink-400">
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Avatar name={tenant.user.name} seed={tenant.user.email} size="xs" />
          You joined as {ROLE_LABELS[tenant.role as Role]} on{' '}
          {formatDate(members.find((m) => m.userId === tenant.user.id)?.createdAt)}
        </span>
      </p>
    </div>
  );
}
