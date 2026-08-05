/**
 * Plan catalogue — the single source of truth for pricing and limits.
 *
 * Prices are stored in cents and never hard-coded anywhere else in the
 * application; the landing page, billing settings and limit enforcement all
 * read from here. Adding a tier is a change to this file plus a price id.
 */

export interface PlanLimits {
  /** -1 means unlimited. */
  auditProjects: number;
  members: number;
  evidenceItems: number;
  storageMb: number;
  aiAnalysesPerMonth: number;
  simulator: boolean;
  consultantMode: boolean;
  customFrameworks: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  key: string;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  /** Populated from env in production; empty in the development simulator. */
  stripePriceIdEnv?: string;
  trialDays: number;
  highlight?: boolean;
  audience: string;
  features: string[];
  limits: PlanLimits;
  /** Hidden from the public pricing table but selectable internally. */
  comingSoon?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: 'trial',
    name: 'Free trial',
    tagline: 'See where you stand, at no cost.',
    monthlyCents: 0,
    annualCents: 0,
    trialDays: 14,
    audience: 'Anyone evaluating AuditReady',
    features: [
      '1 audit project',
      'Up to 25 evidence documents',
      'AI document analysis and gap detection',
      'Readiness score and matrix',
      '14 days, no card required',
    ],
    limits: {
      auditProjects: 1,
      members: 3,
      evidenceItems: 25,
      storageMb: 250,
      aiAnalysesPerMonth: 50,
      simulator: false,
      consultantMode: false,
      customFrameworks: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'One standard, one site, one team.',
    monthlyCents: 2900,
    annualCents: 29000,
    stripePriceIdEnv: 'STRIPE_PRICE_STARTER',
    trialDays: 14,
    audience: 'Small manufacturers preparing for a single certification',
    features: [
      '2 audit projects',
      '500 evidence documents',
      'Unlimited requirements',
      'Gap centre and action tracking',
      'Audit preparation reports',
      'Email notifications',
    ],
    limits: {
      auditProjects: 2,
      members: 5,
      evidenceItems: 500,
      storageMb: 5_000,
      aiAnalysesPerMonth: 300,
      simulator: false,
      consultantMode: false,
      customFrameworks: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  {
    key: 'professional',
    name: 'Professional',
    tagline: 'Multiple standards, real audit pressure.',
    monthlyCents: 7900,
    annualCents: 79000,
    stripePriceIdEnv: 'STRIPE_PRICE_PROFESSIONAL',
    trialDays: 14,
    highlight: true,
    audience: 'Quality and operations teams running several audits a year',
    features: [
      '10 audit projects',
      '5,000 evidence documents',
      'Audit Simulator — "Ask Me Like an Auditor"',
      'Audit preparation mode with prioritised plan',
      'Custom frameworks',
      'Full audit trail and role-based access',
    ],
    limits: {
      auditProjects: 10,
      members: 25,
      evidenceItems: 5_000,
      storageMb: 50_000,
      aiAnalysesPerMonth: 2_000,
      simulator: true,
      consultantMode: false,
      customFrameworks: true,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  {
    key: 'business',
    name: 'Business',
    tagline: 'Multi-site, multi-standard, no ceiling.',
    monthlyCents: 19900,
    annualCents: 199000,
    stripePriceIdEnv: 'STRIPE_PRICE_BUSINESS',
    trialDays: 14,
    audience: 'Organizations with several sites or heavy customer-audit load',
    features: [
      'Unlimited audit projects',
      'Unlimited evidence documents',
      'Everything in Professional',
      'API access',
      'Priority support',
      'Advanced analytics',
    ],
    limits: {
      auditProjects: -1,
      members: -1,
      evidenceItems: -1,
      storageMb: 500_000,
      aiAnalysesPerMonth: 10_000,
      simulator: true,
      consultantMode: false,
      customFrameworks: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
  {
    key: 'consultant',
    name: 'Consultant',
    tagline: 'Every client, one dashboard.',
    monthlyCents: 29900,
    annualCents: 299000,
    stripePriceIdEnv: 'STRIPE_PRICE_CONSULTANT',
    trialDays: 14,
    comingSoon: true,
    audience: 'Consultants and internal audit firms managing multiple clients',
    features: [
      'Everything in Business',
      'Client portfolio dashboard',
      'Per-client readiness and risk',
      'Scoped client access without seat sprawl',
      'White-label reports',
    ],
    limits: {
      auditProjects: -1,
      members: -1,
      evidenceItems: -1,
      storageMb: 1_000_000,
      aiAnalysesPerMonth: 25_000,
      simulator: true,
      consultantMode: true,
      customFrameworks: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
];

export const PUBLIC_PLANS = PLANS.filter((p) => p.key !== 'trial' && !p.comingSoon);

export function getPlan(key: string): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function limitLabel(value: number): string {
  return value === -1 ? 'Unlimited' : value.toLocaleString('en-US');
}
