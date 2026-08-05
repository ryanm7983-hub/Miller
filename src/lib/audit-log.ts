import 'server-only';

import { prisma } from '@/lib/db';
import { stringifyJson } from '@/lib/json';
import { requestMeta } from '@/lib/auth/session';

/**
 * Append-only trail for sensitive operations: authentication, membership and
 * role changes, evidence access/download, AI overrides, billing and exports.
 */
export type AuditAction =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'org.created'
  | 'org.updated'
  | 'org.switched'
  | 'member.invited'
  | 'member.role_changed'
  | 'member.removed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'evidence.uploaded'
  | 'evidence.downloaded'
  | 'evidence.updated'
  | 'evidence.deleted'
  | 'evidence.link_reviewed'
  | 'requirement.status_overridden'
  | 'ai.analysis_run'
  | 'ai.assessment_overridden'
  | 'gap.status_changed'
  | 'action.created'
  | 'action.updated'
  | 'report.generated'
  | 'report.exported'
  | 'billing.plan_changed'
  | 'billing.canceled';

export async function recordAudit(input: {
  orgId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const meta = await requestMeta();
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 256),
        metadata: stringifyJson(input.metadata ?? {}),
      },
    });
  } catch (error) {
    // Never let audit logging break the user-visible operation, but make the
    // failure loud in server logs.
    console.error('[audit-log] failed to record', input.action, error);
  }
}
