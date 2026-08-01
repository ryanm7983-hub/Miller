import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkIcon, Spinner, TrashIcon } from './Icons.jsx';
import { money, parseMoneyToCents } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

/**
 * Save a product to the watchlist with a target price. Alerts fire from the
 * scheduled price refresh, so this only has to capture intent.
 */
export function TrackPanel({ product, watch, stats, onChange }) {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [belowAverage, setBelowAverage] = useState(true);
  const [allTimeLow, setAllTimeLow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTarget(watch?.targetPriceCents != null ? (watch.targetPriceCents / 100).toFixed(2) : '');
    setEmailAlerts(watch?.emailAlerts ?? false);
    setBelowAverage(watch?.notifyBelowAverage ?? true);
    setAllTimeLow(watch?.notifyAllTimeLow ?? true);
  }, [watch]);

  if (!user) {
    return (
      <section className="card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">Track this price</h2>
        <p className="mt-1 text-sm text-ink-2">
          Sign in to save this product, set a target price and get alerted when it drops.
        </p>
        <Link to="/account" className="btn-primary mt-3 w-full sm:w-auto">
          Sign in or create an account
        </Link>
      </section>
    );
  }

  const suggested = stats?.minCents ?? stats?.currentBestTotalCents ?? null;

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const targetPriceCents = target.trim() === '' ? null : parseMoneyToCents(target);
      if (target.trim() !== '' && (!targetPriceCents || targetPriceCents <= 0)) {
        throw new Error('Enter a target price like 249.99, or leave it blank.');
      }
      await api.addWatch({
        productId: product.id,
        targetPriceCents,
        emailAlerts,
        notifyBelowAverage: belowAverage,
        notifyAllTimeLow: allTimeLow,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.removeWatch(watch.id);
      await onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="track-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="track-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
          <BookmarkIcon filled={Boolean(watch)} className="h-5 w-5 text-brand" />
          {watch ? 'Tracking this product' : 'Track this price'}
        </h2>
        {watch && (
          <button type="button" onClick={remove} className="btn-ghost px-2 py-1.5 text-xs" disabled={busy}>
            <TrashIcon className="h-4 w-4" />
            Stop tracking
          </button>
        )}
      </div>

      <form onSubmit={save} className="mt-3 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-ink-2">Alert me under</span>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={suggested ? (suggested / 100).toFixed(2) : '0.00'}
                className="field tabular pl-7"
                aria-label="Target price in dollars"
              />
            </div>
            <button type="submit" className="btn-primary shrink-0" disabled={busy}>
              {busy ? <Spinner className="h-5 w-5" /> : watch ? 'Update' : 'Track'}
            </button>
          </div>
          {suggested != null && (
            <span className="mt-1 block text-xs text-muted">
              Lowest seen in this window: {money(suggested)}
            </span>
          )}
        </label>

        <fieldset className="space-y-2">
          <legend className="sr-only">Additional alerts</legend>
          <Toggle checked={allTimeLow} onChange={setAllTimeLow} label="Also alert on a new all-time low" />
          <Toggle
            checked={belowAverage}
            onChange={setBelowAverage}
            label="Also alert when it drops below its average"
          />
          <Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Email me as well as in-app" />
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-good-text">Saved. We'll watch this one for you.</p>}
      </form>
    </section>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-line accent-brand"
      />
      {label}
    </label>
  );
}
