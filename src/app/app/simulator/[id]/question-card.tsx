'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, RotateCcw, TriangleAlert } from 'lucide-react';

import { answerQuestionAction, type SimulatorState } from '../actions';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { FormError, SubmitButton } from '@/components/ui/form';
import type { AnswerEvaluation } from '@/lib/ai/types';
import { relativeTime } from '@/lib/utils';

const initialState: SimulatorState = {};

interface Props {
  index: number;
  question: {
    id: string;
    question: string;
    focus: string | null;
    requirementHref: string | null;
    requirementLabel: string | null;
  };
  latestAnswer: {
    answer: string;
    score: number;
    userName: string;
    createdAt: string;
    evaluation: AnswerEvaluation | null;
  } | null;
  attempts: number;
  canAnswer: boolean;
}

export function QuestionCard({ index, question, latestAnswer, attempts, canAnswer }: Props) {
  const [state, formAction] = useActionState(answerQuestionAction, initialState);
  const [retrying, setRetrying] = useState(false);

  const showForm = canAnswer && (!latestAnswer || retrying);
  const score = latestAnswer?.score ?? 0;
  const scoreTone = score >= 80 ? 'text-strong-600' : score >= 55 ? 'text-caution-600' : 'text-risk-600';
  const barTone = score >= 80 ? 'bg-strong-500' : score >= 55 ? 'bg-caution-500' : 'bg-risk-500';

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-start gap-2.5">
            <span className="tnum mt-0.5 shrink-0 text-[13px] font-bold text-ink-300">{index}</span>
            <span className="text-[15px] font-semibold leading-snug text-ink-900">
              &ldquo;{question.question}&rdquo;
            </span>
          </span>
        }
        description={
          question.requirementHref && question.requirementLabel ? (
            <Link href={question.requirementHref} className="text-kelp-700 hover:underline">
              {question.requirementLabel}
            </Link>
          ) : (
            (question.focus ?? undefined)
          )
        }
        action={
          latestAnswer ? (
            <span className={`tnum text-[22px] font-bold ${scoreTone}`}>{score}%</span>
          ) : (
            <Badge tone="muted" size="sm">
              Not answered
            </Badge>
          )
        }
      />

      <div className="space-y-4 p-5">
        {latestAnswer && !retrying && (
          <>
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                Your answer — {latestAnswer.userName}, {relativeTime(latestAnswer.createdAt)}
                {attempts > 1 && ` · attempt ${attempts}`}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-ink-50 p-3.5 text-[13.5px] leading-relaxed text-ink-700">
                {latestAnswer.answer}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                  Response readiness
                </span>
                <span className={`tnum text-[13px] font-semibold ${scoreTone}`}>{score}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className={`h-full rounded-full ${barTone}`} style={{ width: `${score}%` }} />
              </div>
            </div>

            {latestAnswer.evaluation && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Clarity', latestAnswer.evaluation.clarity],
                    ['Evidence referenced', latestAnswer.evaluation.evidenceReferenced],
                    ['Consistency', latestAnswer.evaluation.consistency],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-ink-200 px-3 py-2">
                      <div className="text-[10.5px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
                      <div className="tnum mt-0.5 text-[16px] font-bold text-ink-900">
                        {Math.round(Number(value) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>

                {latestAnswer.evaluation.strengths.length > 0 && (
                  <div className="rounded-lg border border-strong-500/25 bg-strong-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-strong-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      What worked
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {latestAnswer.evaluation.strengths.map((item, i) => (
                        <li key={i} className="text-[12.5px] leading-relaxed text-strong-700/90">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {latestAnswer.evaluation.gaps.length > 0 && (
                  <div className="rounded-lg border border-caution-500/25 bg-caution-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-caution-700">
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                      What an auditor would push back on
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {latestAnswer.evaluation.gaps.map((item, i) => (
                        <li key={i} className="text-[12.5px] leading-relaxed text-caution-700/90">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {latestAnswer.evaluation.suggestedEvidence.length > 0 && (
                  <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                      Evidence you could have named
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {latestAnswer.evaluation.suggestedEvidence.map((item) => (
                        <Badge key={item} tone="neutral" size="sm">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <p className="rounded-lg bg-info-50 p-3.5 text-[13px] leading-relaxed text-info-700">
                  {latestAnswer.evaluation.coaching}
                </p>
              </div>
            )}

            {canAnswer && (
              <button type="button" onClick={() => setRetrying(true)} className="btn-secondary btn-sm">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            )}
          </>
        )}

        {showForm && (
          <form action={formAction} className="space-y-3" noValidate>
            <FormError message={state.error} />
            <input type="hidden" name="questionId" value={question.id} />
            <label htmlFor={`answer-${question.id}`} className="label block">
              Answer as you would on the day
            </label>
            <textarea
              id={`answer-${question.id}`}
              name="answer"
              rows={5}
              required
              className="textarea"
              defaultValue={retrying ? latestAnswer?.answer : ''}
              placeholder="Describe what you do, name the record that proves it, and say how you know it is working."
            />
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Evaluating…">Submit answer</SubmitButton>
              {retrying && (
                <button type="button" onClick={() => setRetrying(false)} className="btn-secondary btn-md">
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {!canAnswer && !latestAnswer && (
          <p className="text-[13px] text-ink-500">This session is closed and was not answered.</p>
        )}
      </div>
    </Card>
  );
}
