import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';
import { AI_DISCLAIMER } from '@/lib/enums';
import { analyzeDocumentHeuristically } from './heuristics';
import { MockAiProvider, PROMPT_VERSION, hashInput } from './mock';
import {
  actionSuggestionJsonSchema,
  actionSuggestionZod,
  answerEvaluationJsonSchema,
  answerEvaluationZod,
  auditorQuestionsJsonSchema,
  auditorQuestionsZod,
  documentAnalysisJsonSchema,
  documentAnalysisZod,
} from './schemas';
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

const SYSTEM_PROMPT = `You are the analysis engine inside AuditReady, an audit-readiness platform used by quality, safety, environmental and compliance managers at small and medium organizations.

Your job is to help a team see what evidence they have, what looks weak, and what a human should check before an audit. You are not an auditor and you never determine compliance.

Rules you must follow:
- Never state or imply that a requirement is compliant, certified, or that an audit would pass. Describe what the evidence appears to show and what a person should verify.
- Every conclusion is provisional and subject to human review. Say so in your own words where it matters; do not repeat a fixed disclaimer.
- Only reference requirements from the list you are given, using their exact identifiers. Never invent an identifier.
- Base every claim on the supplied document text. If the text does not support a claim, do not make it.
- Confidence and relevance are 0 to 1. Be calibrated: reserve values above 0.85 for cases where the document explicitly and completely addresses the requirement.
- Write for a busy operations manager: plain English, specific, no jargon padding.

Context for your own reasoning (do not quote it back): ${AI_DISCLAIMER}`;

