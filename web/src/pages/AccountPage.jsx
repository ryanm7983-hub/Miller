import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Database, Download, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, Badge, Field, Segmented, Skeleton } from '../components/ui/Primitives.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export function AccountPage() {
  const { user, ready, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    function onPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Welcome back');
      } else {
        await register(email, password);
        toast.success('Account created', 'Your watchlist will follow you across devices.');
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-32" />
        <Card className="p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-title text-ink">{user ? 'Settings' : 'Account'}</h1>
        <p className="text-help mt-0.5 text-ink-3">
          {user ? 'Your account and this deployment.' : 'Sign in to keep a watchlist across devices.'}
        </p>
      </header>

      {user ? (
        <Card className="p-4 sm:p-5">
          <CardHeader title="Signed in" subtitle="Your watchlist and alerts are tied to this account." />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-[15px] font-bold text-white">
                {user.email?.[0]?.toUpperCase() ?? '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-ink">{user.email}</p>
                <p className="text-help text-muted">Email &amp; password</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                logout();
                toast.info('Signed out');
              }}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          <Segmented
            className="w-full [&>button]:flex-1"
            label="Sign in or create an account"
            value={mode}
            onChange={(value) => {
              setMode(value);
              setError(null);
            }}
            options={[
              { value: 'login', label: 'Sign in' },
              { value: 'register', label: 'Create account' },
            ]}
          />

          <form onSubmit={submit} className="mt-4 space-y-3.5">
            <Field
              label="Email"
              type="email"
              required
              autoComplete="email"
              icon={Mail}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              icon={ShieldCheck}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
              error={error}
            />
            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="text-help mt-3.5 text-muted">
            Demo account: <code className="rounded bg-surface-2 px-1 py-0.5">demo@pricescout.app</code>{' '}
            / <code className="rounded bg-surface-2 px-1 py-0.5">demo1234</code> after{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5">npm run seed</code>.
          </p>
        </Card>
      )}

      {installEvent && (
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Install PriceScout"
            subtitle="Add it to your home screen for full-screen use and offline access to pages you've opened."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  installEvent.prompt();
                  await installEvent.userChoice;
                  setInstallEvent(null);
                }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Install
              </Button>
            }
          />
        </Card>
      )}

      {providers && (
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Data sources"
            subtitle="Where the prices on this deployment come from."
          />
          <ul className="mt-4 space-y-2">
            {providers.providers.map((provider) => (
              <li
                key={provider.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                  <Database className="h-4 w-4 text-muted" aria-hidden="true" />
                  {provider.label}
                </span>
                <Badge tone={provider.live ? 'success' : 'warning'} icon={provider.live ? Check : undefined}>
                  {provider.live ? 'live' : 'sample data'}
                </Badge>
              </li>
            ))}
          </ul>
          <DataSourceNotice
            providers={providers.providers}
            usingMockData={providers.usingMockData}
            className="mt-4"
          />
        </Card>
      )}
    </div>
  );
}
