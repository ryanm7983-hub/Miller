'use client';

import Link from 'next/link';
import { Check, Sparkles, Trash2, User, X } from 'lucide-react';

import { reviewEvidenceLinkAction, unlinkEvidenceAction } from '../actions';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { AI_STRENGTH_META, type AiStrength } from '@/lib/enums';
import { formatDate } from '@/lib/utils';

interface Props {
  link: {
    id: string;
    source: string;
    relevance: number;
    confidence: number;
    strength: string;
    rationale: string | null;
    concerns: string[];
    reviewState: string;
    decidedByName: string | null;
    decidedAt: string | null;
  };
  requirement: { id: string; identifier: string; title: string };
  canReview: boolean;
  /** When set, links back to the evidence instead of the requirement. */
  evidenceHref?: string;
  evidenceLabel?: string;
}

/**
 * One evidence↔requirement association with its AI reasoning and the human
 * approve/reject controls. Provenance is always visible: who or what created
 * the link, and who decided on it.
 */
export function LinkReviewRow({ link, requirement, canReview, evidenceHref, evidenceLabel }: Props) {
  const strength = AI_STRENGTH_META[link.strength as AiStrength] ?? AI_STRENGTH_META.PARTIAL;
  const isAi = link.source === 'AI';

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {evidenceHref ? (
              <Link href={evidenceHref} className="text-[13.5px] font-semibold text-ink-900 hover:underline">
                {evidenceLabel}
              </Link>
            ) : (
              <Link
                href={`/app/requirements/${requirement.id}`}
                className="text-[13.5px] font-semibold text-ink-900 hover:underline"
              >
                <span className="font-mono text-[12.5px] text-ink-600">{requirement.identifier}</span>{' '}
                {requirement.title}
              </Link>
            )}
            <Badge tone={strength.tone} size="sm">
              {strength.label}
            </Badge>
            <Badge tone={isAi ? 'info' : 'neutral'} size="sm">
              {isAi ? (
                <>
                  <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI match
                </>
              ) : (
                <>
                  <User className="h-2.5 w-2.5" aria-hidden /> Linked by a person
                </>
              )}
            </Badge>
            {link.reviewState === 'APPROVED' && (
              <Badge tone="strong" size="sm">
                Human verified
              </Badge>
            )}
            {link.reviewState === 'REJECTED' && (
              <Badge tone="risk" size="sm">
                Rejected
              </Badge>
            )}
            {link.reviewState === 'PENDING' && (
              <Badge tone="caution" size="sm">
                Awaiting review
              </Badge>
            )}
          </div>

          {link.rationale && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{link.rationale}</p>
          )}

          {link.concerns.length > 0 && (
            <ul className="mt-2 space-y-1">
              {link.concerns.map((concern, index) => (
                <li key={index} className="flex gap-2 text-[12.5px] leading-relaxed text-caution-700">
                  <span aria-hidden>⚠</span>
                  {concern}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-[11.5px] text-ink-400">
            {isAi && `Relevance ${Math.round(link.relevance * 100)}% · confidence ${Math.round(link.confidence * 100)}%`}
            {link.decidedByName && ` · reviewed by ${link.decidedByName}`}
            {link.decidedAt && ` on ${formatDate(link.decidedAt)}`}
          </p>
        </div>

        {canReview && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {link.reviewState !== 'APPROVED' && (
              <form action={reviewEvidenceLinkAction}>
                <input type="hidden" name="linkId" value={link.id} />
                <input type="hidden" name="decision" value="APPROVED" />
                <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                  <Check className="h-3.5 w-3.5 text-strong-600" aria-hidden />
                  Approve
                </SubmitButton>
              </form>
            )}
            {link.reviewState !== 'REJECTED' && (
              <form action={reviewEvidenceLinkAction}>
                <input type="hidden" name="linkId" value={link.id} />
                <input type="hidden" name="decision" value="REJECTED" />
                <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                  <X className="h-3.5 w-3.5 text-risk-600" aria-hidden />
                  Reject
                </SubmitButton>
              </form>
            )}
            <form action={unlinkEvidenceAction}>
              <input type="hidden" name="linkId" value={link.id} />
              <SubmitButton variant="ghost" size="sm" pendingLabel="Removing…" aria-label="Remove link">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}
