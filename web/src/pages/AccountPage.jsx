import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/Icons.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export function AccountPage() {
  const { user, ready, login, register, logout } = useAuth();
  const navigate = useNavigate();
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
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate('/watchlist');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink">Account</h1>

      {user ? (
        <section className="card p-5">
          <p className="text-sm text-ink-2">Signed in as</p>
          <p className="text-base font-semibold text-ink">{user.email}</p>
          <button type="button" onClick={logout} className="btn-secondary mt-4">
            Sign out
          </button>
        </section>
      ) : (
        <section className="card p-5">
          <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
            {[
              ['login', 'Sign in'],
              ['register', 'Create account'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                aria-pressed={mode === value}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-ink-2">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-2">Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field mt-1"
              />
              <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-critical">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Spinner className="h-5 w-5" /> : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-3 text-xs text-muted">
            Demo account: <code>demo@pricescout.app</code> / <code>demo1234</code> (after{' '}
            <code>npm run seed</code>).
          </p>
        </section>
      )}

      {installEvent && (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Install PriceScout</h2>
          <p className="mt-1 text-sm text-ink-2">
            Add it to your home screen for full-screen use and offline access to pages you've
            already opened.
          </p>
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={async () => {
              installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
          >
            Install app
          </button>
        </section>
      )}

      {providers && (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Data sources</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
            {providers.providers.map((provider) => (
              <li key={provider.name} className="flex items-center justify-between gap-3">
                <span>{provider.label}</span>
                <span
                  className={`chip ${
                    provider.live
                      ? 'bg-good/12 text-good-text ring-1 ring-good/30'
                      : 'bg-surface-2 text-ink-2 ring-1 ring-line'
                  }`}
                >
                  {provider.live ? 'live' : 'sample data'}
                </span>
              </li>
            ))}
          </ul>
          <DataSourceNotice
            providers={providers.providers}
            usingMockData={providers.usingMockData}
            className="mt-3"
          />
        </section>
      )}
    </div>
  );
}
