import { requireTenant } from '@/lib/tenant';
import { getSubscription } from '@/lib/billing';
import { unreadCount } from '@/lib/notifications';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/app/shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();

  const [subscription, notifications, activeProject] = await Promise.all([
    getSubscription(tenant.orgId),
    unreadCount(tenant.user.id, tenant.orgId),
    prisma.auditProject.findFirst({
      where: { orgId: tenant.orgId, status: { not: 'ARCHIVED' } },
      orderBy: [{ auditDate: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, auditDate: true, readinessScore: true },
    }),
  ]);

  return (
    <AppShell
      user={{ id: tenant.user.id, name: tenant.user.name, email: tenant.user.email }}
      org={tenant.org}
      role={tenant.role}
      viaEngagement={tenant.viaEngagement}
      memberships={tenant.memberships}
      unreadCount={notifications}
      subscription={{
        planName: subscription.plan.name,
        status: subscription.status,
        daysLeftInTrial: subscription.daysLeftInTrial,
        isActive: subscription.isActive,
      }}
      activeProject={
        activeProject
          ? {
              id: activeProject.id,
              name: activeProject.name,
              auditDate: activeProject.auditDate?.toISOString() ?? null,
              readinessScore: activeProject.readinessScore,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
