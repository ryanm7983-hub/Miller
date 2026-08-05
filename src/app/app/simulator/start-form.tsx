'use client';

import { useActionState } from 'react';
import { Play } from 'lucide-react';

import { startSimulatorAction, type SimulatorState } from './actions';
import { Field, FormError, SubmitButton } from '@/components/ui/form';

const initialState: SimulatorState = {};

export function StartSimulatorForm({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const [state, formAction] = useActionState(startSimulatorAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="projectId" value={projectId} />

      <Field
        label="How many questions?"
        htmlFor="count"
        hint="Weakest requirements are asked about first."
      >
        <select id="count" name="count" className="select" defaultValue="6" disabled={disabled}>
          {[3, 6, 8, 10, 12].map((n) => (
            <option key={n} value={n}>
              {n} questions
            </option>
          ))}
        </select>
      </Field>

      <SubmitButton className="w-full" size="lg" disabled={disabled} pendingLabel="Generating questions…">
        <Play className="h-4 w-4" aria-hidden />
        Start practice session
      </SubmitButton>
    </form>
  );
}
