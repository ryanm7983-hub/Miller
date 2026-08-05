import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getTenant } from '@/lib/tenant';
import { storage } from '@/lib/storage';
import { recordAudit } from '@/lib/audit-log';
import { consume, LIMITS } from '@/lib/rate-limit';

/**
 * Authenticated evidence download.
 *
 * Uploaded documents are never served from a public path. Every request is
 * authenticated, scoped to the caller's active organization, rate limited and
 * written to the audit log. With an S3-style backend the response is a redirect
 * to a short-lived presigned URL; with local storage the bytes are proxied.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limit = consume(`download:${tenant.user.id}`, LIMITS.download.limit, LIMITS.download.windowMs);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many downloads. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await context.params;

  // The org constraint is what enforces tenant isolation — a valid id from
  // another organization simply does not match.
  const evidence = await prisma.evidence.findFirst({
    where: { id, orgId: tenant.orgId },
    select: { id: true, filename: true, mimeType: true, storageKey: true, sizeBytes: true },
  });

  if (!evidence) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'evidence.downloaded',
    entityType: 'Evidence',
    entityId: evidence.id,
    metadata: { filename: evidence.filename },
  });

  const inline = new URL(request.url).searchParams.get('inline') === '1';
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="${evidence.filename.replace(/"/g, '')}"`;

  try {
    const signed = await storage().signedUrl(evidence.storageKey, 300);
    if (signed) return NextResponse.redirect(signed, 302);

    const buffer = await storage().get(evidence.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': evidence.mimeType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[download] failed', evidence.id, error);
    return NextResponse.json({ error: 'The stored file could not be read.' }, { status: 500 });
  }
}
