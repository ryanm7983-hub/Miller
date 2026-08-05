import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { Card, CardHeader } from '@/components/ui/primitives';
import { AccountForms } from './account-forms';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Your account' };

export default async function AccountSettingsPage() {
  const tenant = await requireTenant();

  const [user, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: tenant.user.id } }),
    prisma.session.findMany({
      where: { userId: tenant.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  if (!user) return null;

  return (
    <div className="space-y-4">
      <AccountForms user={{ name: user.name, jobTitle: user.jobTitle, email: user.email }} />

      <Card>
        <CardHeader
          title="Active sessions"
          description="Changing your password signs out every session except this one."
        />
        <ul className="divide-y divide-ink-100">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink-800">
                  {session.userAgent ? session.userAgent.slice(0, 90) : 'Unknown device'}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {session.ip ? `${session.ip} · ` : ''}
                  started {formatDateTime(session.createdAt)} · expires {formatDateTime(session.expiresAt)}
                </p>
              </div>
              {session.id === tenant.user.sessionId && (
                <span className="text-[12px] font-medium text-kelp-700">This session</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
