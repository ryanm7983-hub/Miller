/**
 * Central enumerations.
 *
 * The SQLite datasource cannot express native enums, so every enumerated
 * column is a `String` in Prisma and this module is the single source of truth
 * for the allowed values, their ordering, and their presentation metadata.
 */

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CONTRIBUTOR', 'VIEWER', 'CONSULTANT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CONTRIBUTOR: 'Contributor',
  VIEWER: 'Viewer',
  CONSULTANT: 'Consultant',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Full access including billing and deleting the organization.',
  ADMIN: 'Manage members, settings and every audit project.',
  MANAGER: 'Create and run audits, manage requirements, gaps and actions.',
  CONTRIBUTOR: 'Upload evidence, comment, and complete assigned actions.',
  VIEWER: 'Read-only access to dashboards, evidence and reports.',
  CONSULTANT: 'External advisor working on this organization via an engagement.',
};

export const ORG_KINDS = ['STANDARD', 'CONSULTANCY'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

// ---------------------------------------------------------------------------

export const REQUIREMENT_STATUSES = [
  'NOT_ASSESSED',
  'MISSING',
  'NEEDS_REVIEW',
  'PARTIALLY_SATISFIED',
  'SATISFIED',
  'NOT_APPLICABLE',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_STATUS_META: Record<
  RequirementStatus,
  { label: string; short: string; tone: Tone; description: string; dot: string }
> = {
  NOT_ASSESSED: {
    label: 'Not assessed',
    short: 'Not assessed',
    tone: 'neutral',
    description: 'No evidence has been evaluated against this requirement yet.',
    dot: '○',
  },
  MISSING: {
    label: 'Missing',
    short: 'Missing',
    tone: 'risk',
    description: 'No sufficient evidence exists for this requirement.',
    dot: '●',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    short: 'Needs review',
    tone: 'caution',
    description: 'Potential evidence exists but a person still needs to review it.',
    dot: '●',
  },
  PARTIALLY_SATISFIED: {
    label: 'Partially satisfied',
    short: 'Partial',
    tone: 'caution',
    description: 'Some evidence exists but gaps remain.',
    dot: '◐',
  },
  SATISFIED: {
    label: 'Satisfied',
    short: 'Satisfied',
    tone: 'strong',
    description: 'Evidence appears sufficient based on the configured criteria.',
    dot: '●',
  },
  NOT_APPLICABLE: {
    label: 'Not applicable',
    short: 'N/A',
    tone: 'muted',
    description: 'This requirement does not apply to the organization or scope.',
    dot: '—',
  },
};

export type Tone = 'strong' | 'caution' | 'risk' | 'info' | 'neutral' | 'muted';

// ---------------------------------------------------------------------------

export const EVIDENCE_STATUSES = [
  'PENDING_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
  'EXPIRED',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_STATUS_META: Record<EvidenceStatus, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: 'Pending review', tone: 'caution' },
  ACCEPTED: { label: 'Accepted', tone: 'strong' },
  REJECTED: { label: 'Rejected', tone: 'risk' },
  SUPERSEDED: { label: 'Superseded', tone: 'muted' },
  EXPIRED: { label: 'Expired', tone: 'risk' },
};

export const DOCUMENT_TYPES = [
  'policy',
  'procedure',
  'work_instruction',
  'form',
  'record',
  'training_record',
  'competency_matrix',
  'calibration_record',
  'maintenance_record',
  'management_review',
  'internal_audit',
  'supplier_evaluation',
  'risk_assessment',
  'corrective_action',
  'certificate',
  'inspection_record',
  'meeting_minutes',
  'drawing',
  'photo',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function documentTypeLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const EXTRACTION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETE',
  'PARTIAL',
  'FAILED',
  'UNSUPPORTED',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const ANALYSIS_STATUSES = ['NOT_ANALYZED', 'QUEUED', 'ANALYZING', 'COMPLETE', 'FAILED'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const REVIEW_STATES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const AI_STRENGTHS = ['STRONG', 'PARTIAL', 'WEAK'] as const;
export type AiStrength = (typeof AI_STRENGTHS)[number];

export const AI_STRENGTH_META: Record<AiStrength, { label: string; tone: Tone }> = {
  STRONG: { label: 'Strong', tone: 'strong' },
  PARTIAL: { label: 'Partial', tone: 'caution' },
  WEAK: { label: 'Weak', tone: 'risk' },
};

// ---------------------------------------------------------------------------

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_META: Record<Severity, { label: string; tone: Tone; weight: number }> = {
  CRITICAL: { label: 'Critical', tone: 'risk', weight: 10 },
  HIGH: { label: 'High', tone: 'risk', weight: 6 },
  MEDIUM: { label: 'Medium', tone: 'caution', weight: 3 },
  LOW: { label: 'Low', tone: 'info', weight: 1 },
};

export const GAP_TYPES = [
  'NO_EVIDENCE',
  'MISSING_DOCUMENT',
  'EXPIRED_DOCUMENT',
  'EXPIRING_SOON',
  'INCOMPLETE_RECORD',
  'INCONSISTENT_DATES',
  'MISSING_APPROVAL',
  'MISSING_SIGNATURE',
  'MISSING_REVISION',
  'MISSING_OWNER',
  'OUTDATED_EVIDENCE',
  'UNREVIEWED_EVIDENCE',
  'CONFLICTING_DOCUMENTS',
  'UNRESOLVED_ACTION',
  'OVERDUE_ACTION',
  'WEAK_EVIDENCE',
] as const;
export type GapType = (typeof GAP_TYPES)[number];

export const GAP_TYPE_LABELS: Record<GapType, string> = {
  NO_EVIDENCE: 'No evidence linked',
  MISSING_DOCUMENT: 'Expected document missing',
  EXPIRED_DOCUMENT: 'Expired document',
  EXPIRING_SOON: 'Document expiring soon',
  INCOMPLETE_RECORD: 'Incomplete record',
  INCONSISTENT_DATES: 'Inconsistent dates',
  MISSING_APPROVAL: 'Missing approval',
  MISSING_SIGNATURE: 'Missing signature',
  MISSING_REVISION: 'Missing revision control',
  MISSING_OWNER: 'No responsible owner',
  OUTDATED_EVIDENCE: 'Evidence appears outdated',
  UNREVIEWED_EVIDENCE: 'AI match awaiting human review',
  CONFLICTING_DOCUMENTS: 'Conflicting documents',
  UNRESOLVED_ACTION: 'Unresolved action item',
  OVERDUE_ACTION: 'Overdue action item',
  WEAK_EVIDENCE: 'Evidence appears weak',
};

export const GAP_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK', 'DISMISSED'] as const;
export type GapStatus = (typeof GAP_STATUSES)[number];

export const GAP_STATUS_META: Record<GapStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'risk' },
  IN_PROGRESS: { label: 'In progress', tone: 'caution' },
  RESOLVED: { label: 'Resolved', tone: 'strong' },
  ACCEPTED_RISK: { label: 'Accepted risk', tone: 'info' },
  DISMISSED: { label: 'Dismissed', tone: 'muted' },
};

// ---------------------------------------------------------------------------

export const ACTION_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'VERIFIED'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  BLOCKED: { label: 'Blocked', tone: 'risk' },
  COMPLETE: { label: 'Complete', tone: 'caution' },
  VERIFIED: { label: 'Verified', tone: 'strong' },
};

