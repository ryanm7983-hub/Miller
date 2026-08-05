import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from '@/lib/enums';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { relativeTime } from '@/lib/utils';
import { markAllReadAction, markReadAction } from './actions';

export const metadata: Metadata = { title: 'Notifications' };

const TYPE_TONES: Record<string, 'risk' | 'caution' | 'info' | 'neutral' | 'strong'> = {
  OVERDUE_ACTION: 'risk',
  EVIDENCE_EXPIRING: 'caution',
  UPCOMING_AUDIT: 'caution',
  ACTION_ASSIGNED: 'info',
  ANALYSIS_COMPLETE: 'info',
  DOCUMENT_UPLOADED: 'neutral',
  REQUIREMENT_CHANGED: 'neutral',
  REVIEW_REQUESTED: 'info',
};

export default async function NotificationsPage() {
  const tenant = await requireTenant();

  const notifications = await prisma.notification.findMany({
    where: { orgId: tenant.orgId, userId: tenant.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={
          unread > 0 ? `${unread} unread in ${tenant.org.name}.` : `You are up to date in ${tenant.org.name}.`
        }
        action={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton variant="secondary" pendingLabel="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title="No notifications yet"
            description="You will be notified about upcoming audits, overdue actions, expiring evidence, work assigned to you, and completed AI analysis."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {notifications.map((notification) => {
              const body = (
                <div className="flex items-start gap-3">
                  {!notification.readAt && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kelp-600" aria-label="Unread" />
                  )}
                  <div className={`min-w-0 flex-1 ${notification.readAt ? 'pl-5' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TYPE_TONES[notification.type] ?? 'neutral'} size="sm">
                        {NOTIFICATION_TYPE_LABELS[notification.type as NotificationType] ?? notification.type}
                      </Badge>
                      <span className="text-[11.5px] text-ink-400">{relativeTime(notification.createdAt)}</span>
                      {notification.emailedAt && (
                        <span className="text-[11.5px] text-ink-400">· emailed</span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[13.5px] ${notification.readAt ? 'text-ink-700' : 'font-semibold text-ink-900'}`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{notification.body}</p>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={notification.id} className="px-5 py-3.5">
                  {notification.link ? (
                    <form action={markReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="redirectTo" value={notification.link} />
                      <button type="submit" className="w-full text-left">
                        {body}
                      </button>
                    </form>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-center text-[12.5px] text-ink-500">
        Email delivery is controlled by your{' '}
        <Link href="/app/settings" className="link">
          organization settings
        </Link>
        .
      </p>
    </div>
  );
}
