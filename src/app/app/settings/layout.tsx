import Link from 'next/link';

import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/ui/primitives';
import { SettingsNav } from '@/components/app/settings-nav';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();

  const tabs = [
    { href: '/app/settings', label: 'Organization', show: true },
    { href: '/app/settings/members', label: 'Members', show: true },
    { href: '/app/settings/account', label: 'Your account', show: true },
    { href: '/app/settings/billing', label: 'Billing', show: can(tenant.role, 'billing:manage') },
    { href: '/app/settings/activity', label: 'Activity log', show: can(tenant.role, 'org:manage') },
  ].filter((tab) => tab.show);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description={tenant.org.name} />
      <SettingsNav tabs={tabs.map(({ href, label }) => ({ href, label }))} />
      <div className="mt-5">{children}</div>
      <p className="mt-8 text-center text-[12px] text-ink-400">
        Need something that isn&rsquo;t here?{' '}
        <Link href="/app/dashboard" className="link">
          Back to the dashboard
        </Link>
      </p>
    </div>
  );
}
