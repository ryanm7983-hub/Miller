import type { Role } from '@/lib/enums';

/**
 * Permission catalogue.
 *
 * Every mutating server action resolves a permission through `can()`. Roles are
 * additive sets rather than a numeric hierarchy so a future consultant/client
 * role can be granted an arbitrary slice of capabilities.
 */
export const PERMISSIONS = [
  'org:read',
  'org:manage',
  'billing:manage',
  'members:manage',
  'project:create',
  'project:edit',
  'project:delete',
  'requirement:edit',
  'evidence:upload',
  'evidence:edit',
  'evidence:delete',
  'evidence:review',
  'gap:manage',
  'action:create',
  'action:edit',
  'action:verify',
  'action:complete_assigned',
  'comment:create',
  'ai:run',
  'report:generate',
  'simulator:use',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ['org:read'];

const CONTRIBUTOR: Permission[] = [
  ...VIEWER,
  'evidence:upload',
  'evidence:edit',
  'comment:create',
  'action:complete_assigned',
  'ai:run',
];

const MANAGER: Permission[] = [
  ...CONTRIBUTOR,
  'project:create',
  'project:edit',
  'requirement:edit',
  'evidence:review',
  'evidence:delete',
  'gap:manage',
  'action:create',
  'action:edit',
  'action:verify',
  'report:generate',
  'simulator:use',
];

const ADMIN: Permission[] = [...MANAGER, 'members:manage', 'org:manage', 'project:delete'];

const OWNER: Permission[] = [...ADMIN, 'billing:manage'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VIEWER,
  CONTRIBUTOR,
  MANAGER,
  // A consultant working an engagement gets manager-level operational access
  // but never billing or member administration inside the client org.
  CONSULTANT: MANAGER,
  ADMIN,
  OWNER,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isRole(value: string): value is Role {
  return value in ROLE_PERMISSIONS;
}

/** Roles a member with `actorRole` is allowed to assign to somebody else. */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === 'OWNER') return ['OWNER', 'ADMIN', 'MANAGER', 'CONTRIBUTOR', 'VIEWER'];
  if (actorRole === 'ADMIN') return ['MANAGER', 'CONTRIBUTOR', 'VIEWER'];
  return [];
}
