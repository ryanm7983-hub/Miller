'use client';

import { useRouter } from 'next/navigation';
import { Gauge } from 'lucide-react';

import type { ProjectSummary } from '@/lib/projects';

/**
 * Project selector shown in the header of every project-scoped page.
 * Navigation is a plain URL change so the page stays fully server-rendered.
 */
export function ProjectPicker({
  projects,
  activeId,
  basePath,
  extraParams,
}: {
  projects: Array<Pick<ProjectSummary, 'id' | 'name' | 'readinessScore'>>;
  activeId: string;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  if (projects.length <= 1) return null;

  return (
    <label className="relative inline-flex items-center">
      <Gauge className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400" aria-hidden />
      <span className="sr-only">Audit project</span>
      <select
        className="select h-10 min-w-[180px] max-w-[260px] pl-8 text-[13.5px]"
        value={activeId}
        onChange={(event) => {
          const params = new URLSearchParams();
          params.set('project', event.target.value);
          for (const [key, value] of Object.entries(extraParams ?? {})) {
            if (value) params.set(key, value);
          }
          router.push(`${basePath}?${params.toString()}`);
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} — {project.readinessScore}%
          </option>
        ))}
      </select>
    </label>
  );
}
