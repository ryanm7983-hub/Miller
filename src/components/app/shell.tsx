'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Building2,
  CheckSquare,
  ChevronDown,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Search,
  Settings,
  ShieldAlert,
  Table2,
  Users,
  X,
} from 'lucide-react';

import { logoutAction } from '@/app/(auth)/actions';
import { LogoMark } from '@/components/marketing/logo';
import { Avatar } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, type Role } from '@/lib/enums';
import { cn } from '@/lib/utils';

interface Membership {
  orgId: string;
  name: string;
  slug: string;
  role: Role;
  kind: string;
}

interface Props {
  user: { id: string; name: string; email: string };
  org: { id: string; name: string; slug: string; kind: string };
  role: Role;
  viaEngagement: boolean;
  memberships: Membership[];
  unreadCount: number;
  subscription: { planName: string; status: string; daysLeftInTrial: number | null; isActive: boolean };
  activeProject: { id: string; name: string; auditDate: string | null; readinessScore: number } | null;
  children: React.ReactNode;
}

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/audits', label: 'Audits', icon: Gauge },
  { href: '/app/requirements', label: 'Requirements', icon: ListChecks },
  { href: '/app/matrix', label: 'Matrix', icon: Table2 },
  { href: '/app/evidence', label: 'Evidence', icon: FileText },
  { href: '/app/gaps', label: 'Gaps', icon: ShieldAlert },
  { href: '/app/actions', label: 'Actions', icon: CheckSquare },
  { href: '/app/simulator', label: 'Simulator', icon: MessagesSquare },
  { href: '/app/reports', label: 'Reports', icon: FileText },
];

