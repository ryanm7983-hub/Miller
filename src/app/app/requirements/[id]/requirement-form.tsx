'use client';

import { useActionState, useState } from 'react';

import { updateRequirementAction, type RequirementFormState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { IMPORTANCE_LABELS, REQUIREMENT_STATUSES, REQUIREMENT_STATUS_META } from '@/lib/enums';

const initialState: RequirementFormState = {};

interface Props {
  requirement: {
    id: string;
    status: string;
    ownerUserId: string | null;
    department: string | null;
    notes: string | null;
    naJustification: string | null;
    importanceOverride: number | null;
    baseImportance: number;
  };
  members: Array<{ id: string; name: string }>;
  departments: string[];
  canEdit: boolean;
}

export function RequirementForm({ requirement, members, departments, canEdit }: Props) {
  const [state, formAction] = useActionState(updateRequirementAction, initialState);
  const [status, setStatus] = useState(requirement.status);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <input type="hidden" name="projectRequirementId" value={requirement.id} />

      <Field label="Status" htmlFor="status" hint="Changing this marks the status as human-verified.">
        <select
          id="status"
          name="status"
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={!canEdit}
        >
          {REQUIREMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {REQUIREMENT_STATUS_META[value].label}
            </option>
          ))}
        </select>
        <p className="hint mt-1">{REQUIREMENT_STATUS_META[status as keyof typeof REQUIREMENT_STATUS_META]?.description}</p>
      </Field>

      {status === 'NOT_APPLICABLE' && (
        <Field
          label="Justification"
          htmlFor="naJustification"
          hint="An auditor will ask why this does not apply. Write the answer here."
          required
        >
          <textarea
            id="naJustification"
            name="naJustification"
            rows={3}
            className="textarea"
            defaultValue={requirement.naJustification ?? ''}
            disabled={!canEdit}
            placeholder="We do not carry out design activities; all products are manufactured to customer-supplied drawings."
          />
        </Field>
      )}

      <Field label="Owner" htmlFor="ownerUserId" hint="Who answers questions about this requirement.">
        <select
          id="ownerUserId"
          name="ownerUserId"
          className="select"
          defaultValue={requirement.ownerUserId ?? ''}
          disabled={!canEdit}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Department" htmlFor="department">
        <select
          id="department"
          name="department"
          className="select"
          defaultValue={requirement.department ?? ''}
          disabled={!canEdit}
        >
          <option value="">Not specified</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Importance"
        htmlFor="importanceOverride"
        hint={`Framework default: ${IMPORTANCE_LABELS[requirement.baseImportance]}. Importance weights the readiness score.`}
      >
        <select
          id="importanceOverride"
          name="importanceOverride"
          className="select"
          defaultValue={requirement.importanceOverride ? String(requirement.importanceOverride) : ''}
          disabled={!canEdit}
        >
          <option value="">Use framework default</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {IMPORTANCE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Internal context. Appears on reports.">
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="textarea"
          defaultValue={requirement.notes ?? ''}
          disabled={!canEdit}
          placeholder="How we demonstrate this, who to ask, where the records live."
        />
      </Field>

      {canEdit && (
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Save assessment
        </SubmitButton>
      )}
    </form>
  );
}
