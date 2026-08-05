'use client';

import { useActionState, useState } from 'react';

import { changePasswordAction, updateProfileAction, type SettingsState } from '../actions';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { checkPasswordStrength } from '@/lib/auth/password';
import { cn } from '@/lib/utils';

const initialState: SettingsState = {};

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-risk-500', 'bg-risk-500', 'bg-caution-500', 'bg-strong-500', 'bg-strong-600'];

export function AccountForms({
  user,
}: {
  user: { name: string; jobTitle: string | null; email: string };
}) {
  const [profileState, profileAction] = useActionState(updateProfileAction, initialState);
  const [passwordState, passwordAction] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState('');
  const check = checkPasswordStrength(newPassword);

  return (
    <>
      <Card>
        <CardHeader title="Your profile" description="Shown on comments, reports and assignments." />
        <form action={profileAction} className="space-y-4 p-5" noValidate>
          <FormError message={profileState.error} />
          <FormSuccess message={profileState.success} />

          <Field label="Full name" htmlFor="name" required>
            <input id="name" name="name" className="input" defaultValue={user.name} required />
          </Field>

          <Field label="Job title" htmlFor="jobTitle">
            <input id="jobTitle" name="jobTitle" className="input" defaultValue={user.jobTitle ?? ''} placeholder="Quality Manager" />
          </Field>

          <Field label="Email" htmlFor="email" hint="Contact an administrator to change your sign-in email.">
            <input id="email" className="input" defaultValue={user.email} disabled />
          </Field>

          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" description="Your other sessions will be signed out." />
        <form action={passwordAction} className="space-y-4 p-5" noValidate>
          <FormError message={passwordState.error} />
          <FormSuccess message={passwordState.success} />

          <Field label="Current password" htmlFor="currentPassword" required>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="input"
              required
            />
          </Field>

          <Field label="New password" htmlFor="newPassword" required>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className="input"
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {newPassword.length > 0 && (
              <div className="pt-1">
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

          <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
        </form>
      </Card>
    </>
  );
}
