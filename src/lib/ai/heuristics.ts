import type { AiStrength, GapType, Severity } from '@/lib/enums';
import { findDates } from '@/lib/documents/extract';
import type {
  DocumentAnalysis,
  DocumentAnalysisInput,
  DocumentMatch,
  PotentialGap,
  RequirementRef,
} from './types';

/**
 * Deterministic document-analysis engine.
 *
 * This is the mock AI provider's brain, and it is also the fallback used when a
 * live provider call fails. It is a genuine retrieval model — IDF-weighted term
 * overlap between the document text and each requirement's text, guidance and
 * suggested evidence — plus rule-based record-quality checks. It produces
 * useful, explainable output with no API key, which keeps the whole product
 * demonstrable and testable offline.
 */

const STOPWORDS = new Set(
  `a an the and or but if then than that this these those of in on at to for with by from as is are was were be been being
   it its his her their our your my we you they he she i not no nor so such shall should will would can could may might must
   have has had do does did done there here when where which who whom whose what how why all any each other more most some
   only own same too very s t just don now also into over under out up down off again further once because while about
   against between during before after above below both few
   procedure process document record records shall ensure ensures required requirement requirements organization organisation`
    .split(/\s+/)
    .filter(Boolean)
);

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/(ations|ation|ities|ility)$/, 'at')
    .replace(/(ing|ed|es|s)$/, '')
    .replace(/(ly|ness|ment)$/, '');
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem)
    .filter((w) => w.length > 2);
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

/**
 * A requirement's query terms, weighted by which field they came from.
 *
 * Field weighting matters more than raw frequency here: the evidence
 * suggestions ("calibration certificates", "training records") are the most
 * discriminative signal in the whole framework, because they describe the
 * document a user would actually upload, so they carry the highest weight.
 */
const FIELD_WEIGHTS = { title: 2.0, evidence: 2.6, text: 1.0, guidance: 0.7 } as const;

function requirementTerms(req: RequirementRef): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const term of new Set(tokenize(text))) {
      weights.set(term, Math.max(weights.get(term) ?? 0, weight));
    }
  };
  add(req.text, FIELD_WEIGHTS.text);
  add(req.guidance ?? '', FIELD_WEIGHTS.guidance);
  add(req.title, FIELD_WEIGHTS.title);
  add(req.evidenceSuggestions.join(' '), FIELD_WEIGHTS.evidence);
  return weights;
}

