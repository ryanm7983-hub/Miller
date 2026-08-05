'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { FileUp, Sparkles, X } from 'lucide-react';

import { uploadEvidenceAction, type EvidenceFormState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton } from '@/components/ui/form';
import { ACCEPT_ATTRIBUTE } from '@/lib/storage/constants';
import { DOCUMENT_TYPES, documentTypeLabel } from '@/lib/enums';
import { cn, formatBytes } from '@/lib/utils';

const initialState: EvidenceFormState = {};

export function UploadForm({
  projects,
  departments,
  defaultProjectId,
  maxMb,
}: {
  projects: Array<{ id: string; name: string }>;
  departments: string[];
  defaultProjectId: string;
  maxMb: number;
}) {
  const [state, formAction] = useActionState(uploadEvidenceAction, initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(defaultProjectId);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((current) => {
      const merged = [...current];
      for (const file of Array.from(list)) {
        if (!merged.some((f) => f.name === file.name && f.size === file.size)) merged.push(file);
      }
      return merged.slice(0, 25);
    });
  }

  function syncInput(next: File[]) {
    // Keep the real file input in sync so the server action receives the files.
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError message={state.error} />
      {state.success && (
        <div className="space-y-3">
          <FormSuccess message={state.success} />
          {state.uploadedIds && state.uploadedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/app/evidence${projectId ? `?project=${projectId}` : ''}`} className="btn-secondary btn-sm">
                View library
              </Link>
              {state.uploadedIds.length === 1 && (
                <Link href={`/app/evidence/${state.uploadedIds[0]}`} className="btn-primary btn-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Open and analyze
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
          const merged = [...files, ...Array.from(event.dataTransfer.files)];
          syncInput(merged.slice(0, 25));
        }}
        className={cn(
          'rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-kelp-500 bg-kelp-50/60' : 'border-ink-300 bg-ink-50/40'
        )}
      >
        <FileUp className="mx-auto h-7 w-7 text-ink-400" aria-hidden />
        <p className="mt-3 text-[14.5px] font-semibold text-ink-900">Drop files here</p>
        <p className="mt-1 text-[13px] text-ink-500">
          PDF, DOCX, XLSX, CSV, TXT, JPG or PNG · up to {maxMb} MB each · 25 files at a time
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-secondary btn-md mt-4"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          name="files"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{file.name}</span>
              <span className="shrink-0 text-[12px] text-ink-500">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => {
                  const next = files.filter((f) => !(f.name === file.name && f.size === file.size));
                  setFiles(next);
                  syncInput(next);
                }}
                className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Audit project" htmlFor="projectId" hint="Required for AI analysis and gap detection.">
          <select
            id="projectId"
            name="projectId"
            className="select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Library only (no project)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Document type" htmlFor="documentType" hint="Leave blank to let the analysis suggest one.">
          <select id="documentType" name="documentType" className="select" defaultValue="">
            <option value="">Detect automatically</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department" htmlFor="department">
          <select id="department" name="department" className="select" defaultValue="">
            <option value="">Not specified</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. calibration, 2026, site-a">
          <input id="tags" name="tags" type="text" className="input" placeholder="calibration, 2026" />
        </Field>

        <Field label="Effective date" htmlFor="effectiveDate" hint="When this evidence took effect.">
          <input id="effectiveDate" name="effectiveDate" type="date" className="input" />
        </Field>

        <Field label="Expiry date" htmlFor="expiresAt" hint="Triggers expiry warnings and gap detection.">
          <input id="expiresAt" name="expiresAt" type="date" className="input" />
        </Field>
      </div>

      <SubmitButton className="w-full" size="lg" disabled={files.length === 0} pendingLabel="Uploading and extracting…">
        Upload {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'}` : 'files'}
      </SubmitButton>
    </form>
  );
}
