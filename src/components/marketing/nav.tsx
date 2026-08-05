'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { Logo } from './logo';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#analysis', label: 'AI analysis' },
  { href: '#gaps', label: 'Gap detection' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/app/dashboard" className="btn-primary btn-sm">
              Open AuditReady
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden btn-ghost btn-sm sm:inline-flex">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary btn-sm">
                Check your readiness
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost btn-sm -mr-1.5 lg:hidden"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-ink-200 bg-white px-5 py-3 lg:hidden" aria-label="Mobile">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-[14px] font-medium text-ink-700 hover:bg-ink-50"
            >
              {link.label}
            </a>
          ))}
          {!signedIn && (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-[14px] font-medium text-ink-700 hover:bg-ink-50 sm:hidden"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