export const OPEN_ACTION_STATUSES: ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED'];

export const PRIORITIES = SEVERITIES;
export type Priority = Severity;

// ---------------------------------------------------------------------------

export const AUDIT_TYPES = [
  'CERTIFICATION',
  'SURVEILLANCE',
  'INTERNAL',
  'CUSTOMER',
  'REGULATORY',
  'GAP_ASSESSMENT',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  CERTIFICATION: 'Certification audit',
  SURVEILLANCE: 'Surveillance audit',
  INTERNAL: 'Internal audit',
  CUSTOMER: 'Customer audit',
  REGULATORY: 'Regulatory inspection',
  GAP_ASSESSMENT: 'Gap assessment',
};

export const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'READY', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: Tone }> = {
  PLANNING: { label: 'Planning', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  READY: { label: 'Audit ready', tone: 'strong' },
  ARCHIVED: { label: 'Archived', tone: 'muted' },
};

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_META: Record<RiskLevel, { label: string; tone: Tone }> = {
  LOW: { label: 'Low', tone: 'strong' },
  MEDIUM: { label: 'Medium', tone: 'caution' },
  HIGH: { label: 'High', tone: 'risk' },
  CRITICAL: { label: 'Critical', tone: 'risk' },
};

// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'UPCOMING_AUDIT',
  'OVERDUE_ACTION',
  'EVIDENCE_EXPIRING',
  'ACTION_ASSIGNED',
  'DOCUMENT_UPLOADED',
  'ANALYSIS_COMPLETE',
  'REQUIREMENT_CHANGED',
  'REVIEW_REQUESTED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  UPCOMING_AUDIT: 'Upcoming audit',
  OVERDUE_ACTION: 'Overdue action',
  EVIDENCE_EXPIRING: 'Evidence expiring',
  ACTION_ASSIGNED: 'Action assigned',
  DOCUMENT_UPLOADED: 'Document uploaded',
  ANALYSIS_COMPLETE: 'AI analysis complete',
  REQUIREMENT_CHANGED: 'Requirement changed',
  REVIEW_REQUESTED: 'Review requested',
};

export const BILLING_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_STATUS_META: Record<BillingStatus, { label: string; tone: Tone }> = {
  TRIALING: { label: 'Trial', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'strong' },
  PAST_DUE: { label: 'Past due', tone: 'caution' },
  CANCELED: { label: 'Canceled', tone: 'muted' },
  EXPIRED: { label: 'Expired', tone: 'risk' },
};

/** Provenance labels used everywhere a value is shown to a human. */
export const PROVENANCE = {
  AI: { label: 'AI assessment', tone: 'info' as Tone },
  HUMAN: { label: 'Human verified', tone: 'strong' as Tone },
  USER: { label: 'User supplied', tone: 'neutral' as Tone },
  SYSTEM: { label: 'System generated', tone: 'muted' as Tone },
};
export type ProvenanceKey = keyof typeof PROVENANCE;

export const IMPORTANCE_LABELS: Record<number, string> = {
  1: 'Informational',
  2: 'Low',
  3: 'Standard',
  4: 'High',
  5: 'Critical',
};

/** Standard disclaimer shown on reports and AI conclusions. */
export const AI_DISCLAIMER =
  'This report is an AI-assisted internal preparedness assessment and does not constitute certification, legal advice, compliance determination, or an audit conducted by an accredited auditor or certification body.';

export const AI_ASSESSMENT_CAVEAT =
  'AI assessment indicates that the uploaded evidence appears to address this requirement. Human verification recommended.';
