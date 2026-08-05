'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { changeMemberRoleAction, removeMemberAction } from '../actions';
import { Avatar } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { ROLE_LABELS, type Role } from '@/lib/enums';
import { relativeTime } from '@/lib/utils';

export function MemberRow({
  membership,
  user,
  assignableRoles,
  canManage,
}: {
  membership: { id: string; role: string; createdAt: string; isSelf: boolean };
  user: { name: string; email: string; jobTitle: string | null; lastLoginAt: string | null };
  assignableRoles: Role[];
  canManage: boolean;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const canEditThis = canManage && assignableRoles.includes(membership.role as Role);

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={user.name} seed={user.email} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink-900">{user.name}</span>
            {membership.isSelf && (
              <Badge tone="info" size="sm">
                You
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {user.jobTitle ? `${user.jobTitle} · ` : ''}
            {user.email}
            {user.lastLoginAt ? ` · last seen ${relativeTime(user.lastLoginAt)}` : ' · never signed in'}
          </p>
        </div>

        {canEditThis ? (
          <form action={changeMemberRoleAction} className="flex items-center gap-2">
            <input type="hidden" name="membershipId" value={membership.id} />
            <label className="sr-only" htmlFor={`role-${membership.id}`}>
              Role for {user.name}
            </label>
            <select
              id={`role-${membership.id}`}
              name="role"
              className="select h-8 text-[13px]"
              defaultValue={membership.role}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </form>
        ) : (
          <Badge tone="muted" size="sm">
            {ROLE_LABELS[membership.role as Role] ?? membership.role}
          </Badge>
        )}

        {canEditThis && !membership.isSelf && !confirmRemove && (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-risk-50 hover:text-risk-600"
            aria-label={`Remove ${user.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {confirmRemove && (
        <form action={removeMemberAction} className="mt-3 rounded-lg border border-risk-500/25 bg-risk-50 p-3.5">
          <input type="hidden" name="membershipId" value={membership.id} />
          <p className="text-[12.5px] leading-relaxed text-risk-700">
            Remove {user.name} from this organization? Their account stays, but they lose access to everything here.
            Work they own — evidence, actions, requirements — stays and becomes unassigned.
          </p>
          <div className="mt-3 flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Removing…">
              Remove
            </SubmitButton>
            <button type="button" onClick={() => setConfirmRemove(false)} className="btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
