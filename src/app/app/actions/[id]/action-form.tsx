'use client';

import { useActionState } from 'react';

import { updateActionAction, type ActionFormState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { ACTION_STATUSES, ACTION_STATUS_META, SEVERITIES, SEVERITY_META } from '@/lib/enums';
import { toDateInput } from '@/lib/utils';

const initialState: ActionFormState = {};

export function ActionForm({
  action,
  members,
  departments,
  canEdit,
  canProgress,
  canVerify,
}: {
  action: {
    id: string;
    title: string;
    description: string | null;
    ownerUserId: string | null;
    department: string | null;
    dueDate: string | null;
    priority: string;
    status: string;
  };
  members: Array<{ id: string; name: string }>;
  departments: string[];
  canEdit: boolean;
  canProgress: boolean;
  canVerify: boolean;
}) {
  const [state, formAction] = useActionState(updateActionAction, initialState);

  const availableStatuses = ACTION_STATUSES.filter((status) => status !== 'VERIFIED' || canVerify);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <input type="hidden" name="actionId" value={action.id} />

      {/* Fields a contributor cannot change are submitted unchanged so the
          server receives a complete, valid payload. */}
      {!canEdit && (
        <>
          <input type="hidden" name="title" value={action.title} />
          <input type="hidden" name="description" value={action.description ?? ''} />
          <input type="hidden" name="ownerUserId" value={action.ownerUserId ?? ''} />
          <input type="hidden" name="department" value={action.department ?? ''} />
          <input type="hidden" name="dueDate" value={toDateInput(action.dueDate)} />
          <input type="hidden" name="priority" value={action.priority} />
        </>
      )}

      <Field label="Status" htmlFor="status">
        <select id="status" name="status" className="select" defaultValue={action.status} disabled={!canProgress}>
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {ACTION_STATUS_META[status].label}
            </option>
          ))}
        </select>
        {!canVerify && (
          <p className="hint mt-1">Verification is done by a manager or admin after the work is complete.</p>
        )}
      </Field>

      {canEdit && (
        <>
          <Field label="Title" htmlFor="title" required>
            <input id="title" name="title" className="input" defaultValue={action.title} required />
          </Field>

          <Field label="Description" htmlFor="description">
            <textarea id="description" name="description" rows={6} className="textarea" defaultValue={action.description ?? ''} />
          </Field>

          <Field label="Owner" htmlFor="ownerUserId">
            <select id="ownerUserId" name="ownerUserId" className="select" defaultValue={action.ownerUserId ?? ''}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department" htmlFor="department">
            <select id="department" name="department" className="select" defaultValue={action.department ?? ''}>
              <option value="">Not specified</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="priority">
            <select id="priority" name="priority" className="select" defaultValue={action.priority}>
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {SEVERITY_META[value].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="dueDate">
            <input id="dueDate" name="dueDate" type="date" className="input" defaultValue={toDateInput(action.dueDate)} />
          </Field>
        </>
      )}

      {canProgress && (
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Save
        </SubmitButton>
      )}
    </form>
  );
}
