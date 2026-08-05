import Link from 'next/link';
import { Check } from 'lucide-react';

import { Logo } from '@/components/marketing/logo';
import { AI_DISCLAIMER } from '@/lib/enums';

const POINTS = [
  'See a real readiness score the same afternoon',
  'AI reads your evidence and flags what looks missing',
  'Turn every gap into an owned, tracked action',
  'Generate an audit preparation report in one click',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="mx-auto max-w-md text-center text-[11.5px] leading-relaxed text-ink-400">
          {AI_DISCLAIMER}
        </p>
      </div>

      {/* Brand side */}
      <aside className="relative hidden w-[46%] max-w-[560px] overflow-hidden bg-kelp-900 px-12 py-14 lg:flex lg:flex-col lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-kelp-400/25 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <blockquote className="text-[26px] font-bold leading-snug text-white">
            &ldquo;If an auditor showed up tomorrow, how prepared are we?&rdquo;
          </blockquote>
          <p className="mt-4 text-[15px] leading-relaxed text-kelp-100">
            That is the only question that matters in the weeks before an audit — and the one most teams cannot answer.
            AuditReady answers it with a number, and then tells you exactly what to do about it.
          </p>

          <ul className="mt-9 space-y-3.5">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[14.5px] leading-relaxed text-kelp-50">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3 w-3 text-white" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <Link
            href="/#how-it-works"
            className="mt-10 inline-flex text-[13.5px] font-medium text-kelp-200 underline decoration-kelp-200/40 underline-offset-4 transition-colors hover:text-white"
          >
            See how it works
          </Link>
        </div>
      </aside>
    </div>
  );
}
