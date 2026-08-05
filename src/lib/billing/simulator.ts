import 'server-only';

import { getPlan } from './plans';
import type { BillingProvider, CheckoutResult } from './types';

/**
 * Development billing simulator.
 *
 * Applies plan changes immediately with no payment step. It never claims a
 * payment was taken — every response says plainly that this is a simulation, so
 * a development environment can never be mistaken for a live one.
 */
export class SimulatorBillingProvider implements BillingProvider {
  readonly name = 'simulator';
  readonly live = false;

  async startCheckout(params: { orgId: string; planKey: string }): Promise<CheckoutResult> {
    const plan = getPlan(params.planKey);
    const now = new Date();
    return {
      applied: true,
      message: `Simulated: ${plan.name} is now active for this organization. No payment was taken — configure STRIPE_SECRET_KEY to process real subscriptions.`,
      state: {
        planKey: plan.key,
        status: 'ACTIVE',
        provider: this.name,
        providerCustomerId: `sim_cus_${params.orgId.slice(0, 12)}`,
        providerSubscriptionId: `sim_sub_${params.orgId.slice(0, 12)}_${plan.key}`,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        cancelAtPeriodEnd: false,
      },
    };
  }

  async cancel(params: { orgId: string }): Promise<CheckoutResult> {
    return {
      applied: true,
      message: 'Simulated: the subscription will end at the close of the current period.',
      state: {
        planKey: 'trial',
        status: 'ACTIVE',
        provider: this.name,
        providerSubscriptionId: `sim_sub_${params.orgId.slice(0, 12)}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        cancelAtPeriodEnd: true,
      },
    };
  }

  async resume(params: { orgId: string }): Promise<CheckoutResult> {
    return {
      applied: true,
      message: 'Simulated: the subscription will renew as normal.',
      state: {
        planKey: 'trial',
        status: 'ACTIVE',
        provider: this.name,
        providerSubscriptionId: `sim_sub_${params.orgId.slice(0, 12)}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        cancelAtPeriodEnd: false,
      },
    };
  }

  async portalUrl(): Promise<string | null> {
    return null;
  }
}
