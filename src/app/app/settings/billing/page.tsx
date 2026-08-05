import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';

import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { billing, getSubscription, getUsage } from '@/lib/billing';
import { PLANS, formatPrice, limitLabel } from '@/lib/billing/plans';
import { BILLING_STATUS_META, type BillingStatus } from '@/lib/enums';
import { Card, CardHeader, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { formatDate } from '@/lib/utils';
import { cancelPlanAction, changePlanAction, resumePlanAction } from '../actions';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string; canceled?: string }>;
}) {
  const tenant = await requireTenant();
  if (!can(tenant.role, 'billing:manage')) redirect('/app/settings');

  const sp = await searchParams;
  const [subscription, usage] = await Promise.all([getSubscription(tenant.orgId), getUsage(tenant.orgId)]);
  const provider = billing();
  const statusMeta = BILLING_STATUS_META[subscription.status as BillingStatus];

  const usageRows: Array<[string, number, number]> = [
    ['Audit projects', usage.auditProjects, subscription.plan.limits.auditProjects],
    ['Team members', usage.members, subscription.plan.limits.members],
    ['Evidence documents', usage.evidenceItems, subscription.plan.limits.evidenceItems],
    ['Storage used (MB)', usage.storageMb, subscription.plan.limits.storageMb],
  ];

  return (
    <div className="space-y-4">
      {sp.changed && <Alert tone="success">Your plan has been updated.</Alert>}
      {sp.canceled && (
        <Alert tone="warning">
          Your subscription is set to end when the current period closes. You can resume it any time before then.
        </Alert>
      )}

      {!provider.live && (
        <Alert tone="info" title="Development billing simulator">
          No Stripe key is configured, so plan changes apply immediately and no payment is taken. Set{' '}
          <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[12px]">STRIPE_SECRET_KEY</code> plus the price
          ids to process real subscriptions.
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Current plan"
          action={
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
          }
        />
        <div className="p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[24px] font-bold text-ink-900">{subscription.plan.name}</span>
            <span className="tnum text-[15px] text-ink-500">
              {formatPrice(subscription.plan.monthlyCents)}
              {subscription.plan.monthlyCents > 0 && '/month'}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] text-ink-600">{subscription.plan.tagline}</p>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink-600">
            {subscription.daysLeftInTrial !== null && (
              <span>
                <strong className="font-semibold text-ink-800">{subscription.daysLeftInTrial}</strong> day
                {subscription.daysLeftInTrial === 1 ? '' : 's'} left in trial
              </span>
            )}
            {subscription.trialEndsAt && <span>Trial ends {formatDate(subscription.trialEndsAt)}</span>}
            {subscription.currentPeriodEnd && (
              <span>
                {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {formatDate(subscription.currentPeriodEnd)}
              </span>
            )}
          </div>

          {subscription.cancelAtPeriodEnd ? (
            <form action={resumePlanAction} className="mt-5">
              <SubmitButton variant="secondary" pendingLabel="Resuming…">
                Resume subscription
              </SubmitButton>
            </form>
          ) : (
            subscription.planKey !== 'trial' && (
              <form action={cancelPlanAction} className="mt-5">
                <SubmitButton variant="ghost" pendingLabel="Cancelling…">
                  Cancel subscription
                </SubmitButton>
              </form>
            )
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Usage" description="Against your current plan's limits." />
        <ul className="divide-y divide-ink-100">
          {usageRows.map(([label, used, limit]) => {
            const percent = limit === -1 ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
            return (
              <li key={label} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink-800">{label}</span>
                  <span className="tnum text-[13px] text-ink-600">
                    {used.toLocaleString('en-US')} / {limitLabel(limit)}
                  </span>
                </div>
                {limit !== -1 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${percent >= 90 ? 'bg-risk-500' : percent >= 70 ? 'bg-caution-500' : 'bg-kelp-600'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLANS.filter((plan) => plan.key !== 'trial').map((plan) => {
          const current = plan.key === subscription.planKey;
          return (
            <Card
              key={plan.key}
              className={`flex flex-col p-5 ${current ? 'border-kelp-500 ring-1 ring-kelp-500/20' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-bold text-ink-900">{plan.name}</h3>
                {current && (
                  <Badge tone="strong" size="sm">
                    Current plan
                  </Badge>
                )}
                {plan.comingSoon && (
                  <Badge tone="info" size="sm">
                    In development
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-500">{plan.tagline}</p>
              <p className="tnum mt-3 text-[26px] font-bold text-ink-900">
                {formatPrice(plan.monthlyCents)}
                <span className="text-[14px] font-normal text-ink-500">/month</span>
              </p>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-[13px] leading-relaxed text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kelp-600" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              {!current && !plan.comingSoon && (
                <form action={changePlanAction} className="mt-5">
                  <input type="hidden" name="planKey" value={plan.key} />
                  <SubmitButton className="w-full" variant={plan.highlight ? 'primary' : 'secondary'} pendingLabel="Switching…">
                    {provider.live ? `Switch to ${plan.name}` : `Switch to ${plan.name} (simulated)`}
                  </SubmitButton>
                </form>
              )}
              {plan.comingSoon && (
                <p className="mt-5 text-center text-[12.5px] text-ink-500">
                  The client portfolio dashboard ships with this tier.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
