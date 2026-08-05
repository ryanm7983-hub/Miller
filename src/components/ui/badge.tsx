import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/enums';

const TONE_STYLES: Record<Tone, string> = {
  strong: 'bg-strong-50 text-strong-700 ring-strong-500/20',
  caution: 'bg-caution-50 text-caution-700 ring-caution-500/20',
  risk: 'bg-risk-50 text-risk-700 ring-risk-500/20',
  info: 'bg-info-50 text-info-700 ring-info-500/20',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-400/20',
  muted: 'bg-ink-50 text-ink-500 ring-ink-300/30',
};

const DOT_STYLES: Record<Tone, string> = {
  strong: 'bg-strong-500',
  caution: 'bg-caution-500',
  risk: 'bg-risk-500',
  info: 'bg-info-500',
  neutral: 'bg-ink-400',
  muted: 'bg-ink-300',
};

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
  className,
  size = 'md',
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
        TONE_STYLES[tone],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_STYLES[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', DOT_STYLES[tone], className)} aria-hidden />;
}
