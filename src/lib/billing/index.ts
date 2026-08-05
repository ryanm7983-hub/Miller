import 'server-only';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getPlan, type Plan, type PlanLimits } from './plans';
import type { BillingProvider, CheckoutResult, SubscriptionState } from './types';
import { SimulatorBillingProvider } from './simulator';
import { StripeBillingProvider } from './stripe';

export * from './plans';
export type { BillingProvider, CheckoutResult, SubscriptionState } from './types';

let providerInstance: BillingProvider | null = null;

export function billing(): BillingProvider {
  if (providerInstance) return providerInstance;
  if (env.billingProvider === 'stripe') {
    try {
      providerInstance = new StripeBillingProvider();
      return providerInstance;
    } catch (error) {
      console.error('[billing] Stripe unavailable, using the development simulator:', (error as Error).message);
    }
  }
  providerInstance = new SimulatorBillingProvider();
  return providerInstance;
}

export interface OrgSubscription {
  planKey: string;
  plan: Plan;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
  isActive: boolean;
  daysLeftInTrial: number | null;
}

/** Reads the org's subscription, creating a trial on first access. */
export async function getSubscription(orgId: string): Promise<OrgSubscription> {
  let record = await prisma.subscription.findUnique({ where: { orgId } });

  if (!record) {
    const trial = getPlan('trial');
    record = await prisma.subscription.create({
      data: {
        orgId,
        planKey: 'trial',
        status: 'TRIALING',
        provider: billing().name,
        trialEndsAt: new Date(Date.now() + trial.trialDays * 86_400_000),
      },
    });
  }

  const plan = getPlan(record.planKey);
  const now = new Date();
  const trialExpired = record.status === 'TRIALING' && !!record.trialEndsAt && record.trialEndsAt < now;

  if (trialExpired) {
    record = await prisma.subscription.update({
      where: { orgId },
      data: { status: 'EXPIRED' },
    });
  }

  const isActive = record.status === 'ACTIVE' || record.status === 'TRIALING' || record.status === 'PAST_DUE';

  return {
    planKey: record.planKey,
    plan,
    status: record.status,
    trialEndsAt: record.trialEndsAt,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    provider: record.provider,
    isActive,
    daysLeftInTrial:
      record.status === 'TRIALING' && record.trialEndsAt
        ? Math.max(0, Math.ceil((record.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
        : null,
  };
}

export interface UsageSnapshot {
  auditProjects: number;
  members: number;
  evidenceItems: number;
  storageMb: number;
}

export async function getUsage(orgId: string): Promise<UsageSnapshot> {
  const [auditProjects, members, evidence] = await Promise.all([
    prisma.auditProject.count({ where: { orgId, status: { not: 'ARCHIVED' } } }),
    prisma.membership.count({ where: { orgId, status: 'ACTIVE' } }),
    prisma.evidence.aggregate({ where: { orgId }, _count: true, _sum: { sizeBytes: true } }),
  ]);

  return {
    auditProjects,
    members,
    evidenceItems: evidence._count,
    storageMb: Math.round((evidence._sum.sizeBytes ?? 0) / 1024 / 1024),
  };
}

export class PlanLimitError extends Error {
  constructor(
    message: string,
    readonly limitKey: keyof PlanLimits
  ) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

/**
 * Enforces a plan limit before a create operation. Throws `PlanLimitError`,
 * which server actions surface as an upgrade prompt rather than a crash.
 */
export async function assertWithinLimit(
  orgId: string,
  limitKey: 'auditProjects' | 'members' | 'evidenceItems'
): Promise<void> {
  const [subscription, usage] = await Promise.all([getSubscription(orgId), getUsage(orgId)]);
  const limit = subscription.plan.limits[limitKey];
  if (limit === -1) return;

  if (!subscription.isActive) {
    throw new PlanLimitError(
      `Your ${subscription.plan.name.toLowerCase()} has ended. Choose a plan in Settings → Billing to continue adding data.`,
      limitKey
    );
  }

  if (usage[limitKey] >= limit) {
    const labels: Record<typeof limitKey, string> = {
      auditProjects: 'audit projects',
      members: 'team members',
      evidenceItems: 'evidence documents',
    };
    throw new PlanLimitError(
      `Your ${subscription.plan.name} plan includes ${limit} ${labels[limitKey]}. Upgrade in Settings → Billing to add more.`,
      limitKey
    );
  }
}

export async function hasFeature(orgId: string, feature: keyof PlanLimits): Promise<boolean> {
  const subscription = await getSubscription(orgId);
  if (!subscription.isActive) return false;
  return subscription.plan.limits[feature] === true;
}

export async function applySubscriptionState(orgId: string, state: SubscriptionState) {
  await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      planKey: state.planKey,
      status: state.status,
      provider: state.provider,
      providerCustomerId: state.providerCustomerId,
      providerSubscriptionId: state.providerSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd,
      trialEndsAt: state.trialEndsAt,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
    },
    update: {
      planKey: state.planKey,
      status: state.status,
      provider: state.provider,
      providerCustomerId: state.providerCustomerId,
      providerSubscriptionId: state.providerSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd,
      trialEndsAt: state.trialEndsAt,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
    },
  });
}

export type { CheckoutResult as BillingCheckoutResult };