export function AppShell({
  user,
  org,
  role,
  viaEngagement,
  memberships,
  unreadCount,
  subscription,
  activeProject,
  children,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const daysUntilAudit = activeProject?.auditDate
    ? Math.ceil((new Date(activeProject.auditDate).getTime() - Date.now()) / 86_400_000)
    : null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-3 pt-4">
        <OrgSwitcher org={org} memberships={memberships} role={role} viaEngagement={viaEngagement} />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                active
                  ? 'bg-white text-ink-900 shadow-xs ring-1 ring-ink-200'
                  : 'text-ink-600 hover:bg-white/70 hover:text-ink-900'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}

        {org.kind === 'CONSULTANCY' && (
          <Link
            href="/app/clients"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
              pathname.startsWith('/app/clients')
                ? 'bg-white text-ink-900 shadow-xs ring-1 ring-ink-200'
                : 'text-ink-600 hover:bg-white/70 hover:text-ink-900'
            )}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            Clients
          </Link>
        )}

        <div className="pt-2">
          <Link
            href="/app/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
              pathname.startsWith('/app/settings')
                ? 'bg-white text-ink-900 shadow-xs ring-1 ring-ink-200'
                : 'text-ink-600 hover:bg-white/70 hover:text-ink-900'
            )}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            Settings
          </Link>
        </div>
      </nav>

      {activeProject && daysUntilAudit !== null && daysUntilAudit >= 0 && (
        <div className="px-3 pb-3">
          <Link
            href={`/app/audits/${activeProject.id}/prepare`}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'block rounded-lg border p-3 transition-colors',
              daysUntilAudit <= 14
                ? 'border-risk-500/25 bg-risk-50 hover:bg-risk-100'
                : daysUntilAudit <= 45
                  ? 'border-caution-500/25 bg-caution-50 hover:bg-caution-100'
                  : 'border-ink-200 bg-white hover:bg-ink-50'
            )}
          >
            <div
              className={cn(
                'text-[10.5px] font-semibold uppercase tracking-wide',
                daysUntilAudit <= 14 ? 'text-risk-700' : daysUntilAudit <= 45 ? 'text-caution-700' : 'text-ink-500'
              )}
            >
              Audit in
            </div>
            <div
              className={cn(
                'tnum mt-0.5 text-[21px] font-bold leading-none',
                daysUntilAudit <= 14 ? 'text-risk-700' : daysUntilAudit <= 45 ? 'text-caution-700' : 'text-ink-900'
              )}
            >
              {daysUntilAudit} {daysUntilAudit === 1 ? 'day' : 'days'}
            </div>
            <div className="mt-1 truncate text-[11px] text-ink-500">{activeProject.name}</div>
          </Link>
        </div>
      )}

      <div className="border-t border-ink-200 px-3 py-3">
        {(subscription.status === 'TRIALING' || !subscription.isActive) && (
          <Link
            href="/app/settings/billing"
            onClick={() => setMobileOpen(false)}
            className="mb-2.5 block rounded-lg border border-kelp-200 bg-kelp-50 px-3 py-2.5 transition-colors hover:bg-kelp-100"
          >
            <div className="text-[11.5px] font-semibold text-kelp-800">
              {subscription.isActive
                ? `Trial — ${subscription.daysLeftInTrial} day${subscription.daysLeftInTrial === 1 ? '' : 's'} left`
                : 'Trial ended'}
            </div>
            <div className="mt-0.5 text-[11px] text-kelp-700">Choose a plan →</div>
          </Link>
        )}

        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <Avatar name={user.name} seed={user.email} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-ink-900">{user.name}</div>
            <div className="truncate text-[11px] text-ink-500">{ROLE_LABELS[role]}</div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="btn-ghost btn-sm -ml-1.5"
          aria-label="Open navigation"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <LogoMark size={24} />
        <span className="truncate text-[14px] font-semibold text-ink-900">{org.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/app/search" className="btn-ghost btn-sm" aria-label="Search">
            <Search className="h-4 w-4" />
          </Link>
          <NotificationBell count={unreadCount} />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/40"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
          <aside className="absolute left-0 top-0 h-full w-[264px] border-r border-ink-200 bg-ink-50">
            <div className="flex h-14 items-center justify-between border-b border-ink-200 px-4">
              <LogoMark size={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="btn-ghost btn-sm"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">{sidebar}</div>
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 border-r border-ink-200 bg-ink-50/70 lg:block">
          <div className="flex h-14 items-center gap-2 border-b border-ink-200 px-4">
            <Link href="/app/dashboard" className="flex items-center gap-2">
              <LogoMark size={24} />
              <span className="text-[15px] font-bold tracking-tight text-ink-900">
                Audit<span className="text-kelp-700">Ready</span>
              </span>
            </Link>
          </div>
          <div className="h-[calc(100vh-3.5rem)]">{sidebar}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Desktop top bar */}
          <div className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-ink-200 bg-white/90 px-6 backdrop-blur lg:flex">
            <Link
              href="/app/search"
              className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-[13px] text-ink-400 transition-colors hover:border-ink-300 hover:bg-ink-50"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Search documents, requirements, actions…
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <NotificationBell count={unreadCount} />
            </div>
          </div>

          <main className="px-5 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NotificationBell({ count }: { count: number }) {
  return (
    <Link href="/app/notifications" className="relative rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800">
      <Bell className="h-4 w-4" aria-hidden />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-500 px-1 text-[9px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
      <span className="sr-only">{count > 0 ? `${count} unread notifications` : 'Notifications'}</span>
    </Link>
  );
}

function OrgSwitcher({
  org,
  memberships,
  role,
  viaEngagement,
}: {
  org: Props['org'];
  memberships: Membership[];
  role: Role;
  viaEngagement: boolean;
}) {
  const [open, setOpen] = useState(false);
  const others = memberships.filter((m) => m.orgId !== org.id);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-ink-300"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-kelp-700 text-[11px] font-bold text-white">
          {org.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink-900">{org.name}</span>
          <span className="block truncate text-[11px] text-ink-500">
            {viaEngagement ? 'Client engagement' : ROLE_LABELS[role]}
          </span>
        </span>
        {others.length > 0 && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />}
      </button>

      {open && others.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
            Switch organization
          </p>
          {others.map((membership) => (
            <form key={membership.orgId} action={`/api/orgs/${membership.orgId}/activate`} method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-50"
                role="menuitem"
              >
                {membership.kind === 'CONSULTANCY' ? (
                  <Users className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{membership.name}</span>
                <Badge tone="muted" size="sm">
                  {ROLE_LABELS[membership.role]}
                </Badge>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
