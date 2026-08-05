import 'server-only';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { stringifyJson } from '@/lib/json';
import { AnthropicAiProvider } from './anthropic';
import { MockAiProvider } from './mock';
import type { AiProvider, AiResult } from './types';

export * from './types';
export { PROMPT_VERSION } from './mock';

let provider: AiProvider | null = null;

/**
 * Returns the configured provider.
 *
 * `AI_PROVIDER=anthropic` requires ANTHROPIC_API_KEY; if construction fails we
 * log loudly and fall back to the deterministic provider so the product keeps
 * working rather than 500-ing on every upload.
 */
export function ai(): AiProvider {
  if (provider) return provider;
  if (env.aiProvider === 'anthropic') {
    try {
      provider = new AnthropicAiProvider();
      return provider;
    } catch (error) {
      console.error('[ai] falling back to the built-in provider:', (error as Error).message);
    }
  }
  provider = new MockAiProvider();
  return provider;
}

export function aiProviderLabel(): { name: string; model: string; live: boolean } {
  const p = ai();
  return { name: p.name, model: p.model, live: p.name !== 'mock' };
}

export type AssessmentSubject =
  | 'EVIDENCE'
  | 'PROJECT_REQUIREMENT'
  | 'SIMULATOR_ANSWER'
  | 'GAP';

export type AssessmentKind =
  | 'DOCUMENT_ANALYSIS'
  | 'REQUIREMENT_ASSESSMENT'
  | 'ACTION_SUGGESTION'
  | 'SIMULATOR_QUESTIONS'
  | 'SIMULATOR_EVALUATION';

/**
 * Persists an AI conclusion with full provenance. Previous ACTIVE assessments
 * for the same subject+kind are marked SUPERSEDED so the history is retained
 * but only one row is authoritative.
 */
export async function recordAssessment<T>(params: {
  orgId: string;
  subjectType: AssessmentSubject;
  subjectId: string;
  kind: AssessmentKind;
  result: AiResult<T>;
  summary?: string;
  confidence?: number;
}) {
  await prisma.aiAssessment.updateMany({
    where: {
      orgId: params.orgId,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      kind: params.kind,
      status: 'ACTIVE',
    },
    data: { status: 'SUPERSEDED' },
  });

  return prisma.aiAssessment.create({
    data: {
      orgId: params.orgId,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      kind: params.kind,
      provider: params.result.provider,
      model: params.result.model,
      promptVersion: params.result.promptVersion,
      inputHash: params.result.inputHash,
      output: stringifyJson(params.result.data),
      summary: params.summary,
      confidence: params.confidence,
      latencyMs: params.result.latencyMs,
      status: 'ACTIVE',
    },
  });
}
