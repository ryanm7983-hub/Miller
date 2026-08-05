'use client';

import { useRef } from 'react';
import { Plus, X } from 'lucide-react';

import { addDepartmentAction, removeDepartmentAction } from './actions';
import { SubmitButton } from '@/components/ui/form';

export function DepartmentManager({
  departments,
  canManage,
}: {
  departments: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {departments.length === 0 ? (
        <p className="text-[13px] text-ink-500">No departments yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {departments.map((department) => (
            <li
              key={department.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white py-1 pl-3 pr-1.5 text-[13px] text-ink-800"
            >
              {department.name}
              {canManage && (
                <form action={removeDepartmentAction}>
                  <input type="hidden" name="departmentId" value={department.id} />
                  <button
                    type="submit"
                    className="rounded-full p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-risk-600"
                    aria-label={`Remove ${department.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form
          ref={formRef}
          action={async (formData) => {
            await addDepartmentAction(formData);
            formRef.current?.reset();
          }}
          className="flex gap-2"
        >
          <label htmlFor="new-department" className="sr-only">
            New department
          </label>
          <input
            id="new-department"
            name="name"
            className="input max-w-xs"
            placeholder="e.g. Calibration lab"
            required
            maxLength={60}
          />
          <SubmitButton variant="secondary" pendingLabel="Adding…">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
