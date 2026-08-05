import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/app/dashboard');

  return (
    <div>
      <h1 className="text-[24px] font-bold tracking-tight text-ink-900">Welcome back</h1>
      <p className="mt-1.5 text-[14px] text-ink-600">Sign in to pick up where your team left off.</p>

      <div className="mt-7">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-600">
        Don&rsquo;t have an account?{' '}
        <Link href="/signup" className="link font-medium">
          Create one free
        </Link>
      </p>
    </div>
  );
}
