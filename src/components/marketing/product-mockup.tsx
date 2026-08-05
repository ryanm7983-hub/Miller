import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileText,
  LayoutDashboard,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ReadinessRing } from '@/components/ui/readiness';
import { Badge } from '@/components/ui/badge';

/**
 * The hero product shot.
 *
 * Deliberately built from the same components and design tokens as the real
 * application rather than a static image: it stays pixel-accurate as the
 * product evolves, loads instantly, scales to any screen, and never 404s.
 */

const MATRIX_ROWS = [
  {
    id: 'DEMO-4.1',
    requirement: 'Scope and context',
    evidence: 'Scope Statement 2026.pdf',
    ai: 'Strong',
    aiTone: 'strong' as const,
    review: 'Approved',
    status: 'strong' as const,
  },
  {
    id: 'DEMO-5.2',
    requirement: 'Leadership review',
    evidence: 'Management Review Q1.docx',
    ai: 'Partial',
    aiTone: 'caution' as const,
    review: 'Pending',
    status: 'caution' as const,
  },
  {
    id: 'DEMO-7.2',
    requirement: 'Competence',
    evidence: 'Training Matrix 2026.xlsx',
    ai: 'Weak',
    aiTone: 'risk' as const,
    review: 'Pending',
    status: 'risk' as const,
  },
  {
    id: 'DEMO-7.5',
    requirement: 'Documented information',
    evidence: 'Document Control SOP.pdf',
    ai: 'Strong',
    aiTone: 'strong' as const,
    review: 'Approved',
    status: 'strong' as const,
  },
  {
    id: 'DEMO-9.2',
    requirement: 'Internal audit',
    evidence: '— no evidence linked',
    ai: '—',
    aiTone: 'muted' as const,
    review: '—',
    status: 'missing' as const,
  },
];

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Requirements', icon: ListChecks },
  { label: 'Evidence', icon: FileText },
  { label: 'Gaps', icon: ShieldAlert },
  { label: 'Actions', icon: CheckCircle2 },
];

export function ProductMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-ink-200/90 bg-white shadow-xl ring-1 ring-ink-900/[0.04]',
        className
      )}
      role="img"
      aria-label="AuditReady dashboard showing a 78 percent audit readiness score, requirement status counts, and an evidence-to-requirement matrix"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50 px-3.5 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
        </div>
        <div className="mx-auto flex max-w-[300px] flex-1 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1">
          <Search className="h-3 w-3 text-ink-400" aria-hidden />
          <span className="truncate text-[11px] text-ink-400">app.auditready.com/dashboard</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-[168px] shrink-0 border-r border-ink-200 bg-ink-50/60 p-3 sm:block">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-kelp-700 text-[10px] font-bold text-white">
              N
            </span>
            <span className="truncate text-[11.5px] font-semibold text-ink-800">Northfield Mfg.</span>
          </div>
          <nav className="space-y-0.5">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium',
                  item.active ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'
                )}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </div>
            ))}
          </nav>
          <div className="mt-4 rounded-lg border border-caution-500/25 bg-caution-50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-caution-700">Audit in</div>
            <div className="tnum mt-0.5 text-[19px] font-bold leading-none text-caution-700">72 days</div>
            <div className="mt-1 text-[10px] text-caution-700/80">Oct 15, 2026</div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-bold text-ink-900">ISO 9001 Recertification</h3>
              <p className="text-[11.5px] text-ink-500">Northfield Manufacturing · 68 requirements in scope</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-kelp-700 px-2.5 py-1.5 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3" aria-hidden />
              Analyze evidence
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
            <div className="flex items-center justify-center rounded-lg border border-ink-200 bg-ink-50/50 px-5 py-4">
              <ReadinessRing score={78} size={128} strokeWidth={10} label="Audit readiness" riskLevel="MEDIUM" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: 'Strong', value: 42, tone: 'strong', Icon: CheckCircle2 },
                { label: 'Needs review', value: 11, tone: 'caution', Icon: AlertTriangle },
                { label: 'Missing', value: 7, tone: 'risk', Icon: ShieldAlert },
                { label: 'Evidence', value: 134, tone: 'neutral', Icon: FileText },
                { label: 'Open actions', value: 9, tone: 'neutral', Icon: ListChecks },
                { label: 'Not assessed', value: 8, tone: 'muted', Icon: CircleDashed },
              ].map(({ label, value, tone, Icon }) => (
                <div key={label} className="rounded-lg border border-ink-200 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={cn(
                        'h-3 w-3',
                        tone === 'strong'
                          ? 'text-strong-500'
                          : tone === 'caution'
                            ? 'text-caution-500'
                            : tone === 'risk'
                              ? 'text-risk-500'
                              : 'text-ink-400'
                      )}
                      aria-hidden
                    />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">{label}</span>
                  </div>
                  <div className="tnum mt-1 text-[19px] font-bold leading-none text-ink-900">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Matrix */}
          <div className="mt-4 overflow-hidden rounded-lg border border-ink-200">
            <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50/60 px-3 py-2">
              <span className="text-[11px] font-semibold text-ink-700">Evidence → requirement matrix</span>
              <span className="text-[10.5px] text-ink-500">Sorted by risk</span>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-ink-100">
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap py-2 pl-3 pr-2 font-mono text-[10.5px] font-medium text-ink-700">
                      {row.id}
                    </td>
                    <td className="hidden py-2 pr-2 text-[11.5px] text-ink-700 md:table-cell">{row.requirement}</td>
                    <td className="max-w-[150px] truncate py-2 pr-2 text-[11.5px] text-ink-500">{row.evidence}</td>
                    <td className="py-2 pr-2">
                      <Badge tone={row.aiTone} size="sm">
                        {row.ai}
                      </Badge>
                    </td>
                    <td className="hidden py-2 pr-2 text-[11px] text-ink-500 sm:table-cell">{row.review}</td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={cn(
                          'inline-block h-2 w-2 rounded-full',
                          row.status === 'strong'
                            ? 'bg-strong-500'
                            : row.status === 'caution'
                              ? 'bg-caution-500'
                              : row.status === 'risk'
                                ? 'bg-risk-500'
                                : 'bg-ink-300'
                        )}
                        aria-hidden
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Floating AI-assessment card used alongside the hero mockup. */
export function AiAssessmentCard({ className }: { className?: string }) {
  return (
    <div className={cn('w-[280px] rounded-xl border border-ink-200 bg-white p-4 shadow-lg', className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-info-50 text-info-600">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="text-[12px] font-semibold text-ink-900">AI assessment</span>
        <Badge tone="info" size="sm" className="ml-auto">
          87% confidence
        </Badge>
      </div>

      <p className="mt-3 text-[12.5px] font-semibold text-caution-700">Potentially satisfied</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">
        <span className="font-medium text-ink-800">Training Matrix 2026.xlsx</span> appears to identify employee roles
        and their corresponding competency requirements.
      </p>
      <div className="mt-3 rounded-lg bg-caution-50 px-2.5 py-2">
        <p className="text-[11px] font-semibold text-caution-700">Potential concern</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-caution-700/90">
          Several employees have no documented completion date.
        </p>
      </div>
      <p className="mt-3 border-t border-ink-100 pt-2.5 text-[11px] text-ink-500">
        Human verification recommended.
      </p>
    </div>
  );
}
