'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';

import { Badge, StatusDot } from '@/components/ui/badge';
import { LinkReviewRow } from '../evidence/[id]/link-review-row';
import { REQUIREMENT_STATUS_META, type RequirementStatus, type Tone } from '@/lib/enums';
import { cn, truncate } from '@/lib/utils';

export interface MatrixLink {
  id: string;
  evidenceId: string;
  evidenceLabel: string;
  evidenceExpired: boolean;
  source: string;
  strength: string;
  strengthLabel: string;
  relevance: number;
  confidence: number;
  rationale: string | null;
  concerns: string[];
  reviewState: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface MatrixRow {
  id: string;
  identifier: string;
  title: string;
  text: string;
  status: string;
  statusSource: string;
  ownerName: string | null;
  links: MatrixLink[];
}

const STRENGTH_TONES: Record<string, Tone> = {
  STRONG: 'strong',
  PARTIAL: 'caution',
  WEAK: 'risk',
};

const REVIEW_TONES: Record<string, Tone> = {
  APPROVED: 'strong',
  PENDING: 'caution',
  REJECTED: 'risk',
};

/**
 * The matrix. Clicking any row opens a detail panel with the full AI reasoning
 * and the approve/reject controls, so review happens without losing the list.
 */
export function MatrixTable({
  rows,
  canReview,
  initialRowId,
}: {
  rows: MatrixRow[];
  canReview: boolean;
  initialRowId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialRowId ?? null);
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
              <th className="px-5 py-2.5 font-medium">Requirement</th>
              <th className="px-3 py-2.5 font-medium">Evidence</th>
              <th className="px-3 py-2.5 font-medium">AI assessment</th>
              <th className="px-3 py-2.5 font-medium">Human review</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => {
              const best = row.links[0];
              const approved = row.links.filter((l) => l.reviewState === 'APPROVED').length;
              const pending = row.links.filter((l) => l.reviewState === 'PENDING').length;
              const meta = REQUIREMENT_STATUS_META[row.status as RequirementStatus];

              return (
                <tr
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className={cn('table-row-link', openId === row.id && 'bg-kelp-50/50')}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${row.identifier}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setOpenId(row.id);
                    }
                  }}
                >
                  <td className="px-5 py-3">
                    <span className="block font-mono text-[12px] font-medium text-ink-600">{row.identifier}</span>
                    <span className="mt-0.5 block text-[13px] font-medium text-ink-900">{row.title}</span>
                  </td>
                  <td className="px-3 py-3">
                    {row.links.length === 0 ? (
                      <span className="text-[12.5px] text-ink-400">— no evidence linked</span>
                    ) : (
                      <>
                        <span className="block truncate text-[13px] text-ink-700">
                          {truncate(best.evidenceLabel, 34)}
                        </span>
                        {row.links.length > 1 && (
                          <span className="mt-0.5 block text-[11.5px] text-ink-400">
                            +{row.links.length - 1} more
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {best ? (
                      <Badge tone={STRENGTH_TONES[best.strength] ?? 'muted'} size="sm">
                        {best.strengthLabel}
                      </Badge>
                    ) : (
                      <span className="text-[12.5px] text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.links.length === 0 ? (
                      <span className="text-[12.5px] text-ink-400">—</span>
                    ) : pending > 0 ? (
                      <Badge tone={REVIEW_TONES.PENDING} size="sm">
                        {pending} pending
                      </Badge>
                    ) : approved > 0 ? (
                      <Badge tone={REVIEW_TONES.APPROVED} size="sm">
                        Approved
                      </Badge>
                    ) : (
                      <Badge tone={REVIEW_TONES.REJECTED} size="sm">
                        Rejected
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <StatusDot tone={meta.tone} />
                      <span className="whitespace-nowrap text-[12.5px] font-medium text-ink-700">{meta.short}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${open.identifier} details`}>
          <div className="absolute inset-0 bg-ink-950/25" onClick={() => setOpenId(null)} role="presentation" />
          <aside className="relative h-full w-full max-w-[520px] animate-slide-in-right overflow-y-auto border-l border-ink-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-medium text-ink-500">{open.identifier}</p>
                <h2 className="mt-0.5 text-[16px] font-semibold text-ink-900">{open.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="btn-ghost btn-sm shrink-0"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={REQUIREMENT_STATUS_META[open.status as RequirementStatus].tone} dot>
                  {REQUIREMENT_STATUS_META[open.status as RequirementStatus].label}
                </Badge>
                <Badge tone={open.statusSource === 'HUMAN' ? 'strong' : open.statusSource === 'AI' ? 'info' : 'muted'} size="sm">
                  {open.statusSource === 'HUMAN'
                    ? 'Human verified'
                    : open.statusSource === 'AI'
                      ? 'AI assessment'
                      : 'System derived'}
                </Badge>
                {open.ownerName && (
                  <span className="text-[12.5px] text-ink-500">Owner: {open.ownerName}</span>
                )}
              </div>

              <p className="text-[13.5px] leading-relaxed text-ink-700">{open.text}</p>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                    Evidence ({open.links.length})
                  </p>
                  <Link
                    href={`/app/requirements/${open.id}`}
                    className="flex items-center gap-1 text-[12.5px] font-medium text-kelp-700 hover:underline"
                  >
                    Full requirement
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </div>

                {open.links.length === 0 ? (
                  <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-5 text-center text-[13px] text-ink-500">
                    Nothing is linked to this requirement yet.
                  </p>
                ) : (
                  <ul className="-mx-5 divide-y divide-ink-100 border-y border-ink-100">
                    {open.links.map((link) => (
                      <LinkReviewRow
                        key={link.id}
                        link={{
                          id: link.id,
                          source: link.source,
                          relevance: link.relevance,
                          confidence: link.confidence,
                          strength: link.strength,
                          rationale: link.rationale,
                          concerns: link.concerns,
                          reviewState: link.reviewState,
                          decidedByName: link.decidedByName,
                          decidedAt: link.decidedAt,
                        }}
                        requirement={{ id: open.id, identifier: open.identifier, title: open.title }}
                        canReview={canReview}
                        evidenceHref={`/app/evidence/${link.evidenceId}`}
                        evidenceLabel={`${link.evidenceLabel}${link.evidenceExpired ? ' (expired)' : ''}`}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
