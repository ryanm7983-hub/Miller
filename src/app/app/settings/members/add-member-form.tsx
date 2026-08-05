'use client';

import { useActionState, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { addMemberAction, type SettingsState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/lib/enums';

const initialState: SettingsState = {};

/** Generates a readable but strong temporary password. */
function generatePassword(): string {
  const words = ['harbor', 'granite', 'lantern', 'compass', 'meadow', 'copper', 'summit', 'quarry', 'anchor', 'timber'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(Math.random() * 90) + 10);
  return `${pick()}-${pick()}-${digits}A`;
}

export function AddMemberForm({ assignableRoles }: { assignableRoles: Role[] }) {
  const [state, formAction] = useActionState(addMemberAction, initialState);
  const [password, setPassword] = useState(generatePassword);
  const [role, setRole] = useState<Role>(assignableRoles.includes('CONTRIBUTOR') ? 'CONTRIBUTOR' : assignableRoles[0]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="member-name" required>
          <input id="member-name" name="name" className="input" placeholder="Sam Okafor" required />
        </Field>

        <Field label="Work email" htmlFor="member-email" required>
          <input id="member-email" name="email" type="email" className="input" placeholder="sam@company.com" required />
        </Field>
      </div>

      <Field label="Role" htmlFor="member-role">
        <select
          id="member-role"
          name="role"
          className="select"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {assignableRoles.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="hint mt-1">{ROLE_DESCRIPTIONS[role]}</p>
      </Field>

      <Field
        label="Temporary password"
        htmlFor="member-password"
        hint="Give this to them directly. They should change it after signing in."
        required
      >
        <div className="flex gap-2">
          <input
            id="member-password"
            name="temporaryPassword"
            className="input font-mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="btn-secondary btn-md shrink-0"
            aria-label="Generate a new temporary password"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </Field>

      <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
    </form>
  );
}