interface ParseOptions {
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

/**
 * Live provider backed by the Anthropic Messages API.
 *
 * Structured outputs (`output_config.format`) constrain the response to the
 * JSON Schemas in `./schemas.ts`; the parsed payload is then re-validated with
 * Zod. Any failure — network, refusal, malformed payload — falls back to the
 * deterministic engine so a user action never dead-ends on an AI error.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;
  private fallback = new MockAiProvider();

  constructor() {
    if (!env.anthropicApiKey) {
      throw new Error('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set.');
    }
    this.model = env.aiModel;
    this.client = new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2 });
  }

  private async complete(
    prompt: string,
    schema: unknown,
    options: ParseOptions = {}
  ): Promise<{ raw: unknown; latencyMs: number }> {
    const started = Date.now();
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      // Structured output + a calibrated effort level. Typed loosely because
      // these fields move faster than the SDK's published types.
      output_config: { effort: options.effort ?? 'medium', format: { type: 'json_schema', schema } },
    } as never);

    const message = response as unknown as {
      stop_reason?: string;
      content: Array<{ type: string; text?: string }>;
    };

    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined to analyse this content.');
    }

    const text = message.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('');

    if (!text.trim()) throw new Error('Empty response from the model.');
    return { raw: JSON.parse(text), latencyMs: Date.now() - started };
  }

  async analyzeDocument(input: DocumentAnalysisInput): Promise<AiResult<DocumentAnalysis>> {
    const text = input.text.slice(0, env.aiMaxChars);
    const heuristic = analyzeDocumentHeuristically(input);

    if (text.trim().length < 40) {
      // Not enough text for a model call to add anything.
      return {
        data: heuristic,
        provider: this.name,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput({ f: input.filename }),
        latencyMs: 0,
        degraded: 'Too little machine-readable text for model analysis.',
      };
    }

    const requirementList = input.requirements
      .map(
        (r) =>
          `- ${r.identifier} | ${r.title} | importance ${r.importance}/5\n  Requirement: ${r.text}\n  Typical evidence: ${r.evidenceSuggestions.join('; ') || 'not specified'}`
      )
      .join('\n');

    const prompt = `Organization: ${input.organizationName}
Framework in scope: ${input.frameworkName}
Today's date: ${input.today}
Uploaded file: ${input.filename} (${input.mimeType})

REQUIREMENTS IN SCOPE
${requirementList}

DOCUMENT TEXT
"""
${text}
"""

Analyse this document and return the structured result. Specifically:
1. Classify the document type using a lowercase snake_case label (for example training_record, calibration_record, procedure).
2. Suggest a clear human-readable title.
3. Identify which of the listed requirements this document appears to address. Use the exact identifiers. Omit requirements it does not genuinely speak to — an empty list is a valid and useful answer.
4. For each match explain, in one or two sentences, what in the document supports it, and list concrete concerns a reviewer should check.
5. Extract dates, revision/version, document owner and department when they are present in the text. Use null when not present. Dates must be ISO (YYYY-MM-DD).
6. List potential gaps: missing approvals or signatures, incomplete entries, inconsistent or stale dates, missing revision control, missing owner. Only report gaps you can point to in the text.
7. List the specific things a human reviewer should verify.`;

    try {
      const { raw, latencyMs } = await this.complete(prompt, documentAnalysisJsonSchema, {
        maxTokens: 8000,
        effort: 'medium',
      });
      const parsed = documentAnalysisZod.parse(raw);

      // Map model-supplied identifiers back onto real ProjectRequirement ids.
      // Anything the model invented is dropped rather than trusted.
      const byIdentifier = new Map(input.requirements.map((r) => [r.identifier.toLowerCase(), r]));
      const matches = parsed.matches
        .map((m) => {
          const req = byIdentifier.get(m.identifier.toLowerCase().trim());
          if (!req) return null;
          return {
            projectRequirementId: req.projectRequirementId,
            identifier: req.identifier,
            relevance: clamp01(m.relevance),
            confidence: clamp01(m.confidence),
            strength: m.strength,
            rationale: m.rationale,
            concerns: m.concerns,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      const data: DocumentAnalysis = {
        ...parsed,
        matches,
        potentialGaps: parsed.potentialGaps,
        overallConfidence: clamp01(parsed.overallConfidence),
      };

      return {
        data,
        provider: this.name,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput({ f: input.filename, t: text.slice(0, 4000) }),
        latencyMs,
      };
    } catch (error) {
      console.error('[ai] document analysis failed, falling back to heuristics', error);
      return {
        data: heuristic,
        provider: `${this.name}+fallback`,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput({ f: input.filename, t: text.slice(0, 4000) }),
        latencyMs: 0,
        degraded: `Model call failed (${(error as Error).message}). Showing the built-in analysis instead.`,
      };
    }
  }

  async suggestAction(input: ActionSuggestionInput): Promise<AiResult<ActionSuggestion>> {
    const prompt = `Organization: ${input.organizationName}
Gap severity: ${input.severity}
${input.requirementIdentifier ? `Related requirement: ${input.requirementIdentifier} — ${input.requirementTitle}` : 'No specific requirement is linked.'}
${input.department ? `Department: ${input.department}` : ''}

GAP
Title: ${input.gapTitle}
Detail: ${input.gapDescription}

Turn this gap into one practical corrective action a small team can actually complete before an audit. Be concrete about what to review, what to produce, and how to confirm it is done. Suggest a realistic number of days to complete it and the role best placed to own it. Do not promise a compliance outcome.`;

    try {
      const { raw, latencyMs } = await this.complete(prompt, actionSuggestionJsonSchema, {
        maxTokens: 2000,
        effort: 'low',
      });
      return {
        data: actionSuggestionZod.parse(raw),
        provider: this.name,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput(input),
        latencyMs,
      };
    } catch (error) {
      console.error('[ai] action suggestion failed, falling back', error);
      const fallback = await this.fallback.suggestAction(input);
      return { ...fallback, provider: `${this.name}+fallback`, degraded: (error as Error).message };
    }
  }

  async generateAuditorQuestions(
    input: AuditorQuestionInput
  ): Promise<AiResult<AuditorQuestion[]>> {
    const list = input.requirements
      .map(
        (r) =>
          `- ${r.identifier} | ${r.title} | status ${r.status} | evidence on file: ${r.evidenceTitles.join(', ') || 'none'}\n  ${r.text}`
      )
      .join('\n');

    const prompt = `Organization: ${input.organizationName}
Framework: ${input.frameworkName}

REQUIREMENTS AND CURRENT STATE
${list}

Write ${input.count} questions an experienced auditor would actually ask during an on-site audit of this organization. Rules:
- Ask open, evidence-seeking questions ("show me…", "walk me through…"), never yes/no questions.
- Favour requirements whose status is MISSING, NEEDS_REVIEW or PARTIALLY_SATISFIED — that is where practice is most valuable.
- Where evidence exists, ask about how it is maintained, who owns it, and how effectiveness is verified.
- One question per requirement. Set requirementIdentifier to the exact identifier, or null for a general opening question.
- Keep each question under 45 words and make it sound like a person speaking.`;

    try {
      const { raw, latencyMs } = await this.complete(prompt, auditorQuestionsJsonSchema, {
        maxTokens: 3000,
        effort: 'medium',
      });
      const parsed = auditorQuestionsZod.parse(raw);
      const byIdentifier = new Map(input.requirements.map((r) => [r.identifier.toLowerCase(), r]));

      const questions: AuditorQuestion[] = parsed.questions.slice(0, input.count).map((q) => {
        const req = q.requirementIdentifier
          ? byIdentifier.get(q.requirementIdentifier.toLowerCase().trim())
          : undefined;
        return {
          projectRequirementId: req?.projectRequirementId ?? null,
          question: q.question,
          focus: req ? `${req.identifier} — ${req.title}` : q.focus,
        };
      });

      if (questions.length === 0) throw new Error('Model returned no usable questions.');

      return {
        data: questions,
        provider: this.name,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput({ ids: input.requirements.map((r) => r.identifier), c: input.count }),
        latencyMs,
      };
    } catch (error) {
      console.error('[ai] question generation failed, falling back', error);
      const fallback = await this.fallback.generateAuditorQuestions(input);
      return { ...fallback, provider: `${this.name}+fallback`, degraded: (error as Error).message };
    }
  }

  async evaluateAnswer(input: AnswerEvaluationInput): Promise<AiResult<AnswerEvaluation>> {
    const prompt = `AUDITOR QUESTION
${input.question}

${input.requirementIdentifier ? `RELATED REQUIREMENT\n${input.requirementIdentifier} — ${input.requirementTitle}\n${input.requirementText ?? ''}` : ''}

EVIDENCE CURRENTLY ON FILE
${input.availableEvidence.length > 0 ? input.availableEvidence.map((e) => `- ${e}`).join('\n') : '- none'}

THE PERSON'S ANSWER
"""
${input.answer.slice(0, 8000)}
"""

Evaluate this answer as preparation coaching, not as an audit result. Score 0-100 overall, plus three 0-1 sub-scores for clarity, evidence referenced, and internal consistency. Say what was strong, what an auditor would push back on, which of the listed evidence items should have been mentioned, and give one short paragraph of coaching. Be encouraging but honest.`;

    try {
      const { raw, latencyMs } = await this.complete(prompt, answerEvaluationJsonSchema, {
        maxTokens: 2500,
        effort: 'low',
      });
      return {
        data: answerEvaluationZod.parse(raw),
        provider: this.name,
        model: this.model,
        promptVersion: PROMPT_VERSION,
        inputHash: hashInput({ q: input.question, a: input.answer.slice(0, 2000) }),
        latencyMs,
      };
    } catch (error) {
      console.error('[ai] answer evaluation failed, falling back', error);
      const fallback = await this.fallback.evaluateAnswer(input);
      return { ...fallback, provider: `${this.name}+fallback`, degraded: (error as Error).message };
    }
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
