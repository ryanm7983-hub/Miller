'use client';

import { useActionState } from 'react';

import { updateOrganizationAction, type SettingsState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { ORG_KINDS } from '@/lib/enums';

const initialState: SettingsState = {};

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

export function OrganizationForm({
  org,
  canManage,
}: {
  org: { name: string; industry: string | null; sizeBand: string | null; country: string | null; kind: string };
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <Field label="Organization name" htmlFor="name" required>
        <input id="name" name="name" className="input" defaultValue={org.name} disabled={!canManage} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry" htmlFor="industry">
          <select id="industry" name="industry" className="select" defaultValue={org.industry ?? ''} disabled={!canManage}>
            <option value="">Not specified</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Employees" htmlFor="sizeBand">
          <select id="sizeBand" name="sizeBand" className="select" defaultValue={org.sizeBand ?? ''} disabled={!canManage}>
            <option value="">Not specified</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Country or region" htmlFor="country">
          <input id="country" name="country" className="input" defaultValue={org.country ?? ''} disabled={!canManage} />
        </Field>

        <Field
          label="Organization type"
          htmlFor="kind"
          hint="Consultancies get the client portfolio view and can hold engagements with client organizations."
        >
          <select id="kind" name="kind" className="select" defaultValue={org.kind} disabled={!canManage}>
            {ORG_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'STANDARD' ? 'Single organization' : 'Consultancy'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {canManage && <SubmitButton pendingLabel="Saving…">Save organization</SubmitButton>}
    </form>
  );
}
