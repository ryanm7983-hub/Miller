'use client';

import { useActionState, useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';

import { createActionAction, suggestActionAction, type ActionFormState } from '../../actions/actions';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { SEVERITIES, SEVERITY_META } from '@/lib/enums';

const initialState: ActionFormState = {};

/**
 * Gap → action conversion.
 *
 * The AI draft is loaded into an editable form rather than saved directly:
 * a person always decides what the action actually says before it exists.
 */
export function CreateActionPanel({
  gap,
  members,
  departments,
  canCreate,
  canUseAi,
}: {
  gap: { id: string; projectId: string; title: string; severity: string; department: string | null };
  members: Array<{ id: string; name: string }>;
  departments: string[];
  canCreate: boolean;
  canUseAi: boolean;
}) {
  const [suggestState, suggestAction] = useActionState(suggestActionAction, initialState);
  const [createState, createAction] = useActionState(createActionAction, initialState);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(`Address: ${gap.title}`);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(gap.severity);
  const [dueDate, setDueDate] = useState('');

  // Load the AI draft into the editable fields when one arrives.
  useEffect(() => {
    const suggestion = suggestState.suggestion;
    if (!suggestion) return;
    setTitle(suggestion.title);
    setDescription(suggestion.description);
    setPriority(suggestion.priority);
    setDueDate(new Date(Date.now() + suggestion.dueInDays * 86_400_000).toISOString().slice(0, 10));
    setOpen(true);
  }, [suggestState.suggestion]);

  if (!canCreate) return null;

  return (
    <Card>
      <CardHeader
        title="Turn this gap into an action"
        description="Assign it, give it a date, and track it to verified."
        action={
          canUseAi ? (
            <form action={suggestAction}>
              <input type="hidden" name="gapId" value={gap.id} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Drafting…">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Generate recommended action
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      <div className="p-5">
        <FormError message={suggestState.error} />
        {suggestState.success && <FormSuccess message={suggestState.success} />}

        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-md w-full">
            <Plus className="h-4 w-4" aria-hidden />
            Create action
          </button>
        ) : (
          <form action={createAction} className="space-y-4" noValidate>
            <FormError message={createState.error} />
            <input type="hidden" name="gapId" value={gap.id} />
            <input type="hidden" name="projectId" value={gap.projectId} />
            <input type="hidden" name="source" value={suggestState.suggestion ? 'AI' : 'HUMAN'} />

            <Field label="Title" htmlFor="action-title" required>
              <input
                id="action-title"
                name="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>

            <Field
              label="Description"
              htmlFor="action-description"
              hint={
                suggestState.suggestion
                  ? 'AI-drafted from the gap. Edit it so it matches how your organization actually works.'
                  : 'What needs to be done, and how you will know it is done.'
              }
            >
              <textarea
                id="action-description"
                name="description"
                rows={7}
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" htmlFor="action-owner">
                <select id="action-owner" name="ownerUserId" className="select" defaultValue="">
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                {suggestState.suggestion && (
                  <p className="hint mt-1">Suggested role: {suggestState.suggestion.ownerRole}</p>
                )}
              </Field>

              <Field label="Department" htmlFor="action-department">
                <select id="action-department" name="department" className="select" defaultValue={gap.department ?? ''}>
                  <option value="">Not specified</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority" htmlFor="action-priority">
                <select
                  id="action-priority"
                  name="priority"
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {SEVERITIES.map((value) => (
                    <option key={value} value={value}>
                      {SEVERITY_META[value].label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Due date" htmlFor="action-due">
                <input
                  id="action-due"
                  name="dueDate"
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <SubmitButton pendingLabel="Creating…">Create action</SubmitButton>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-md">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
