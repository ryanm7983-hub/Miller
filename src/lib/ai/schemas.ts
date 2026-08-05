import { z } from 'zod';

import { AI_STRENGTHS, GAP_TYPES, SEVERITIES } from '@/lib/enums';

/**
 * JSON Schemas passed to the model via `output_config.format`, paired with Zod
 * schemas used to validate whatever comes back. Structured output is enforced
 * at the API level *and* re-validated here — a malformed payload degrades to
 * the heuristic engine rather than corrupting tenant data.
 */

export const documentAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentType: { type: 'string' },
    suggestedTitle: { type: 'string' },
    summary: { type: 'string' },
    identifiedDates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['label', 'date'],
      },
    },
    effectiveDate: { type: ['string', 'null'] },
    expiresAt: { type: ['string', 'null'] },
    revision: { type: ['string', 'null'] },
    documentOwner: { type: ['string', 'null'] },
    department: { type: ['string', 'null'] },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          identifier: { type: 'string' },
          relevance: { type: 'number' },
          confidence: { type: 'number' },
          strength: { type: 'string', enum: [...AI_STRENGTHS] },
          rationale: { type: 'string' },
          concerns: { type: 'array', items: { type: 'string' } },
        },
        required: ['identifier', 'relevance', 'confidence', 'strength', 'rationale', 'concerns'],
      },
    },
    potentialGaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: [...GAP_TYPES] },
          severity: { type: 'string', enum: [...SEVERITIES] },
          title: { type: 'string' },
          description: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['type', 'severity', 'title', 'description', 'recommendation'],
      },
    },
    humanVerification: { type: 'array', items: { type: 'string' } },
    overallConfidence: { type: 'number' },
  },
  required: [
    'documentType',
    'suggestedTitle',
    'summary',
    'identifiedDates',
    'effectiveDate',
    'expiresAt',
    'revision',
    'documentOwner',
    'department',
    'matches',
    'potentialGaps',
    'humanVerification',
    'overallConfidence',
  ],
} as const;

export const documentAnalysisZod = z.object({
  documentType: z.string(),
  suggestedTitle: z.string(),
  summary: z.string(),
  identifiedDates: z.array(z.object({ label: z.string(), date: z.string() })).default([]),
  effectiveDate: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  revision: z.string().nullable().default(null),
  documentOwner: z.string().nullable().default(null),
  department: z.string().nullable().default(null),
  matches: z
    .array(
      z.object({
        identifier: z.string(),
        relevance: z.number(),
        confidence: z.number(),
        strength: z.enum(AI_STRENGTHS),
        rationale: z.string(),
        concerns: z.array(z.string()).default([]),
      })
    )
    .default([]),
  potentialGaps: z
    .array(
      z.object({
        type: z.enum(GAP_TYPES),
        severity: z.enum(SEVERITIES),
        title: z.string(),
        description: z.string(),
        recommendation: z.string().optional(),
      })
    )
    .default([]),
  humanVerification: z.array(z.string()).default([]),
  overallConfidence: z.number().default(0.5),
});

export const actionSuggestionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    suggestedPriority: { type: 'string', enum: [...SEVERITIES] },
    suggestedDueInDays: { type: 'integer' },
    suggestedOwnerRole: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'description', 'suggestedPriority', 'suggestedDueInDays', 'suggestedOwnerRole', 'steps'],
} as const;

export const actionSuggestionZod = z.object({
  title: z.string(),
  description: z.string(),
  suggestedPriority: z.enum(SEVERITIES),
  suggestedDueInDays: z.number().int().min(1).max(365),
  suggestedOwnerRole: z.string(),
  steps: z.array(z.string()).default([]),
});

export const auditorQuestionsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          requirementIdentifier: { type: ['string', 'null'] },
          question: { type: 'string' },
          focus: { type: 'string' },
        },
        required: ['requirementIdentifier', 'question', 'focus'],
      },
    },
  },
  required: ['questions'],
} as const;

export const auditorQuestionsZod = z.object({
  questions: z
    .array(
      z.object({
        requirementIdentifier: z.string().nullable().default(null),
        question: z.string(),
        focus: z.string(),
      })
    )
    .default([]),
});

export const answerEvaluationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'integer' },
    clarity: { type: 'number' },
    evidenceReferenced: { type: 'number' },
    consistency: { type: 'number' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    suggestedEvidence: { type: 'array', items: { type: 'string' } },
    coaching: { type: 'string' },
  },
  required: [
    'score',
    'clarity',
    'evidenceReferenced',
    'consistency',
    'strengths',
    'gaps',
    'suggestedEvidence',
    'coaching',
  ],
} as const;

export const answerEvaluationZod = z.object({
  score: z.number().min(0).max(100),
  clarity: z.number(),
  evidenceReferenced: z.number(),
  consistency: z.number(),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  suggestedEvidence: z.array(z.string()).default([]),
  coaching: z.string(),
});
