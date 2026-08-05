'use client';

import { updateGapStatusAction } from '../../actions/actions';
import { Field, SubmitButton } from '@/components/ui/form';
import { GAP_STATUSES, GAP_STATUS_META } from '@/lib/enums';
import { toDateInput } from '@/lib/utils';

export function GapStatusForm({
  gap,
  members,
  canManage,
}: {
  gap: { id: string; status: string; ownerUserId: string | null; dueDate: string | null };
  members: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  return (
    <form action={updateGapStatusAction} className="space-y-4">
      <input type="hidden" name="gapId" value={gap.id} />

      <Field
        label="Status"
        htmlFor="gap-status"
        hint="Accepting the risk or dismissing keeps the decision even when detection re-runs."
      >
        <select id="gap-status" name="status" className="select" defaultValue={gap.status} disabled={!canManage}>
          {GAP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {GAP_STATUS_META[status].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Owner" htmlFor="gap-owner">
        <select
          id="gap-owner"
          name="ownerUserId"
          className="select"
          defaultValue={gap.ownerUserId ?? ''}
          disabled={!canManage}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Target date" htmlFor="gap-due">
        <input
          id="gap-due"
          name="dueDate"
          type="date"
          className="input"
          defaultValue={toDateInput(gap.dueDate)}
          disabled={!canManage}
        />
      </Field>

      {canManage && (
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Update gap
        </SubmitButton>
      )}
    </form>
  );
}
