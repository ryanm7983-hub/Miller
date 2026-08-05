import type { AiStrength, GapType, Severity } from '@/lib/enums';

/**
 * AI abstraction layer.
 *
 * Every provider returns `AiResult<T>` so the caller can persist full
 * provenance (provider, model, prompt version, latency, input hash) alongside
 * the conclusion. No part of the application consumes a raw model response.
 */
export interface AiResult<T> {
  data: T;
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  latencyMs: number;
  /** Present when the provider degraded to a heuristic path. */
  degraded?: string;
}

export interface RequirementRef {
  /** ProjectRequirement id — what links are written against. */
  projectRequirementId: string;
  identifier: string;
  title: string;
  text: string;
  guidance?: string | null;
  evidenceSuggestions: string[];
  importance: number;
}

export interface DocumentAnalysisInput {
  filename: string;
  mimeType: string;
  text: string;
  /** Candidate requirements from the project the document belongs to. */
  requirements: RequirementRef[];
  today: string;
  organizationName: string;
  frameworkName: string;
}

export interface DocumentMatch {
  projectRequirementId: string;
  identifier: string;
  /** 0…1 — how much the document speaks to this requirement. */
  relevance: number;
  /** 0…1 — the model's confidence in its own relevance judgement. */
  confidence: number;
  strength: AiStrength;
  rationale: string;
  concerns: string[];
}

export interface PotentialGap {
  type: GapType;
  severity: Severity;
  title: string;
  description: string;
  recommendation?: string;
}

export interface DocumentAnalysis {
  documentType: string;
  suggestedTitle: string;
  summary: string;
  identifiedDates: Array<{ label: string; date: string }>;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  revision?: string | null;
  documentOwner?: string | null;
  department?: string | null;
  matches: DocumentMatch[];
  potentialGaps: PotentialGap[];
  /** Concrete things a human reviewer should confirm. */
  humanVerification: string[];
  overallConfidence: number;
}

export interface ActionSuggestionInput {
  gapTitle: string;
  gapDescription: string;
  requirementIdentifier?: string;
  requirementTitle?: string;
  severity: Severity;
  organizationName: string;
  department?: string | null;
}

export interface ActionSuggestion {
  title: string;
  description: string;
  suggestedPriority: Severity;
  suggestedDueInDays: number;
  suggestedOwnerRole: string;
  steps: string[];
}

export interface AuditorQuestionInput {
  frameworkName: string;
  organizationName: string;
  requirements: Array<
    RequirementRef & { status: string; evidenceTitles: string[] }
  >;
  count: number;
}

export interface AuditorQuestion {
  projectRequirementId: string | null;
  question: string;
  focus: string;
}

export interface AnswerEvaluationInput {
  question: string;
  answer: string;
  requirementIdentifier?: string;
  requirementTitle?: string;
  requirementText?: string;
  availableEvidence: string[];
}

export interface AnswerEvaluation {
  score: number;
  clarity: number;
  evidenceReferenced: number;
  consistency: number;
  strengths: string[];
  gaps: string[];
  suggestedEvidence: string[];
  coaching: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  analyzeDocument(input: DocumentAnalysisInput): Promise<AiResult<DocumentAnalysis>>;
  suggestAction(input: ActionSuggestionInput): Promise<AiResult<ActionSuggestion>>;
  generateAuditorQuestions(input: AuditorQuestionInput): Promise<AiResult<AuditorQuestion[]>>;
  evaluateAnswer(input: AnswerEvaluationInput): Promise<AiResult<AnswerEvaluation>>;
}
