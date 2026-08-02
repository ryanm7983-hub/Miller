import { forwardRef, useId } from 'react';

/* ------------------------------------------------------------------ Card */

/**
 * Surface container. `interactive` adds the hover lift used by clickable
 * cards; static cards stay put, so movement always means "you can click this".
 */
export function Card({ as: Tag = 'div', interactive = false, className = '', children, ...rest }) {
  return (
    <Tag
      className={`rounded-2xl bg-surface ring-1 ring-border shadow-sm ${
        interactive
          ? 'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-border-strong'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, className = '', id }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 id={id} className="text-section text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-help mt-0.5 text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-ink-2 ring-border',
  primary: 'bg-primary-wash text-primary ring-primary/25',
  success: 'bg-success-wash text-success-text ring-success-border',
  warning: 'bg-warning-wash text-warning-text ring-warning/30',
  danger: 'bg-danger-wash text-danger-text ring-danger-border',
};

export function Badge({ tone = 'neutral', icon: Icon, className = '', children, ...rest }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] leading-none font-semibold whitespace-nowrap ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Input */

/**
 * Labelled control with helper and error text wired to the input via
 * aria-describedby, so a screen reader hears the error, not just sighted users.
 */
export const Field = forwardRef(function Field(
  {
    label,
    hint,
    error,
    icon: Icon,
    prefix,
    className = '',
    inputClassName = '',
    id: providedId,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        )}
        {prefix && (
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`h-11 w-full rounded-xl bg-surface text-ink ring-1 shadow-xs transition-[box-shadow,background-color] duration-150 outline-none placeholder:text-muted focus:ring-2 ${
            error
              ? 'ring-danger focus:ring-danger'
              : 'ring-border hover:ring-border-strong focus:ring-primary'
          } ${Icon || prefix ? 'pl-10' : 'pl-3.5'} pr-3.5 ${inputClassName}`}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-help mt-1.5 text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-help mt-1.5 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** Checkbox with its label, sized for touch. */
export function Checkbox({ checked, onChange, label, description, id: providedId }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border-border-strong accent-primary"
      />
      <label htmlFor={id} className="cursor-pointer text-[13px] leading-snug text-ink-2">
        {label}
        {description && <span className="block text-help text-muted">{description}</span>}
      </label>
    </div>
  );
}

/* ------------------------------------------------- Segmented / Tab control */

export function Segmented({ value, onChange, options, label, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]';
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-xl bg-surface-2 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`${pad} rounded-lg font-semibold transition-all duration-150 ${
              active
                ? 'bg-surface text-ink shadow-xs ring-1 ring-border'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-lg bg-[var(--ps-skeleton)] ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--ps-skeleton-sheen)] to-transparent [animation:ps-shimmer_1.6s_infinite]" />
    </span>
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3.5 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- Empty state */

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted ring-1 ring-border">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-section text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
