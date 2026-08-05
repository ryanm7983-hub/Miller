import crypto from 'node:crypto';

import { GAP_TYPE_LABELS, type Severity } from '@/lib/enums';
import { analyzeDocumentHeuristically } from './heuristics';
import type {
  ActionSuggestion,
  ActionSuggestionInput,
  AiProvider,
  AiResult,
  AnswerEvaluation,
  AnswerEvaluationInput,
  AuditorQuestion,
  AuditorQuestionInput,
  DocumentAnalysis,
  DocumentAnalysisInput,
} from './types';

export const PROMPT_VERSION = 'ar-2026.08-1';

export function hashInput(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
}

function wrap<T>(data: T, started: number, model: string): AiResult<T> {
  return {
    data,
    provider: 'mock',
    model,
    promptVersion: PROMPT_VERSION,
    inputHash: '',
    latencyMs: Date.now() - started,
  };
}

const DUE_DAYS: Record<Severity, number> = { CRITICAL: 7, HIGH: 14, MEDIUM: 30, LOW: 60 };

const OWNER_ROLE_HINTS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /train|competen|induction|personnel|employee/i, role: 'HR or Training Coordinator' },
  { pattern: /calibrat|gauge|measur|equipment|maintenance/i, role: 'Maintenance or Metrology Lead' },
  { pattern: /supplier|vendor|purchas|procure/i, role: 'Purchasing Manager' },
  { pattern: /audit|management review|improvement|corrective/i, role: 'Quality Manager' },
  { pattern: /safety|hazard|incident|ppe/i, role: 'Safety Manager' },
  { pattern: /environment|waste|emission|energy/i, role: 'Environmental Manager' },
  { pattern: /customer|complaint|order|delivery/i, role: 'Customer Service Lead' },
];

