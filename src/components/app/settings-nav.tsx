'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function SettingsNav({ tabs }: { tabs: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Settings">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors',
              active
                ? 'border-kelp-700 text-ink-900'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
