import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect('/app/dashboard');

  const { plan } = await searchParams;

  return (
    <div>
      <h1 className="text-[24px] font-bold tracking-tight text-ink-900">Check your readiness</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">
        Create your account and get a real readiness score today. 14-day trial, no credit card.
      </p>

      <div className="mt-7">
        <SignupForm plan={plan} />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-600">
        Already have an account?{' '}
        <Link href="/login" className="link font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
