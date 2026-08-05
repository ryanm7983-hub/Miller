import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { getSessionUser, setActiveOrg, type SessionUser } from '@/lib/auth/session';
import { can, isRole, type Permission } from '@/lib/auth/rbac';
import type { Role } from '@/lib/enums';

/**
 * Tenant isolation.
 *
 * Every server component, action and route handler that touches tenant data
 * goes through `requireTenant()`. The returned `orgId` is the ONLY organization
 * id that may be used in a query — request payloads never supply one directly,
 * and helpers such as `scoped()` bake the constraint into the `where` clause so
 * a forgotten filter is impossible to ship silently.
 */

export interface TenantContext {
  user: SessionUser;
  orgId: string;
  org: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    logoColor: string;
  };
  role: Role;
  /** True when access is granted through a consultancy engagement. */
  viaEngagement: boolean;
  memberships: Array<{ orgId: string; name: string; slug: string; role: Role; kind: string; logoColor: string }>;
}

export class TenantAccessError extends Error {
  constructor(message = 'You do not have access to this organization.') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'PermissionError';
  }
}

/** All organizations the user may act in — direct memberships first. */
export const listAccessibleOrgs = cache(async (userId: string) => {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { org: true },
    orderBy: { createdAt: 'asc' },
  });

  const direct = memberships.map((m) => ({
    orgId: m.orgId,
    name: m.org.name,
    slug: m.org.slug,
    role: (isRole(m.role) ? m.role : 'VIEWER') as Role,
    kind: m.org.kind,
    logoColor: m.org.logoColor,
    viaEngagement: false,
  }));

  // Consultant mode: members of a consultancy inherit access to engaged clients.
  const consultancyIds = memberships.filter((m) => m.org.kind === 'CONSULTANCY').map((m) => m.orgId);
  if (consultancyIds.length === 0) return direct;

  const engagements = await prisma.clientEngagement.findMany({
    where: { consultancyOrgId: { in: consultancyIds }, status: 'ACTIVE' },
    include: { client: true },
  });

  const seen = new Set(direct.map((d) => d.orgId));
  const inherited = engagements
    .filter((e) => !seen.has(e.clientOrgId))
    .map((e) => ({
      orgId: e.clientOrgId,
      name: e.client.name,
      slug: e.client.slug,
      role: (isRole(e.grantedRole) ? e.grantedRole : 'CONSULTANT') as Role,
      kind: e.client.kind,
      logoColor: e.client.logoColor,
      viaEngagement: true,
    }));

  return [...direct, ...inherited];
});

export const getTenant = cache(async (): Promise<TenantContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const orgs = await listAccessibleOrgs(user.id);
  if (orgs.length === 0) return null;

  let active = orgs.find((o) => o.orgId === user.activeOrgId);
  if (!active) {
    active = orgs[0];
    // Persist the resolved org so subsequent requests are stable.
    await setActiveOrg(user.sessionId, active.orgId);
  }

  return {
    user,
    orgId: active.orgId,
    org: {
      id: active.orgId,
      name: active.name,
      slug: active.slug,
      kind: active.kind,
      logoColor: active.logoColor,
    },
    role: active.role,
    viaEngagement: active.viaEngagement,
    memberships: orgs.map(({ orgId, name, slug, role, kind, logoColor }) => ({
      orgId,
      name,
      slug,
      role,
      kind,
      logoColor,
    })),
  };
});

/** Redirects to login/onboarding when there is no usable tenant context. */
export async function requireTenant(): Promise<TenantContext> {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();
  if (!tenant) redirect('/onboarding');
  return tenant;
}

/** Throws rather than redirecting — for server actions and route handlers. */
export async function requireTenantStrict(): Promise<TenantContext> {
  const tenant = await getTenant();
  if (!tenant) throw new TenantAccessError('You must be signed in to an organization.');
  return tenant;
}

export function requirePermission(tenant: TenantContext, permission: Permission): void {
  if (!can(tenant.role, permission)) {
    throw new PermissionError(
      `Your role (${tenant.role.toLowerCase()}) cannot perform this action. Ask an organization admin for access.`
    );
  }
}

/**
 * Merges a tenant constraint into a Prisma `where` clause.
 *
 * Usage: `prisma.evidence.findMany({ where: scoped(tenant, { status: 'ACCEPTED' }) })`
 */
export function scoped<T extends Record<string, unknown>>(
  tenant: TenantContext,
  where?: T
): T & { orgId: string } {
  return { ...(where ?? ({} as T)), orgId: tenant.orgId };
}

/**
 * Verifies an explicit org id supplied by a caller belongs to the active
 * tenant. Used where an id must round-trip through the client.
 */
export function assertSameOrg(tenant: TenantContext, orgId: string | null | undefined): void {
  if (!orgId || orgId !== tenant.orgId) throw new TenantAccessError();
}
