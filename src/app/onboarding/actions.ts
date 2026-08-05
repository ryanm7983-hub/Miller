'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { getSessionUser, setActiveOrg } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit-log';
import { ensureSystemFrameworks } from '@/lib/frameworks';
import { getSubscription } from '@/lib/billing';
import { slugify } from '@/lib/utils';

export interface OnboardingState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your organization name.').max(120),
  industry: z.string().trim().max(80).optional(),
  sizeBand: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  kind: z.enum(['STANDARD', 'CONSULTANCY']).default('STANDARD'),
});

const DEFAULT_DEPARTMENTS = [
  'Quality',
  'Operations',
  'Production',
  'Maintenance',
  'Engineering',
  'Health & Safety',
  'Purchasing',
  'People / HR',
];

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'org';
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createOrganizationAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const parsed = schema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry') || undefined,
    sizeBand: formData.get('sizeBand') || undefined,
    country: formData.get('country') || undefined,
    kind: formData.get('kind') || 'STANDARD',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  // Guard against a second submission creating a duplicate organization.
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  });
  if (existingMembership) {
    await setActiveOrg(user.sessionId, existingMembership.orgId);
    redirect('/app/dashboard');
  }

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: await uniqueSlug(parsed.data.name),
      kind: parsed.data.kind,
      industry: parsed.data.industry,
      sizeBand: parsed.data.sizeBand,
      country: parsed.data.country,
      memberships: {
        create: { userId: user.id, role: 'OWNER', status: 'ACTIVE' },
      },
      departments: {
        create: DEFAULT_DEPARTMENTS.map((name) => ({ name })),
      },
    },
  });

  // Install the bundled frameworks and start the trial.
  await ensureSystemFrameworks();
  await getSubscription(org.id);

  await setActiveOrg(user.sessionId, org.id);
  await recordAudit({
    orgId: org.id,
    userId: user.id,
    action: 'org.created',
    entityType: 'Organization',
    entityId: org.id,
    metadata: { name: org.name, kind: org.kind },
  });

  redirect('/app/audits/new?welcome=1');
}
