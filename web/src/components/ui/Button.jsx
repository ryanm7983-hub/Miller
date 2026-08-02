import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The one button in the app.
 *
 * variant: primary | secondary | outline | ghost | danger | success
 * size:    sm | md | lg | icon
 *
 * `loading` keeps the button's width stable (the label stays in flow at zero
 * opacity) so a row of buttons doesn't reflow mid-click.
 */
const VARIANTS = {
  primary:
    'bg-primary text-white shadow-[var(--ps-shadow-primary)] hover:bg-primary-hover active:translate-y-px',
  secondary:
    'bg-surface text-ink ring-1 ring-border hover:bg-surface-2 hover:ring-border-strong active:translate-y-px shadow-xs',
  outline:
    'bg-transparent text-ink ring-1 ring-border-strong hover:bg-surface-2 active:translate-y-px',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:translate-y-px',
  danger:
    'bg-danger text-white hover:brightness-110 active:translate-y-px shadow-xs',
  success:
    'bg-success text-white hover:brightness-110 active:translate-y-px shadow-xs',
};

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-6 text-[15px]',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform,color] duration-150 disabled:pointer-events-none disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </span>
      )}
      <span
        className={`inline-flex items-center ${SIZES[size].includes('gap') ? 'gap-2' : ''} ${
          loading ? 'opacity-0' : ''
        }`}
      >
        {children}
      </span>
    </button>
  );
});

/** Anchor styled as a button — for outbound links like "Buy at Amazon". */
export function ButtonLink({ variant = 'secondary', size = 'md', className = '', children, ...rest }) {
  return (
    <a
      className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap no-underline transition-[background-color,box-shadow,transform,color] duration-150 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}
