'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { deleteEvidenceAction, updateEvidenceAction, type EvidenceFormState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { DOCUMENT_TYPES, EVIDENCE_STATUSES, EVIDENCE_STATUS_META, documentTypeLabel } from '@/lib/enums';
import { toDateInput } from '@/lib/utils';

const initialState: EvidenceFormState = {};

interface Props {
  evidence: {
    id: string;
    title: string;
    documentType: string;
    status: string;
    ownerUserId: string | null;
    department: string | null;
    revision: string | null;
    effectiveDate: string | null;
    expiresAt: string | null;
    tags: string[];
    notes: string | null;
    projectId: string | null;
  };
  members: Array<{ id: string; name: string }>;
  departments: string[];
  projects: Array<{ id: string; name: string }>;
  canEdit: boolean;
  canDelete: boolean;
}

export function EvidenceDetailForm({ evidence, members, departments, projects, canEdit, canDelete }: Props) {
  const [state, formAction] = useActionState(updateEvidenceAction, initialState);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <input type="hidden" name="evidenceId" value={evidence.id} />

        <Field label="Title" htmlFor="title" required>
          <input id="title" name="title" className="input" defaultValue={evidence.title} disabled={!canEdit} required />
        </Field>

        <Field label="Audit project" htmlFor="projectId">
          <select id="projectId" name="projectId" className="select" defaultValue={evidence.projectId ?? ''} disabled={!canEdit}>
            <option value="">Library only</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Document type" htmlFor="documentType">
          <select id="documentType" name="documentType" className="select" defaultValue={evidence.documentType} disabled={!canEdit}>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor="status">
          <select id="status" name="status" className="select" defaultValue={evidence.status} disabled={!canEdit}>
            {EVIDENCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {EVIDENCE_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Owner" htmlFor="ownerUserId" hint="Who keeps this document current.">
          <select id="ownerUserId" name="ownerUserId" className="select" defaultValue={evidence.ownerUserId ?? ''} disabled={!canEdit}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department" htmlFor="department">
          <select id="department" name="department" className="select" defaultValue={evidence.department ?? ''} disabled={!canEdit}>
            <option value="">Not specified</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Revision" htmlFor="revision" hint="As printed on the document.">
          <input id="revision" name="revision" className="input" defaultValue={evidence.revision ?? ''} disabled={!canEdit} placeholder="Rev C" />
        </Field>

        <Field label="Effective date" htmlFor="effectiveDate">
          <input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            className="input"
            defaultValue={toDateInput(evidence.effectiveDate)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Expiry date" htmlFor="expiresAt" hint="Drives expiry warnings and gaps.">
          <input
            id="expiresAt"
            name="expiresAt"
            type="date"
            className="input"
            defaultValue={toDateInput(evidence.expiresAt)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Tags" htmlFor="tags" hint="Comma separated.">
          <input id="tags" name="tags" className="input" defaultValue={evidence.tags.join(', ')} disabled={!canEdit} />
        </Field>

        <Field label="Notes" htmlFor="notes" hint="Context for reviewers and auditors.">
          <textarea id="notes" name="notes" rows={3} className="textarea" defaultValue={evidence.notes ?? ''} disabled={!canEdit} />
        </Field>

        {canEdit && (
          <SubmitButton className="w-full" pendingLabel="Saving…">
            Save details
          </SubmitButton>
        )}
      </form>

      {canDelete && (
        <div className="border-t border-ink-200 pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-ghost btn-sm text-risk-600 hover:bg-risk-50 hover:text-risk-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete document
            </button>
          ) : (
            <form action={deleteEvidenceAction} className="rounded-lg border border-risk-500/25 bg-risk-50 p-3.5">
              <input type="hidden" name="evidenceId" value={evidence.id} />
              <p className="text-[12.5px] leading-relaxed text-risk-700">
                Permanently delete this document, its stored file and all its requirement links?
              </p>
              <div className="mt-3 flex gap-2">
                <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                  Delete
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
