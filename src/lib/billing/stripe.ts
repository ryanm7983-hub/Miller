import 'server-only';

import { env } from '@/lib/env';
import { getPlan } from './plans';
import type { BillingProvider, CheckoutResult } from './types';

/**
 * Stripe billing provider.
 *
 * Implemented against the Stripe REST API over `fetch` so the application has
 * no hard SDK dependency. Requires STRIPE_SECRET_KEY plus a price id per plan
 * (see `stripePriceIdEnv` in plans.ts). Webhooks are handled by
 * `/api/billing/webhook`, which is the authority on subscription state — this
 * class only initiates changes.
 */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  readonly live = true;
  private key: string;

  constructor() {
    if (!env.stripeSecretKey) {
      throw new Error('BILLING_PROVIDER=stripe requires STRIPE_SECRET_KEY.');
    }
    this.key = env.stripeSecretKey;
  }

  private async request<T>(path: string, body?: Record<string, string>): Promise<T> {
    const response = await fetch(`https://api.stripe.com/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body: body ? new URLSearchParams(body).toString() : undefined,
    });

    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Stripe request failed (${response.status})`);
    }
    return payload as T;
  }

  private priceId(planKey: string): string {
    const plan = getPlan(planKey);
    const envKey = plan.stripePriceIdEnv;
    const priceId = envKey ? process.env[envKey] : undefined;
    if (!priceId) {
      throw new Error(
        `No Stripe price configured for the ${plan.name} plan. Set ${envKey ?? 'the price id'} in your environment.`
      );
    }
    return priceId;
  }

  async startCheckout(params: {
    orgId: string;
    orgName: string;
    planKey: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult> {
    const plan = getPlan(params.planKey);
    const session = await this.request<{ url: string }>('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': this.priceId(params.planKey),
      'line_items[0][quantity]': '1',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.email,
      client_reference_id: params.orgId,
      'metadata[orgId]': params.orgId,
      'metadata[planKey]': plan.key,
      'subscription_data[metadata][orgId]': params.orgId,
      'subscription_data[metadata][planKey]': plan.key,
      allow_promotion_codes: 'true',
    });

    return {
      applied: false,
      redirectUrl: session.url,
      message: `Redirecting to Stripe to start the ${plan.name} plan.`,
    };
  }

  async cancel(params: { providerSubscriptionId?: string | null }): Promise<CheckoutResult> {
    if (!params.providerSubscriptionId) {
      throw new Error('No Stripe subscription is associated with this organization.');
    }
    await this.request(`/subscriptions/${params.providerSubscriptionId}`, {
      cancel_at_period_end: 'true',
    });
    return {
      applied: false,
      message: 'Your subscription will end when the current period closes. Stripe will confirm shortly.',
    };
  }

  async resume(params: { providerSubscriptionId?: string | null }): Promise<CheckoutResult> {
    if (!params.providerSubscriptionId) {
      throw new Error('No Stripe subscription is associated with this organization.');
    }
    await this.request(`/subscriptions/${params.providerSubscriptionId}`, {
      cancel_at_period_end: 'false',
    });
    return { applied: false, message: 'Your subscription will renew as normal.' };
  }

  async portalUrl(params: { providerCustomerId?: string | null; returnUrl: string }): Promise<string | null> {
    if (!params.providerCustomerId) return null;
    const session = await this.request<{ url: string }>('/billing_portal/sessions', {
      customer: params.providerCustomerId,
      return_url: params.returnUrl,
    });
    return session.url;
  }
}
