import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { applySubscriptionState } from '@/lib/billing';
import { getPlan } from '@/lib/billing/plans';
import { recordAudit } from '@/lib/audit-log';

export const runtime = 'nodejs';

/**
 * Stripe webhook — the authority on subscription state.
 *
 * Signature verification is implemented directly so no Stripe SDK is required.
 * Requests without a valid signature are rejected before anything is read, and
 * the org id is taken from the event metadata (which only Stripe can set),
 * never from the request body's untrusted fields.
 */
export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return NextResponse.json({ error: 'Webhooks are not configured.' }, { status: 501 });
  }

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature || !verifySignature(body, signature, env.stripeWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const orgId = metadata.orgId ?? (object.client_reference_id as string | undefined);

  if (!orgId) {
    // Nothing to reconcile; acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, note: 'No orgId in metadata.' });
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ received: true, note: 'Unknown organization.' });

  const planKey = metadata.planKey && getPlan(metadata.planKey).key === metadata.planKey ? metadata.planKey : undefined;

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const status = mapStatus(String(object.status ?? 'active'));
      await applySubscriptionState(orgId, {
        planKey: planKey ?? (await currentPlanKey(orgId)),
        status,
        provider: 'stripe',
        providerCustomerId: (object.customer as string) ?? null,
        providerSubscriptionId: (object.subscription as string) ?? (object.id as string) ?? null,
        currentPeriodEnd: object.current_period_end
          ? new Date(Number(object.current_period_end) * 1000)
          : null,
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
      });
      await recordAudit({
        orgId,
        action: 'billing.plan_changed',
        entityType: 'Subscription',
        entityId: orgId,
        metadata: { event: event.type, status },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      await applySubscriptionState(orgId, {
        planKey: 'trial',
        status: 'CANCELED',
        provider: 'stripe',
        providerCustomerId: (object.customer as string) ?? null,
        providerSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      await recordAudit({
        orgId,
        action: 'billing.canceled',
        entityType: 'Subscription',
        entityId: orgId,
        metadata: { event: event.type },
      });
      break;
    }

    case 'invoice.payment_failed': {
      await prisma.subscription.updateMany({ where: { orgId }, data: { status: 'PAST_DUE' } });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function currentPlanKey(orgId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({ where: { orgId }, select: { planKey: true } });
  return subscription?.planKey ?? 'trial';
}

function mapStatus(stripeStatus: string): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' {
  switch (stripeStatus) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete_expired':
      return 'EXPIRED';
    default:
      return 'ACTIVE';
  }
}

/** Stripe's `t=…,v1=…` scheme with a constant-time digest comparison. */
function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key.trim(), rest.join('=')];
    })
  );

  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided) return false;

  // Reject anything older than five minutes to blunt replay attempts.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
