'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export function SubmitButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  pendingLabel,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }[variant];

  return (
    <button
      type="submit"
      className={cn(variantClass, `btn-${size}`, className)}
      disabled={pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="label block">
        {label}
        {required && <span className="ml-0.5 text-risk-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && (
        <p className="text-[12.5px] text-risk-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-lg border border-risk-500/25 bg-risk-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-risk-700"
      role="alert"
    >
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-lg border border-strong-500/25 bg-strong-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-strong-700"
      role="status"
    >
      {message}
    </div>
  );
}