/** Inverse document frequency across the requirement set. */
function buildIdf(requirements: RequirementRef[]): Map<string, number> {
  const docCount = Math.max(requirements.length, 1);
  const seen = new Map<string, number>();
  for (const req of requirements) {
    for (const term of requirementTerms(req).keys()) {
      seen.set(term, (seen.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of seen) {
    idf.set(term, Math.log(1 + docCount / count));
  }
  return idf;
}

const DOCUMENT_TYPE_RULES: Array<{ type: string; patterns: RegExp[] }> = [
  { type: 'training_record', patterns: [/\btraining\b/i, /\bcourse\b/i, /\battendance\b/i] },
  { type: 'competency_matrix', patterns: [/competenc/i, /skills? matrix/i, /qualification/i] },
  { type: 'calibration_record', patterns: [/calibrat/i, /gauge/i, /\bmeasurement equipment\b/i] },
  { type: 'management_review', patterns: [/management review/i, /leadership review/i] },
  { type: 'internal_audit', patterns: [/internal audit/i, /audit (plan|programme|program|schedule)/i] },
  { type: 'supplier_evaluation', patterns: [/supplier/i, /vendor/i, /subcontractor/i] },
  { type: 'risk_assessment', patterns: [/risk assessment/i, /hazard/i, /risk register/i] },
  { type: 'corrective_action', patterns: [/corrective action/i, /\bcapa\b/i, /nonconform/i, /root cause/i] },
  { type: 'maintenance_record', patterns: [/maintenance/i, /preventive service/i, /work order/i] },
  { type: 'inspection_record', patterns: [/inspection/i, /\bcheck ?sheet\b/i, /\bqc report\b/i] },
  { type: 'meeting_minutes', patterns: [/minutes/i, /attendees/i, /agenda/i] },
  { type: 'certificate', patterns: [/certificate/i, /certification/i, /accredited/i] },
  { type: 'policy', patterns: [/\bpolicy\b/i, /policy statement/i] },
  { type: 'work_instruction', patterns: [/work instruction/i, /\bwi-\d/i, /step-by-step/i] },
  { type: 'procedure', patterns: [/\bprocedure\b/i, /\bsop\b/i, /\bqp-\d/i] },
  { type: 'form', patterns: [/\bform\b/i, /\btemplate\b/i] },
];

export function detectDocumentType(filename: string, text: string): string {
  const haystack = `${filename}\n${text.slice(0, 6000)}`;
  for (const rule of DOCUMENT_TYPE_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) return rule.type;
  }
  return text.length > 0 ? 'record' : 'other';
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstMeaningfulLine(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed.length >= 8 && trimmed.length <= 120 && /[a-z]/i.test(trimmed)) return trimmed;
  }
  return null;
}

interface RecordQualitySignals {
  hasApproval: boolean;
  hasSignature: boolean;
  hasRevision: boolean;
  hasOwner: boolean;
  blankMarkers: number;
  rowCount: number;
}

function inspectRecordQuality(text: string): RecordQualitySignals {
  const lower = text.toLowerCase();
  return {
    hasApproval: /approv(ed|al)\s*(by|:)/.test(lower) || /authoris(ed|ation)|authoriz(ed|ation)/.test(lower),
    hasSignature: /signature|signed\s*(by|:)|\bsign-?off\b/.test(lower),
    hasRevision: /\b(rev(ision)?|version|issue)\s*[:.]?\s*[a-z0-9]/.test(lower),
    hasOwner: /(document )?owner\s*[:.]|responsible\s*(person|party|manager)|prepared by/.test(lower),
    blankMarkers: (text.match(/\b(tbd|tbc|n\/a|pending|to be (confirmed|completed|determined))\b/gi) ?? []).length,
    rowCount: text.split('\n').filter((l) => l.includes('|')).length,
  };
}

function detectGaps(
  input: DocumentAnalysisInput,
  quality: RecordQualitySignals,
  dates: Array<{ iso: string; raw: string; context: string }>
): PotentialGap[] {
  const gaps: PotentialGap[] = [];
  const today = new Date(input.today);
  const push = (
    type: GapType,
    severity: Severity,
    title: string,
    description: string,
    recommendation?: string
  ) => gaps.push({ type, severity, title, description, recommendation });

  const isControlled = ['policy', 'procedure', 'work_instruction', 'form'].includes(
    detectDocumentType(input.filename, input.text)
  );

  if (isControlled && !quality.hasRevision) {
    push(
      'MISSING_REVISION',
      'MEDIUM',
      'No revision or version identifier found',
      `“${input.filename}” reads as a controlled document but no revision, version or issue number was detected in the text.`,
      'Add a revision identifier and issue date to the document header, and confirm it matches your document control register.'
    );
  }
  if (isControlled && !quality.hasApproval) {
    push(
      'MISSING_APPROVAL',
      'HIGH',
      'No documented approval found',
      'No approval or authorisation statement was detected. Auditors commonly ask who approved a controlled document and when.',
      'Add an approval block (name, role, date) or attach the approval record.'
    );
  }
  if (quality.rowCount > 4 && !quality.hasSignature && !quality.hasApproval) {
    push(
      'MISSING_SIGNATURE',
      'MEDIUM',
      'Record contains no sign-off',
      'This looks like a record with multiple rows but no signature or verification column was detected.',
      'Confirm whether sign-off is captured elsewhere; if not, add a verified-by column.'
    );
  }
  if (!quality.hasOwner) {
    push(
      'MISSING_OWNER',
      'LOW',
      'No responsible owner identified',
      'No document owner or responsible person was detected in the content.',
      'Assign an owner in AuditReady, and consider adding the role to the document itself.'
    );
  }
  if (quality.blankMarkers > 0) {
    push(
      'INCOMPLETE_RECORD',
      quality.blankMarkers >= 3 ? 'HIGH' : 'MEDIUM',
      `${quality.blankMarkers} incomplete entr${quality.blankMarkers === 1 ? 'y' : 'ies'} detected`,
      `The document contains ${quality.blankMarkers} placeholder value(s) such as “TBD”, “N/A” or “pending”. Incomplete records are a frequent audit finding.`,
      'Review the highlighted entries and complete them, or record a justification for why they are not applicable.'
    );
  }

  if (dates.length > 0) {
    const parsed = dates.map((d) => new Date(d.iso)).filter((d) => !Number.isNaN(d.getTime()));
    const newest = new Date(Math.max(...parsed.map((d) => d.getTime())));
    const ageDays = Math.floor((today.getTime() - newest.getTime()) / 86_400_000);
    if (ageDays > 730) {
      push(
        'OUTDATED_EVIDENCE',
        'HIGH',
        'Most recent date is over two years old',
        `The newest date found in this document is ${newest.toISOString().slice(0, 10)} (${ageDays} days ago). The evidence may no longer reflect current practice.`,
        'Confirm the document is still current, or replace it with the latest revision.'
      );
    } else if (ageDays > 400) {
      push(
        'OUTDATED_EVIDENCE',
        'MEDIUM',
        'Evidence may be more than a year old',
        `The newest date found is ${newest.toISOString().slice(0, 10)}. Annual activities usually need evidence from the current cycle.`,
        'Verify whether a more recent record exists.'
      );
    }

    const future = parsed.filter((d) => d.getTime() > today.getTime() + 5 * 365 * 86_400_000);
    if (future.length > 0) {
      push(
        'INCONSISTENT_DATES',
        'LOW',
        'Dates far in the future detected',
        'One or more dates are more than five years in the future, which may indicate a typographical error.',
        'Check the dates in this document for transcription errors.'
      );
    }
  } else if (input.text.length > 400) {
    push(
      'INCOMPLETE_RECORD',
      'MEDIUM',
      'No dates found in the document',
      'No recognisable dates were detected. Records normally need to show when the activity took place.',
      'Add effective, completion or review dates to this record.'
    );
  }

  return gaps;
}

export function analyzeDocumentHeuristically(input: DocumentAnalysisInput): DocumentAnalysis {
  const text = input.text ?? '';
  const docTokens = tokenize(text);
  const docTf = termFrequencies(docTokens);

  // The filename is real evidence of intent — people name documents for what
  // they are, and structured records often never repeat that word in their
  // contents (a maintenance schedule is a table of assets and dates). Filename
  // terms are folded in with the weight of a few in-body occurrences.
  const FILENAME_TF_BOOST = 3;
  for (const term of tokenize(input.filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))) {
    docTf.set(term, (docTf.get(term) ?? 0) + FILENAME_TF_BOOST);
  }

  const idf = buildIdf(input.requirements);

  const matches: DocumentMatch[] = [];
  if (docTokens.length >= 10) {
    const distinctDocTerms = docTf.size;

    // Score every requirement against the document.
    //
    // Two properties matter for this domain. First, a *short* record (a
    // calibration register, a training matrix) must be able to match strongly:
    // normalising by the requirement's whole vocabulary punishes exactly the
    // structured evidence customers upload most, so length normalisation is
    // deliberately soft (^0.55). Second, matched-weight coverage — how much of
    // the requirement's *important* language is present — is what separates a
    // real match from an incidental word overlap, so it drives strength.
    const scored = input.requirements.map((req) => {
      const terms = requirementTerms(req);
      let score = 0;
      let possible = 0;
      let matchedWeight = 0;
      let hits = 0;

      for (const [term, fieldWeight] of terms) {
        const weight = (idf.get(term) ?? 1) * fieldWeight;
        possible += weight;
        const tf = docTf.get(term);
        if (tf) {
          score += weight * (1 + Math.log(tf));
          matchedWeight += weight;
          hits++;
        }
      }

      // An explicit mention of the clause number is close to proof.
      const identifierMentioned = new RegExp(
        `\\b${req.identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i'
      ).test(text);

      // Fraction of the requirement's weighted vocabulary that is present.
      const weightedCoverage = possible > 0 ? matchedWeight / possible : 0;
      // How much of the document is about this requirement, which stops a long
      // document from matching everything equally.
      const docCoverage = distinctDocTerms > 0 ? hits / distinctDocTerms : 0;
      // Soft length normalisation.
      const normalized = possible > 0 ? score / Math.pow(possible, 0.55) : 0;

      return { req, normalized, weightedCoverage, docCoverage, hits, identifierMentioned };
    });

    // Rank-normalise so the strongest requirement for this document always
    // surfaces, rather than every match falling below an absolute floor.
    const peak = Math.max(...scored.map((s) => s.normalized), 0);

    const ranked = scored.map((s) => {
      const rankScore = peak > 0 ? s.normalized / peak : 0;
      let relevance = Math.min(
        1,
        rankScore * 0.6 + Math.min(1, s.weightedCoverage * 2.4) * 0.3 + Math.min(1, s.docCoverage * 3) * 0.1
      );
      if (s.identifierMentioned) relevance = Math.min(1, relevance + 0.3);
      return { ...s, relevance };
    });

    const best = Math.max(...ranked.map((s) => s.relevance), 0);

    for (const s of ranked) {
      // Keep matches that are both credible on their own and competitive with
      // the best one, so a document is not linked to every requirement. The
      // single best match is kept whenever there is any real signal at all —
      // "this belongs somewhere" is more useful than silence.
      const isBest = s.relevance === best && s.hits > 0 && s.weightedCoverage >= 0.04;
      if (!isBest && (s.relevance < 0.3 || s.relevance < best * 0.55 || s.weightedCoverage < 0.07)) continue;

      const lengthConfidence = Math.min(1, docTokens.length / 350);
      const confidence = Math.max(
        0.25,
        Math.min(0.95, Math.min(1, s.weightedCoverage * 2.2) * 0.5 + lengthConfidence * 0.2 + s.relevance * 0.3)
      );

      const strength: AiStrength = s.identifierMentioned
        ? 'STRONG'
        : s.weightedCoverage >= 0.26
          ? 'STRONG'
          : s.weightedCoverage >= 0.14
            ? 'PARTIAL'
            : 'WEAK';

      const concerns: string[] = [];
      if (s.weightedCoverage < 0.14) {
        concerns.push('Only part of the requirement’s language appears in this document.');
      }
      if (docTokens.length < 120) {
        concerns.push('The document is short, so the match is based on limited text.');
      }
      if (strength === 'WEAK') {
        concerns.push('This is the closest requirement found, but the link is tentative — confirm it before relying on it.');
      }

      matches.push({
        projectRequirementId: s.req.projectRequirementId,
        identifier: s.req.identifier,
        relevance: Number(s.relevance.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        strength,
        rationale: s.identifierMentioned
          ? `The document explicitly references ${s.req.identifier} and covers related terminology such as ${topTerms(s.req, docTf)}.`
          : `The document uses language associated with “${s.req.title}” — notably ${topTerms(s.req, docTf)} — which is what this requirement asks the organization to demonstrate.`,
        concerns,
      });
    }

    matches.sort((a, b) => b.relevance - a.relevance);
  }

  const quality = inspectRecordQuality(text);
  const dates = findDates(text, 30);
  const gaps = detectGaps(input, quality, dates);

  const revisionMatch = text.match(/\b(?:rev(?:ision)?|version|issue)\s*[:.]?\s*([a-z0-9][a-z0-9.\-]{0,9})/i);
  const ownerMatch = text.match(/(?:document owner|owner|prepared by|responsible)\s*[:.]\s*([A-Z][A-Za-z.'\- ]{2,40})/);
  const departmentMatch = text.match(
    /\b(quality|production|operations|engineering|maintenance|hr|human resources|safety|ehs|environmental|purchasing|logistics|warehouse)\b/i
  );

  const sorted = [...dates].sort((a, b) => a.iso.localeCompare(b.iso));
  // The effective date is the most recent date that has actually happened.
  // Records routinely carry future dates (next review, refresher due), and
  // treating one of those as the effective date would be plainly wrong.
  const past = sorted.filter((d) => d.iso <= input.today);

  return {
    documentType: detectDocumentType(input.filename, text),
    suggestedTitle: firstMeaningfulLine(text) ?? titleFromFilename(input.filename),
    summary: buildSummary(input, matches, quality, dates.length),
    identifiedDates: sorted.slice(0, 12).map((d) => ({ label: d.context.slice(0, 90), date: d.iso })),
    effectiveDate: past.length > 0 ? past[past.length - 1].iso : null,
    expiresAt: null,
    revision: revisionMatch ? revisionMatch[1] : null,
    documentOwner: ownerMatch ? ownerMatch[1].trim() : null,
    department: departmentMatch ? capitalize(departmentMatch[1]) : null,
    matches: matches.slice(0, 8),
    potentialGaps: gaps,
    humanVerification: buildVerificationList(matches, quality, dates.length),
    overallConfidence: matches.length > 0 ? Number((matches[0].confidence * 0.9).toFixed(2)) : 0.2,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function topTerms(req: RequirementRef, docTf: Map<string, number>): string {
  const terms = [...requirementTerms(req).keys()]
    .filter((t) => docTf.has(t))
    .sort((a, b) => (docTf.get(b) ?? 0) - (docTf.get(a) ?? 0))
    .slice(0, 4);
  return terms.length > 0 ? `“${terms.join('”, “')}”` : 'related terminology';
}

function buildSummary(
  input: DocumentAnalysisInput,
  matches: DocumentMatch[],
  quality: RecordQualitySignals,
  dateCount: number
): string {
  if (input.text.trim().length === 0) {
    return `No machine-readable text could be extracted from “${input.filename}”, so no automated assessment was possible. A reviewer needs to open this file and link it to requirements manually.`;
  }
  const parts: string[] = [];
  parts.push(
    matches.length > 0
      ? `This document appears to address ${matches.length} requirement${matches.length === 1 ? '' : 's'} in the ${input.frameworkName} scope, most strongly ${matches[0].identifier}.`
      : `No strong link to the current ${input.frameworkName} requirements was detected from the text of this document.`
  );
  parts.push(
    dateCount > 0
      ? `${dateCount} date reference${dateCount === 1 ? '' : 's'} were identified.`
      : 'No dates were identified in the content.'
  );
  if (quality.hasApproval) parts.push('An approval or authorisation statement is present.');
  if (quality.blankMarkers > 0) {
    parts.push(`${quality.blankMarkers} placeholder value(s) suggest the record is not fully complete.`);
  }
  return parts.join(' ');
}

function buildVerificationList(
  matches: DocumentMatch[],
  quality: RecordQualitySignals,
  dateCount: number
): string[] {
  const items = [
    'Confirm this is the current, released revision of the document.',
    matches.length > 0
      ? `Confirm the suggested requirement links (${matches.slice(0, 3).map((m) => m.identifier).join(', ')}) are the right ones.`
      : 'Link this document to the requirements it supports, or mark it as background information.',
  ];
  if (!quality.hasApproval) items.push('Verify who approved this document and when.');
  if (dateCount === 0) items.push('Check whether the record should carry completion or review dates.');
  if (quality.blankMarkers > 0) items.push('Complete or justify the placeholder entries.');
  items.push('Confirm the document reflects what actually happens in practice.');
  return items;
}
