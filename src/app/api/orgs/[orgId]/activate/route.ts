import { NextResponse } from 'next/server';

import { getSessionUser, setActiveOrg } from '@/lib/auth/session';
import { listAccessibleOrgs } from '@/lib/tenant';
import { recordAudit } from '@/lib/audit-log';
import { env } from '@/lib/env';

/**
 * Switches the active organization for the current session.
 *
 * The requested org must appear in the caller's own accessible list — a
 * fabricated id in the URL cannot grant access to another tenant.
 */
export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL('/login', env.appUrl), 303);

  const { orgId } = await context.params;
  const orgs = await listAccessibleOrgs(user.id);
  const target = orgs.find((o) => o.orgId === orgId);

  if (!target) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url), 303);
  }

  await setActiveOrg(user.sessionId, target.orgId);
  await recordAudit({
    orgId: target.orgId,
    userId: user.id,
    action: 'org.switched',
    entityType: 'Organization',
    entityId: target.orgId,
  });

  return NextResponse.redirect(new URL('/app/dashboard', request.url), 303);
}
