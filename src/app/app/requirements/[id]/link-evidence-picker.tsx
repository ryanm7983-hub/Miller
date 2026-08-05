'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';

import { linkEvidenceAction } from '../../evidence/actions';
import { SubmitButton } from '@/components/ui/form';

/** Manually attach an existing document to this requirement. */
export function LinkEvidencePicker({
  projectRequirementId,
  evidence,
}: {
  projectRequirementId: string;
  evidence: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        Link evidence
      </button>
    );
  }

  return (
    <form action={linkEvidenceAction} className="flex items-center gap-2">
      <input type="hidden" name="projectRequirementId" value={projectRequirementId} />
      <label className="sr-only" htmlFor="evidenceId">
        Document to link
      </label>
      <select id="evidenceId" name="evidenceId" className="select h-8 max-w-[200px] text-[13px]" required defaultValue="">
        <option value="" disabled>
          Choose a document…
        </option>
        {evidence.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" pendingLabel="Linking…">
        Link
      </SubmitButton>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
        Cancel
      </button>
    </form>
  );
}
