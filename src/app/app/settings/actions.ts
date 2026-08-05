'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { assignableRoles, isRole } from '@/lib/auth/rbac';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit-log';
import { assertWithinLimit, billing, applySubscriptionState, getSubscription } from '@/lib/billing';
import { getPlan, PLANS } from '@/lib/billing/plans';
import { env } from '@/lib/env';
import { notify } from '@/lib/notifications';
import { ORG_KINDS } from '@/lib/enums';
import { toFormError } from '@/lib/errors';

export interface SettingsState {
  error?: string;
  success?: string;
}

/* -------------------------------------------------------------- organization */

const orgSchema = z.object({
  name: z.string().trim().min(2, 'Enter an organization name.').max(120),
  industry: z.string().trim().max(80).optional(),
  sizeBand: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  kind: z.enum(ORG_KINDS),
});

export async function updateOrganizationAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'org:manage');

    const parsed = orgSchema.safeParse({
      name: formData.get('name'),
      industry: formData.get('industry') || undefined,
      sizeBand: formData.get('sizeBand') || undefined,
      country: formData.get('country') || undefined,
      kind: formData.get('kind') || 'STANDARD',
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

    await prisma.organization.update({
      where: { id: tenant.orgId },
      data: parsed.data,
    });

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'org.updated',
      entityType: 'Organization',
      entityId: tenant.orgId,
      metadata: { name: parsed.data.name },
    });

    revalidatePath('/app', 'layout');
    return { success: 'Organization updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function addDepartmentAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'org:manage');

  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (!name) return;

  await prisma.department.upsert({
    where: { orgId_name: { orgId: tenant.orgId, name } },
    create: { orgId: tenant.orgId, name },
    update: {},
  });

  revalidatePath('/app', 'layout');
}

export async function removeDepartmentAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'org:manage');

  const id = String(formData.get('departmentId') ?? '');
  await prisma.department.deleteMany({ where: { id, orgId: tenant.orgId } });

  revalidatePath('/app', 'layout');
}

/* ------------------------------------------------------------------ members */

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  name: z.string().trim().min(2, 'Enter their name.').max(80),
  role: z.string(),
  temporaryPassword: z.string().min(1, 'Set a temporary password.'),
});

/**
 * Adds a member.
 *
 * With no email provider configured by default, a token-link invitation would
 * silently go nowhere. Instead an admin creates the account with a temporary
 * password they hand over, which is honest about what actually happens and
 * works in every deployment.
 */
export async function addMemberAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'members:manage');
    await assertWithinLimit(tenant.orgId, 'members');

    const parsed = inviteSchema.safeParse({
      email: formData.get('email'),
      name: formData.get('name'),
      role: formData.get('role') || 'CONTRIBUTOR',
      temporaryPassword: formData.get('temporaryPassword'),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

    if (!isRole(parsed.data.role) || !assignableRoles(tenant.role).includes(parsed.data.role)) {
      return { error: 'You cannot assign that role.' };
    }

    const strength = checkPasswordStrength(parsed.data.temporaryPassword);
    if (!strength.ok) return { error: `Temporary password: ${strength.problems.join(' ')}` };

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });

    if (existing) {
      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existing.id, orgId: tenant.orgId } },
      });
      if (membership) return { error: 'That person is already a member of this organization.' };

      await prisma.membership.create({
        data: { userId: existing.id, orgId: tenant.orgId, role: parsed.data.role, status: 'ACTIVE' },
      });

      await notify({
        orgId: tenant.orgId,
        userId: existing.id,
        type: 'REVIEW_REQUESTED',
        title: `You were added to ${tenant.org.name}`,
        body: `${tenant.user.name} added you as a ${parsed.data.role.toLowerCase()}.`,
        link: '/app/dashboard',
        alsoEmail: true,
      });

      await recordAudit({
        orgId: tenant.orgId,
        userId: tenant.user.id,
        action: 'member.invited',
        entityType: 'User',
        entityId: existing.id,
        metadata: { email: parsed.data.email, role: parsed.data.role, existingAccount: true },
      });

      revalidatePath('/app', 'layout');
      return {
        success: `${existing.name} already had an AuditReady account and has been added to ${tenant.org.name}. They can sign in with their existing password.`,
      };
    }

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.temporaryPassword),
        avatarSeed: parsed.data.email,
        memberships: { create: { orgId: tenant.orgId, role: parsed.data.role, status: 'ACTIVE' } },
      },
    });

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'member.invited',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: parsed.data.email, role: parsed.data.role, existingAccount: false },
    });

    revalidatePath('/app', 'layout');
    return {
      success: `${user.name} can now sign in at ${env.appUrl}/login with the temporary password you set. Ask them to change it in Settings → Your account.`,
    };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function changeMemberRoleAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'members:manage');

  const membershipId = String(formData.get('membershipId') ?? '');
  const role = String(formData.get('role') ?? '');

  if (!isRole(role) || !assignableRoles(tenant.role).includes(role)) {
    throw new Error('You cannot assign that role.');
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: tenant.orgId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new Error('That member could not be found.');

  // The last owner must remain an owner, or the org becomes unmanageable.
  if (membership.role === 'OWNER' && role !== 'OWNER') {
    const owners = await prisma.membership.count({
      where: { orgId: tenant.orgId, role: 'OWNER', status: 'ACTIVE' },
    });
    if (owners <= 1) throw new Error('An organization must always have at least one owner.');
  }

  await prisma.membership.update({ where: { id: membership.id }, data: { role } });

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'member.role_changed',
    entityType: 'Membership',
    entityId: membership.id,
    metadata: { member: membership.user.name, from: membership.role, to: role },
  });

  revalidatePath('/app', 'layout');
}

