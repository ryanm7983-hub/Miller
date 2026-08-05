import Link from 'next/link';
import { cn, avatarStyle, initials } from '@/lib/utils';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-500">
          {breadcrumb.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-ink-300">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-ink-800">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-ink-900 sm:text-[25px]">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-600">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-ink-100 text-ink-500">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({
  name,
  seed,
  size = 'md',
  className,
}: {
  name: string;
  seed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const style = avatarStyle(seed ?? name);
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-[11px]',
    lg: 'h-10 w-10 text-[13px]',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        style.bg,
        style.fg,
        sizes[size],
        className
      )}
      title={name}
    >
      {initials(name) || '?'}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'strong' | 'caution' | 'risk' | 'default';
  className?: string;
}) {
  const valueTone = {
    strong: 'text-strong-600',
    caution: 'text-caution-600',
    risk: 'text-risk-600',
    default: 'text-ink-900',
  }[tone ?? 'default'];

  return (
    <div className={cn('px-4 py-3.5', className)}>
      <div className="text-[12px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn('tnum mt-1 text-[24px] font-bold leading-none', valueTone)}>{value}</div>
      {sub && <div className="mt-1.5 text-[12.5px] text-ink-500">{sub}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-ink-200', className)} />;
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-info-500/25 bg-info-50 text-info-700',
    warning: 'border-caution-500/25 bg-caution-50 text-caution-700',
    danger: 'border-risk-500/25 bg-risk-50 text-risk-700',
    success: 'border-strong-500/25 bg-strong-50 text-strong-700',
  }[tone];

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-[13px] leading-relaxed', styles, className)} role="status">
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      <div className={title ? 'opacity-90' : ''}>{children}</div>
    </div>
  );
}

/** Horizontal proportion bar used for status breakdowns. */
export function SegmentBar({
  segments,
  className,
}: {
  segments: Array<{ value: number; className: string; label: string }>;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className={cn('h-2 w-full rounded-full bg-ink-100', className)} />;
  }
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            className={s.className}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
    </div>
  );
}
