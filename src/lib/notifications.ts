import 'server-only';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import type { NotificationType } from '@/lib/enums';

/**
 * In-app notifications with optional email delivery.
 *
 * Notifications are always written to the database (so the bell icon works with
 * no email configuration) and optionally mirrored to email through the provider
 * abstraction.
 */
export async function notify(params: {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** App-relative path, e.g. `/app/actions/abc`. */
  link?: string;
  alsoEmail?: boolean;
}) {
  const notification = await prisma.notification.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });

  if (params.alsoEmail) {
    const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { email: true } });
    if (user) {
      const result = await sendEmail({
        to: user.email,
        subject: params.title,
        text: params.body ?? params.title,
        action: params.link ? { label: 'Open in AuditReady', url: `${env.appUrl}${params.link}` } : undefined,
      });
      if (result.ok) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { emailedAt: new Date() },
        });
      }
    }
  }

  return notification;
}

/** Fan-out to every active member of an org holding one of the given roles. */
export async function notifyRoles(params: {
  orgId: string;
  roles: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  excludeUserId?: string;
  alsoEmail?: boolean;
}) {
  const members = await prisma.membership.findMany({
    where: { orgId: params.orgId, status: 'ACTIVE', role: { in: params.roles } },
    select: { userId: true },
  });

  await Promise.all(
    members
      .filter((m) => m.userId !== params.excludeUserId)
      .map((m) =>
        notify({
          orgId: params.orgId,
          userId: m.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          link: params.link,
          alsoEmail: params.alsoEmail,
        })
      )
  );
}

export async function unreadCount(userId: string, orgId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, orgId, readAt: null } });
}

/**
 * Generates time-based notifications: upcoming audits, overdue actions and
 * expiring evidence. Idempotent within a 24-hour window, so it is safe to call
 * on dashboard load (and from a scheduled job in production).
 */
export async function runNotificationSweep(orgId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - 20 * 3_600_000);
  const created: string[] = [];

  const alreadySent = await prisma.notification.findMany({
    where: { orgId, createdAt: { gte: since } },
    select: { type: true, link: true, userId: true },
  });
  const seen = new Set(alreadySent.map((n) => `${n.type}:${n.link}:${n.userId}`));

  // Upcoming audits (30 / 14 / 7 day markers).
  const projects = await prisma.auditProject.findMany({
    where: { orgId, status: { notIn: ['ARCHIVED'] }, auditDate: { not: null } },
    select: { id: true, name: true, auditDate: true, leadUserId: true },
  });

  for (const project of projects) {
    if (!project.auditDate) continue;
    const days = Math.ceil((project.auditDate.getTime() - now.getTime()) / 86_400_000);
    if (![30, 14, 7, 3, 1].includes(days)) continue;

    const link = `/app/audits/${project.id}`;
    const recipients = project.leadUserId
      ? [project.leadUserId]
      : (
          await prisma.membership.findMany({
            where: { orgId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN', 'MANAGER'] } },
            select: { userId: true },
          })
        ).map((m) => m.userId);

    for (const userId of recipients) {
      if (seen.has(`UPCOMING_AUDIT:${link}:${userId}`)) continue;
      await notify({
        orgId,
        userId,
        type: 'UPCOMING_AUDIT',
        title: `${days} day${days === 1 ? '' : 's'} until the ${project.name} audit`,
        body: `Your audit date is ${project.auditDate.toISOString().slice(0, 10)}. Open the preparation view to see your top priorities.`,
        link,
        alsoEmail: days <= 7,
      });
      created.push('UPCOMING_AUDIT');
    }
  }

  // Overdue actions.
  const overdue = await prisma.action.findMany({
    where: {
      orgId,
      status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] },
      dueDate: { lt: now },
      ownerUserId: { not: null },
    },
    select: { id: true, title: true, ownerUserId: true, dueDate: true },
    take: 100,
  });

  for (const action of overdue) {
    if (!action.ownerUserId) continue;
    const link = `/app/actions/${action.id}`;
    if (seen.has(`OVERDUE_ACTION:${link}:${action.ownerUserId}`)) continue;
    const days = Math.floor((now.getTime() - (action.dueDate?.getTime() ?? 0)) / 86_400_000);
    await notify({
      orgId,
      userId: action.ownerUserId,
      type: 'OVERDUE_ACTION',
      title: `Overdue: ${action.title}`,
      body: `This action is ${days} day${days === 1 ? '' : 's'} past its due date.`,
      link,
    });
    created.push('OVERDUE_ACTION');
  }

  // Evidence expiring within 30 days.
  const expiring = await prisma.evidence.findMany({
    where: {
      orgId,
      status: { notIn: ['SUPERSEDED', 'REJECTED'] },
      expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 86_400_000) },
      ownerUserId: { not: null },
    },
    select: { id: true, title: true, filename: true, ownerUserId: true, expiresAt: true },
    take: 100,
  });

  for (const doc of expiring) {
    if (!doc.ownerUserId || !doc.expiresAt) continue;
    const link = `/app/evidence/${doc.id}`;
    if (seen.has(`EVIDENCE_EXPIRING:${link}:${doc.ownerUserId}`)) continue;
    const days = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 86_400_000);
    await notify({
      orgId,
      userId: doc.ownerUserId,
      type: 'EVIDENCE_EXPIRING',
      title: `“${doc.title || doc.filename}” expires in ${days} day${days === 1 ? '' : 's'}`,
      body: `Renew this evidence before ${doc.expiresAt.toISOString().slice(0, 10)} so it still counts at audit time.`,
      link,
    });
    created.push('EVIDENCE_EXPIRING');
  }

  return { created: created.length };
}