export async function removeMemberAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'members:manage');

  const membershipId = String(formData.get('membershipId') ?? '');
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: tenant.orgId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new Error('That member could not be found.');

  if (membership.userId === tenant.user.id) {
    throw new Error('You cannot remove yourself. Ask another owner or admin.');
  }
  if (membership.role === 'OWNER') {
    const owners = await prisma.membership.count({
      where: { orgId: tenant.orgId, role: 'OWNER', status: 'ACTIVE' },
    });
    if (owners <= 1) throw new Error('An organization must always have at least one owner.');
  }

  await prisma.membership.delete({ where: { id: membership.id } });

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'member.removed',
    entityType: 'Membership',
    entityId: membership.id,
    metadata: { member: membership.user.name },
  });

  revalidatePath('/app', 'layout');
}

/* ----------------------------------------------------------------- account */

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(1, 'Choose a new password.'),
});

export async function changePasswordAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  try {
    const tenant = await requireTenantStrict();

    const parsed = passwordSchema.safeParse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

    const user = await prisma.user.findUnique({ where: { id: tenant.user.id } });
    if (!user) return { error: 'Your account could not be found.' };

    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return { error: 'Your current password is not correct.' };
    }

    const strength = checkPasswordStrength(parsed.data.newPassword);
    if (!strength.ok) return { error: strength.problems.join(' ') };

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });

    // Other sessions are revoked so a stolen session cannot outlive the change.
    await revokeAllSessions(user.id, tenant.user.sessionId);

    await recordAudit({
      orgId: tenant.orgId,
      userId: user.id,
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: 'Password changed. Any other sessions have been signed out.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  try {
    const tenant = await requireTenantStrict();
    const name = String(formData.get('name') ?? '').trim().slice(0, 80);
    const jobTitle = String(formData.get('jobTitle') ?? '').trim().slice(0, 80);
    if (name.length < 2) return { error: 'Enter your name.' };

    await prisma.user.update({
      where: { id: tenant.user.id },
      data: { name, jobTitle: jobTitle || null },
    });

    revalidatePath('/app', 'layout');
    return { success: 'Profile updated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/* ----------------------------------------------------------------- billing */

export async function changePlanAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'billing:manage');

  const planKey = String(formData.get('planKey') ?? '');
  const plan = PLANS.find((p) => p.key === planKey && !p.comingSoon);
  if (!plan) throw new Error('That plan is not available.');

  const result = await billing().startCheckout({
    orgId: tenant.orgId,
    orgName: tenant.org.name,
    planKey: plan.key,
    email: tenant.user.email,
    successUrl: `${env.appUrl}/app/settings/billing?changed=1`,
    cancelUrl: `${env.appUrl}/app/settings/billing`,
  });

  if (result.applied && result.state) {
    await applySubscriptionState(tenant.orgId, { ...result.state, planKey: plan.key });
    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'billing.plan_changed',
      entityType: 'Subscription',
      entityId: tenant.orgId,
      metadata: { plan: plan.key, provider: billing().name, simulated: !billing().live },
    });
  }

  revalidatePath('/app', 'layout');
  if (result.redirectUrl) redirect(result.redirectUrl);
  redirect('/app/settings/billing?changed=1');
}

export async function cancelPlanAction() {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'billing:manage');

  const subscription = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
  const result = await billing().cancel({
    orgId: tenant.orgId,
    providerSubscriptionId: subscription?.providerSubscriptionId,
  });

  if (result.applied) {
    await prisma.subscription.updateMany({
      where: { orgId: tenant.orgId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'billing.canceled',
    entityType: 'Subscription',
    entityId: tenant.orgId,
    metadata: { provider: billing().name },
  });

  revalidatePath('/app', 'layout');
  redirect('/app/settings/billing?canceled=1');
}

export async function resumePlanAction() {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'billing:manage');

  const subscription = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
  const result = await billing().resume({
    orgId: tenant.orgId,
    providerSubscriptionId: subscription?.providerSubscriptionId,
  });

  if (result.applied) {
    await prisma.subscription.updateMany({
      where: { orgId: tenant.orgId },
      data: { cancelAtPeriodEnd: false },
    });
  }

  revalidatePath('/app', 'layout');
  redirect('/app/settings/billing');
}

/** Ensures the plan catalogue is reachable from the settings page. */
export async function currentPlanSummary(orgId: string) {
  const subscription = await getSubscription(orgId);
  return { subscription, plan: getPlan(subscription.planKey) };
}
