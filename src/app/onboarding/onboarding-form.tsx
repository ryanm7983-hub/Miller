'use client';

import { useActionState, useState } from 'react';
import { Building2, Users } from 'lucide-react';

import { createOrganizationAction, type OnboardingState } from './actions';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const initialState: OnboardingState = {};

const INDUSTRIES = [
  'Manufacturing',
  'Food & beverage',
  'Automotive',
  'Aerospace',
  'Medical devices',
  'Construction',
  'Engineering services',
  'Logistics & warehousing',
  'Chemicals',
  'Electronics',
  'Energy & utilities',
  'Other',
];

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

export function OnboardingForm() {
  const [state, formAction] = useActionState(createOrganizationAction, initialState);
  const [kind, setKind] = useState<'STANDARD' | 'CONSULTANCY'>('STANDARD');

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="kind" value={kind} />

      <fieldset>
        <legend className="label mb-2">What describes you best?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(
            [
              {
                value: 'STANDARD' as const,
                icon: Building2,
                title: 'A single organization',
                body: 'We are preparing our own site or company for audits.',
              },
              {
                value: 'CONSULTANCY' as const,
                icon: Users,
                title: 'A consultancy',
                body: 'We prepare other organizations for their audits.',
              },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={cn(
                'rounded-lg border p-3.5 text-left transition-all',
                kind === option.value
                  ? 'border-kelp-500 bg-kelp-50/60 ring-1 ring-kelp-500/20'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
              )}
            >
              <option.icon
                className={cn('h-4.5 w-4.5', kind === option.value ? 'text-kelp-700' : 'text-ink-400')}
                aria-hidden
              />
              <div className="mt-2 text-[14px] font-semibold text-ink-900">{option.title}</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{option.body}</div>
            </button>
          ))}
        </div>
        {kind === 'CONSULTANCY' && (
          <p className="hint mt-2">
            Consultancy workspaces can be granted scoped access to client organizations. The client portfolio dashboard
            ships with the Consultant tier — the structure is in place now.
          </p>
        )}
      </fieldset>

      <Field
        label="Organization name"
        htmlFor="name"
        error={state.fieldErrors?.name}
        hint="This appears on your reports."
        required
      >
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          className="input"
          placeholder="Northfield Manufacturing"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry" htmlFor="industry" error={state.fieldErrors?.industry}>
          <select id="industry" name="industry" className="select" defaultValue="">
            <option value="">Select…</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Employees" htmlFor="sizeBand" error={state.fieldErrors?.sizeBand}>
          <select id="sizeBand" name="sizeBand" className="select" defaultValue="">
            <option value="">Select…</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Country or region" htmlFor="country" error={state.fieldErrors?.country}>
        <input id="country" name="country" type="text" className="input" placeholder="United States" />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Setting things up…">
        Create organization
      </SubmitButton>
    </form>
  );
}