/**
 * Deterministic, offline AI provider.
 *
 * Every method produces genuinely useful output derived from the input rather
 * than canned text, so the product is fully demonstrable and testable without
 * an API key. Swapping `AI_PROVIDER=anthropic` changes nothing else.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly model = 'auditready-heuristic-v1';

  async analyzeDocument(input: DocumentAnalysisInput): Promise<AiResult<DocumentAnalysis>> {
    const started = Date.now();
    const data = analyzeDocumentHeuristically(input);
    const result = wrap(data, started, this.model);
    result.inputHash = hashInput({ f: input.filename, t: input.text.slice(0, 4000) });
    return result;
  }

  async suggestAction(input: ActionSuggestionInput): Promise<AiResult<ActionSuggestion>> {
    const started = Date.now();
    const subject = `${input.gapTitle} ${input.gapDescription} ${input.requirementTitle ?? ''}`;
    const role =
      OWNER_ROLE_HINTS.find((h) => h.pattern.test(subject))?.role ?? 'Process Owner';

    const focus = input.requirementTitle
      ? `${input.requirementIdentifier ?? ''} ${input.requirementTitle}`.trim()
      : 'the affected process';

    const steps = [
      `Review the current state of ${focus.toLowerCase()} and confirm the gap described above is accurate.`,
      'Identify every record, document or activity affected, not just the example that triggered this finding.',
      'Complete or correct the missing information, and capture the date and person responsible.',
      'Store the updated evidence in AuditReady and link it to the requirement.',
      'Set a review interval so the same gap does not recur before the audit.',
    ];

    const data: ActionSuggestion = {
      title: toActionTitle(input.gapTitle),
      description:
        `${input.gapDescription}\n\n` +
        `Recommended approach:\n` +
        steps.map((s, i) => `${i + 1}. ${s}`).join('\n') +
        `\n\nThis recommendation was generated from the gap details and has not been reviewed by a person. Adjust the scope and wording to match how ${input.organizationName} actually works.`,
      suggestedPriority: input.severity,
      suggestedDueInDays: DUE_DAYS[input.severity],
      suggestedOwnerRole: input.department ? `${input.department} — ${role}` : role,
      steps,
    };

    const result = wrap(data, started, this.model);
    result.inputHash = hashInput(input);
    return result;
  }

  async generateAuditorQuestions(
    input: AuditorQuestionInput
  ): Promise<AiResult<AuditorQuestion[]>> {
    const started = Date.now();

    // Prioritise requirements that are weakest — that is where a real auditor
    // would find something, and where practice is most valuable.
    const ranked = [...input.requirements].sort((a, b) => {
      const weight = (s: string) =>
        s === 'MISSING' ? 4 : s === 'NEEDS_REVIEW' ? 3 : s === 'PARTIALLY_SATISFIED' ? 2 : s === 'NOT_ASSESSED' ? 1 : 0;
      return weight(b.status) - weight(a.status) || b.importance - a.importance;
    });

    const questions: AuditorQuestion[] = ranked.slice(0, input.count).map((req) => {
      const evidenceHint = req.evidenceTitles[0];
      const opener = pickOpener(req.identifier);
      return {
        projectRequirementId: req.projectRequirementId,
        question: evidenceHint
          ? `${opener} how ${lowerFirst(req.title)} is handled here. You've shown me “${evidenceHint}” — walk me through how that is kept current, and who is responsible.`
          : `${opener} how ${lowerFirst(req.title)} works in practice at ${input.organizationName}, and show me the records that demonstrate it.`,
        focus: `${req.identifier} — ${req.title}`,
      };
    });

    const result = wrap(questions, started, this.model);
    result.inputHash = hashInput({ c: input.count, ids: ranked.map((r) => r.identifier) });
    return result;
  }

  async evaluateAnswer(input: AnswerEvaluationInput): Promise<AiResult<AnswerEvaluation>> {
    const started = Date.now();
    const answer = input.answer.trim();
    const words = answer.split(/\s+/).filter(Boolean);

    // Clarity: rewards a substantive but not rambling answer.
    const clarity = clamp(
      words.length < 12 ? words.length / 24 : words.length > 400 ? 0.6 : Math.min(1, 0.35 + words.length / 160)
    );

    // Evidence: did the answer name any of the documents actually on file?
    const named = input.availableEvidence.filter((title) => {
      const key = title.replace(/\.[^.]+$/, '').toLowerCase();
      return key.length > 3 && answer.toLowerCase().includes(key.slice(0, Math.min(key.length, 18)));
    });
    const mentionsRecords = /\b(record|document|log|register|matrix|report|form|procedure|checklist|certificate)\w*/i.test(
      answer
    );
    const evidenceReferenced = clamp(named.length * 0.4 + (mentionsRecords ? 0.35 : 0));

    // Consistency: does the answer name a responsible party, a frequency and a
    // verification step — the three things auditors probe for.
    const hasOwner = /\b(manager|supervisor|lead|coordinator|team|responsible|owner|i\b|we\b)/i.test(answer);
    const hasFrequency = /\b(daily|weekly|monthly|quarterly|annual|yearly|each|every|per )\w*/i.test(answer);
    const hasVerification = /\b(verif|check|review|audit|confirm|approv|sign|monitor|effective)\w*/i.test(answer);
    const consistency = clamp(
      (hasOwner ? 0.34 : 0) + (hasFrequency ? 0.33 : 0) + (hasVerification ? 0.33 : 0)
    );

    const score = Math.round((clarity * 0.3 + evidenceReferenced * 0.35 + consistency * 0.35) * 100);

    const strengths: string[] = [];
    if (clarity > 0.6) strengths.push('Your answer is substantive and describes the process rather than just naming it.');
    if (named.length > 0) strengths.push(`You referenced evidence that is actually on file: ${named.slice(0, 3).join(', ')}.`);
    else if (mentionsRecords) strengths.push('You referred to records generally, which is the right instinct.');
    if (hasOwner) strengths.push('You identified who is responsible.');
    if (hasFrequency) strengths.push('You stated how often the activity happens.');
    if (hasVerification) strengths.push('You described how the activity is checked or verified.');

    const gaps: string[] = [];
    if (words.length < 15) gaps.push('The answer is very short — an auditor would keep probing for detail.');
    if (named.length === 0) {
      gaps.push('You did not name a specific document or record an auditor could ask to see.');
    }
    if (!hasOwner) gaps.push('You did not say who is responsible for this activity.');
    if (!hasFrequency) gaps.push('You did not say how often this happens or when it was last done.');
    if (!hasVerification) {
      gaps.push('Your response does not explain how effectiveness is verified — a very common follow-up question.');
    }

    const data: AnswerEvaluation = {
      score,
      clarity: Number(clarity.toFixed(2)),
      evidenceReferenced: Number(evidenceReferenced.toFixed(2)),
      consistency: Number(consistency.toFixed(2)),
      strengths: strengths.length > 0 ? strengths : ['You attempted the question — keep going.'],
      gaps: gaps.length > 0 ? gaps : ['Nothing obvious is missing. Practise saying it out loud and keep the records to hand.'],
      suggestedEvidence: input.availableEvidence.filter((t) => !named.includes(t)).slice(0, 4),
      coaching:
        score >= 80
          ? 'Strong response. Have the named records open and ready so you can show them immediately.'
          : score >= 55
            ? 'Reasonable response. Tighten it by naming the specific record, the person responsible, and how you know the process is working.'
            : 'Rebuild this answer around three things: what you do, the record that proves it, and how you verify it is effective.',
    };

    const result = wrap(data, started, this.model);
    result.inputHash = hashInput({ q: input.question, a: answer.slice(0, 2000) });
    return result;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

const OPENERS = [
  'Show me',
  'Walk me through',
  'Talk me through',
  'Help me understand',
  'Take me through',
];

function pickOpener(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return OPENERS[hash % OPENERS.length];
}

function toActionTitle(gapTitle: string): string {
  const cleaned = gapTitle.replace(/^(no|missing|incomplete)\s+/i, '');
  if (/^\d+ /.test(gapTitle)) return `Resolve: ${gapTitle}`;
  const label = Object.values(GAP_TYPE_LABELS).includes(gapTitle) ? gapTitle.toLowerCase() : cleaned;
  return `Address ${lowerFirst(label)}`.slice(0, 120);
}
