'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/auth/password';
import { createSession, destroySession, getSessionUser, requestMeta, setActiveOrg } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit-log';
import { consume, LIMITS } from '@/lib/rate-limit';
import { listAccessibleOrgs } from '@/lib/tenant';

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter your email address.')
  .max(200)
  .email('That does not look like a valid email address.');

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80),
  email: emailSchema,
  password: z.string().min(1, 'Choose a password.').max(200),
  jobTitle: z.string().trim().max(80).optional(),
});

function firstError(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const meta = await requestMeta();
  const limit = consume(`signup:${meta.ip ?? 'unknown'}`, LIMITS.signup.limit, LIMITS.signup.windowMs);
  if (!limit.ok) {
    return { error: `Too many sign-up attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    jobTitle: formData.get('jobTitle') || undefined,
  });

  if (!parsed.success) return { fieldErrors: firstError(parsed.error) };

  const strength = checkPasswordStrength(parsed.data.password);
  if (!strength.ok) {
    return { fieldErrors: { password: strength.problems.join(' ') } };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return {
      fieldErrors: {
        email: 'An account already exists with that email. Sign in instead, or use a different address.',
      },
    };
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      jobTitle: parsed.data.jobTitle,
      passwordHash: await hashPassword(parsed.data.password),
      avatarSeed: parsed.data.email,
    },
  });

  await createSession(user.id, meta);
  await recordAudit({ userId: user.id, action: 'auth.signup', entityType: 'User', entityId: user.id });

  redirect('/onboarding');
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const meta = await requestMeta();
  const emailRaw = String(formData.get('email') ?? '').trim().toLowerCase();

  // Rate-limit by IP and by account so neither vector is left open.
  const ipLimit = consume(`login:ip:${meta.ip ?? 'unknown'}`, LIMITS.login.limit * 3, LIMITS.login.windowMs);
  const accountLimit = consume(`login:acct:${emailRaw}`, LIMITS.login.limit, LIMITS.login.windowMs);
  if (!ipLimit.ok || !accountLimit.ok) {
    const wait = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return { error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` };
  }

  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, 'Enter your password.') })
    .safeParse({ email: emailRaw, password: formData.get('password') });

  if (!parsed.success) return { fieldErrors: firstError(parsed.error) };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always run a hash comparison so timing does not reveal whether the
  // account exists.
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidix');

  if (!user || !valid || user.isSuspended) {
    await recordAudit({
      userId: user?.id,
      action: 'auth.login_failed',
      entityType: 'User',
      metadata: { email: parsed.data.email, reason: user ? (user.isSuspended ? 'suspended' : 'bad_password') : 'no_account' },
    });
    return { error: 'That email and password combination is not recognised.' };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id, meta);
  await recordAudit({ userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id });

  const orgs = await listAccessibleOrgs(user.id);
  if (orgs.length === 0) redirect('/onboarding');

  await setActiveOrg(session.id, orgs[0].orgId);
  redirect('/app/dashboard');
}

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) {
    await recordAudit({ userId: user.id, action: 'auth.logout', entityType: 'User', entityId: user.id });
  }
  await destroySession();
  redirect('/login');
}
