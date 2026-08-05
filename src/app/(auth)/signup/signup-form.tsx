'use client';

import { useActionState, useState } from 'react';

import { signupAction, type AuthFormState } from '../actions';
import { checkPasswordStrength } from '@/lib/auth/password';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const initialState: AuthFormState = {};

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-risk-500', 'bg-risk-500', 'bg-caution-500', 'bg-strong-500', 'bg-strong-600'];

export function SignupForm({ plan }: { plan?: string }) {
  const [state, formAction] = useActionState(signupAction, initialState);
  const [password, setPassword] = useState('');
  const check = checkPasswordStrength(password);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {plan && <input type="hidden" name="plan" value={plan} />}

      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name} required>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="input"
          placeholder="Dana Whitfield"
        />
      </Field>

      <Field
        label="Job title"
        htmlFor="jobTitle"
        hint="Optional — helps us set sensible defaults for your role."
        error={state.fieldErrors?.jobTitle}
      >
        <input
          id="jobTitle"
          name="jobTitle"
          type="text"
          autoComplete="organization-title"
          className="input"
          placeholder="Quality Manager"
        />
      </Field>

      <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email} required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password} required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="input"
          placeholder="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-strength"
        />
        {password.length > 0 && (
          <div id="password-strength" className="pt-1">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i < check.score ? STRENGTH_COLORS[check.score] : 'bg-ink-200'
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-500">
              <span className="font-medium text-ink-700">{STRENGTH_LABELS[check.score]}</span>
              {check.problems.length > 0 && ` — ${check.problems[0]}`}
            </p>
          </div>
        )}
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>

      <p className="hint text-center">
        By creating an account you agree that AuditReady is a preparedness tool and does not provide certification or
        legal advice.
      </p>
    </form>
  );
}
