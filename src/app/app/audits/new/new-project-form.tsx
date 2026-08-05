'use client';

import { useActionState, useState } from 'react';
import { BookMarked, CalendarDays } from 'lucide-react';

import { createProjectAction, type ProjectFormState } from '../actions';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { AUDIT_TYPES, AUDIT_TYPE_LABELS } from '@/lib/enums';
import { cn, pluralize } from '@/lib/utils';

interface FrameworkOption {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string | null;
  publisher: string | null;
  isSystem: boolean;
  versions: Array<{ id: string; version: string; notes: string | null; isDefault: boolean; requirementCount: number }>;
}

const initialState: ProjectFormState = {};

export function NewProjectForm({
  frameworks,
  disabled,
}: {
  frameworks: FrameworkOption[];
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(createProjectAction, initialState);
  const [selected, setSelected] = useState<string>(frameworks[0]?.versions[0]?.id ?? '');

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormError message={state.error} />

      <Field
        label="Project name"
        htmlFor="name"
        error={state.fieldErrors?.name}
        hint="Something your team will recognise, e.g. “ISO 9001 Recertification 2026” or “Ford supplier audit”."
        required
      >
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          className="input"
          placeholder="Recertification audit 2026"
          disabled={disabled}
        />
      </Field>

      <fieldset>
        <legend className="label mb-2">
          Framework <span className="text-risk-500">*</span>
        </legend>
        {state.fieldErrors?.frameworkVersionId && (
          <p className="mb-2 text-[12.5px] text-risk-600" role="alert">
            {state.fieldErrors.frameworkVersionId}
          </p>
        )}
        <input type="hidden" name="frameworkVersionId" value={selected} />

        {frameworks.length === 0 ? (
          <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
            No frameworks are available yet. Create one in Settings → Frameworks.
          </p>
        ) : (
          <div className="space-y-2.5">
            {frameworks.map((framework) =>
              framework.versions.map((version) => {
                const active = selected === version.id;
                return (
                  <button
                    key={version.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelected(version.id)}
                    aria-pressed={active}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-all disabled:opacity-50',
                      active
                        ? 'border-kelp-500 bg-kelp-50/50 ring-1 ring-kelp-500/20'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <BookMarked
                        className={cn('h-4 w-4 shrink-0', active ? 'text-kelp-700' : 'text-ink-400')}
                        aria-hidden
                      />
                      <span className="text-[14px] font-semibold text-ink-900">{framework.name}</span>
                      <Badge tone="muted" size="sm">
                        v{version.version}
                      </Badge>
                      {framework.category && (
                        <Badge tone="info" size="sm">
                          {framework.category}
                        </Badge>
                      )}
                      {!framework.isSystem && (
                        <Badge tone="strong" size="sm">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{framework.description}</p>
                    <p className="mt-2 text-[12px] font-medium text-ink-500">
                      {pluralize(version.requirementCount, 'requirement')} will be imported into this project
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Audit type" htmlFor="auditType" error={state.fieldErrors?.auditType}>
          <select id="auditType" name="auditType" className="select" defaultValue="CERTIFICATION" disabled={disabled}>
            {AUDIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {AUDIT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Audit date"
          htmlFor="auditDate"
          hint="Optional — unlocks the countdown and prioritised prep plan."
          error={state.fieldErrors?.auditDate}
        >
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
            <input id="auditDate" name="auditDate" type="date" className="input pl-9" disabled={disabled} />
          </div>
        </Field>
      </div>

      <Field
        label="Scope"
        htmlFor="scope"
        hint="Optional. Which sites, products or processes this audit covers."
        error={state.fieldErrors?.scope}
      >
        <textarea
          id="scope"
          name="scope"
          className="textarea"
          rows={3}
          placeholder="Design, manufacture and distribution of precision machined components at the Northfield site."
          disabled={disabled}
        />
      </Field>

      <SubmitButton className="w-full" size="lg" disabled={disabled || !selected} pendingLabel="Creating project…">
        Create audit project
      </SubmitButton>
    </form>
  );
}
