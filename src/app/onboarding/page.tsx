import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';
import { listAccessibleOrgs } from '@/lib/tenant';
import { Logo } from '@/components/marketing/logo';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Create your organization' };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const orgs = await listAccessibleOrgs(user.id);
  if (orgs.length > 0) redirect('/app/dashboard');

  return (
    <div className="min-h-screen bg-ink-50/60">
      <div className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-16 items-center">
          <Logo href={null} />
        </div>
      </div>

      <div className="container-page py-12">
        <div className="mx-auto max-w-xl">
          <div className="mb-7">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-kelp-700">Step 1 of 2</p>
            <h1 className="mt-2 text-[26px] font-bold tracking-tight text-ink-900">
              Set up your organization
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
              Welcome, {user.name.split(' ')[0]}. This is the workspace your audits, evidence and team will live in.
              Everything is private to your organization.
            </p>
          </div>

          <div className="card p-6">
            <OnboardingForm />
          </div>

          <p className="mt-5 text-center text-[12.5px] text-ink-500">
            Next you&rsquo;ll create your first audit project and pick a framework. Takes about a minute.
          </p>
        </div>
      </div>
    </div>
  );
}
