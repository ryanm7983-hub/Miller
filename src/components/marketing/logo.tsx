import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * AuditReady mark: a document sheet with a checked baseline — evidence that
 * has been looked at. Drawn as inline SVG so it renders identically everywhere
 * (including print and email clients that strip external assets).
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-kelp-700" />
      <path
        d="M11 8.5h7.2L23 13.1V22a1.5 1.5 0 0 1-1.5 1.5H11A1.5 1.5 0 0 1 9.5 22V10A1.5 1.5 0 0 1 11 8.5Z"
        className="fill-white/12"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="1.3"
      />
      <path d="M18 8.6V13a.6.6 0 0 0 .6.6h4.2" stroke="white" strokeOpacity="0.55" strokeWidth="1.3" />
      <path
        d="m12.6 17.8 2.3 2.4 4.6-5"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  href = '/',
  size = 28,
  showWordmark = true,
}: {
  className?: string;
  href?: string | null;
  size?: number;
  showWordmark?: boolean;
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[16px] font-bold tracking-tight text-ink-900">
          Audit<span className="text-kelp-700">Ready</span>
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex rounded-lg transition-opacity hover:opacity-85">
      {content}
    </Link>
  );
}
