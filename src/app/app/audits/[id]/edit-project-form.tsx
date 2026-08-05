'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { deleteProjectAction, updateProjectAction, type ProjectFormState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import {
  AUDIT_TYPES,
  AUDIT_TYPE_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
} from '@/lib/enums';
import { toDateInput } from '@/lib/utils';

const initialState: ProjectFormState = {};

interface Props {
  project: {
    id: string;
    name: string;
    auditType: string;
    status: string;
    scope: string | null;
    auditDate: string | null;
    leadUserId: string | null;
  };
  members: Array<{ id: string; name: string }>;
  canEdit: boolean;
  canDelete: boolean;
}

export function EditProjectForm({ project, members, canEdit, canDelete }: Props) {
  const [state, formAction] = useActionState(updateProjectAction, initialState);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5" noValidate>
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <input type="hidden" name="projectId" value={project.id} />

        <Field label="Project name" htmlFor="name" error={state.fieldErrors?.name} required>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={project.name}
            className="input"
            disabled={!canEdit}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Audit type" htmlFor="auditType">
            <select id="auditType" name="auditType" className="select" defaultValue={project.auditType} disabled={!canEdit}>
              {AUDIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {AUDIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" htmlFor="status">
            <select id="status" name="status" className="select" defaultValue={project.status} disabled={!canEdit}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_META[status].label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Audit date"
            htmlFor="auditDate"
            hint="Drives the countdown and the prioritised preparation plan."
          >
            <input
              id="auditDate"
              name="auditDate"
              type="date"
              className="input"
              defaultValue={toDateInput(project.auditDate)}
              disabled={!canEdit}
            />
          </Field>

          <Field label="Project lead" htmlFor="leadUserId">
            <select
              id="leadUserId"
              name="leadUserId"
              className="select"
              defaultValue={project.leadUserId ?? ''}
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
        </div>

        <Field label="Scope" htmlFor="scope" hint="Appears on generated reports.">
          <textarea
            id="scope"
            name="scope"
            rows={3}
            className="textarea"
            defaultValue={project.scope ?? ''}
            disabled={!canEdit}
          />
        </Field>

        {canEdit && <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>}
      </form>

      {canDelete && (
        <div className="border-t border-ink-200 pt-5">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-ghost btn-sm text-risk-600 hover:bg-risk-50 hover:text-risk-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete this project
            </button>
          ) : (
            <form action={deleteProjectAction} className="rounded-lg border border-risk-500/25 bg-risk-50 p-4">
              <input type="hidden" name="projectId" value={project.id} />
              <p className="text-[13px] font-semibold text-risk-700">Delete “{project.name}”?</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-risk-700/85">
                This permanently removes the project&rsquo;s requirements, evidence links, gaps, actions and reports.
                Evidence files stay in your library. This cannot be undone.
              </p>
              <label className="mt-3 block">
                <span className="text-[12.5px] font-medium text-risk-700">Type the project name to confirm</span>
                <input name="confirmName" className="input mt-1" placeholder={project.name} autoComplete="off" />
              </label>
              <div className="mt-3 flex gap-2">
                <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                  Delete permanently
                </SubmitButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
