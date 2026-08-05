import 'server-only';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const SESSION_COOKIE = 'ar_session';

interface TokenPayload {
  sid: string;
  uid: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a server-side session row plus a signed, httpOnly cookie.
 *
 * The cookie carries only a session id; every request re-checks the database
 * row, so sessions can be revoked immediately (logout, suspension, role change).
 */
export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
      ip: meta?.ip?.slice(0, 64),
      userAgent: meta?.userAgent?.slice(0, 256),
    },
  });

  const jwt = await new SignJWT({ sid: session.id, uid: userId } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, `${jwt}.${raw}`, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return session;
}

export async function destroySession() {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const parsed = await parseCookie(cookie);
    if (parsed) {
      await prisma.session.updateMany({
        where: { id: parsed.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  store.delete(SESSION_COOKIE);
}

async function parseCookie(cookie: string): Promise<{ sid: string; uid: string; raw: string } | null> {
  const idx = cookie.lastIndexOf('.');
  if (idx <= 0) return null;
  const jwt = cookie.slice(0, idx);
  const raw = cookie.slice(idx + 1);
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    const sid = typeof payload.sid === 'string' ? payload.sid : null;
    const uid = typeof payload.uid === 'string' ? payload.uid : null;
    if (!sid || !uid) return null;
    return { sid, uid, raw };
  } catch {
    return null;
  }
}

export interface SessionUser {
  sessionId: string;
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  avatarSeed: string;
  activeOrgId: string | null;
}

/** Returns the authenticated user, or null. Safe to call from any server code. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const parsed = await parseCookie(cookie);
  if (!parsed) return null;

  const session = await prisma.session.findUnique({
    where: { id: parsed.sid },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.userId !== parsed.uid ||
    session.user.isSuspended
  ) {
    return null;
  }

  // Constant-time comparison of the opaque half of the cookie.
  const expected = Buffer.from(session.tokenHash);
  const provided = Buffer.from(hashToken(parsed.raw));
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  return {
    sessionId: session.id,
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    jobTitle: session.user.jobTitle,
    avatarSeed: session.user.avatarSeed,
    activeOrgId: session.activeOrgId,
  };
}

export async function setActiveOrg(sessionId: string, orgId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { activeOrgId: orgId } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined,
    userAgent: h.get('user-agent') ?? undefined,
  };
}
