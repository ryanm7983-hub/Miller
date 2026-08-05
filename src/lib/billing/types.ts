export interface SubscriptionState {
  planKey: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export interface CheckoutResult {
  /** When present, redirect the browser here to complete payment. */
  redirectUrl?: string;
  /** When true, the change was applied immediately (development simulator). */
  applied: boolean;
  state?: SubscriptionState;
  message: string;
}

export interface BillingProvider {
  readonly name: string;
  /** True when real money can move. */
  readonly live: boolean;
  startCheckout(params: {
    orgId: string;
    orgName: string;
    planKey: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult>;
  cancel(params: { orgId: string; providerSubscriptionId?: string | null }): Promise<CheckoutResult>;
  resume(params: { orgId: string; providerSubscriptionId?: string | null }): Promise<CheckoutResult>;
  /** Portal for updating payment details, when the provider offers one. */
  portalUrl(params: { orgId: string; providerCustomerId?: string | null; returnUrl: string }): Promise<string | null>;
}
