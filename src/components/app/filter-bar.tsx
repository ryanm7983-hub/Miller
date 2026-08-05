'use client';

import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface FilterDefinition {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * URL-driven filtering.
 *
 * Filters live entirely in the query string so pages stay server-rendered,
 * filtered views are shareable and bookmarkable, and the back button works.
 */
export function FilterBar({
  basePath,
  params,
  current,
  filters,
  searchPlaceholder,
  className,
}: {
  basePath: string;
  /** Params that always survive a filter change, e.g. the project id. */
  params: Record<string, string>;
  current: Record<string, string | undefined>;
  filters: FilterDefinition[];
  searchPlaceholder?: string;
  className?: string;
}) {
  const router = useRouter();

  const activeCount = Object.entries(current).filter(([, value]) => value).length;

  function navigate(next: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    for (const [key, value] of Object.entries({ ...current, ...next })) {
      if (value) query.set(key, value);
    }
    router.push(`${basePath}?${query.toString()}`);
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {searchPlaceholder && (
        <form
          className="relative min-w-[220px] flex-1 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('q');
            navigate({ q: value ? String(value) : undefined });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={current.q ?? ''}
            placeholder={searchPlaceholder}
            className="input h-10 pl-9 text-[13.5px]"
            aria-label="Search"
          />
        </form>
      )}

      {filters.map((filter) => (
        <label key={filter.key} className="inline-flex items-center">
          <span className="sr-only">{filter.label}</span>
          <select
            className="select h-10 text-[13.5px]"
            value={current[filter.key] ?? ''}
            onChange={(event) => navigate({ [filter.key]: event.target.value || undefined })}
          >
            <option value="">All {filter.label.toLowerCase()}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
            router.push(`${basePath}?${query.toString()}`);
          }}
          className="btn-ghost btn-sm"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
