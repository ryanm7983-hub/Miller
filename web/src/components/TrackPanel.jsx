import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, Trash2 } from 'lucide-react';
import { Card, CardHeader, Checkbox, Field } from './ui/Primitives.jsx';
import { Button } from './ui/Button.jsx';
import { useToast } from './ui/Toast.jsx';
import { money, parseMoneyToCents } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

/**
 * Save a product to the watchlist with a target price. Alerts fire from the
 * scheduled price refresh, so this only has to capture intent.
 */
export function TrackPanel({ product, watch, stats, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [belowAverage, setBelowAverage] = useState(true);
  const [allTimeLow, setAllTimeLow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTarget(watch?.targetPriceCents != null ? (watch.targetPriceCents / 100).toFixed(2) : '');
    setEmailAlerts(watch?.emailAlerts ?? false);
    setBelowAverage(watch?.notifyBelowAverage ?? true);
    setAllTimeLow(watch?.notifyAllTimeLow ?? true);
  }, [watch]);

  if (!user) {
    return (
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Track this price"
          subtitle="Set the price you'd pay and we'll watch every retailer for you."
        />
        <Link to="/account" className="mt-4 inline-block no-underline">
          <Button variant="primary">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Sign in to track
          </Button>
        </Link>
      </Card>
    );
  }

  const suggested = stats?.minCents ?? stats?.currentBestTotalCents ?? null;

  async function save(event) {
    event.preventDefault();
    setError(null);

    const targetPriceCents = target.trim() === '' ? null : parseMoneyToCents(target);
    if (target.trim() !== '' && (!targetPriceCents || targetPriceCents <= 0)) {
      setError('Enter a price like 249.99, or leave it blank to track without a target.');
      return;
    }

    setBusy(true);
    try {
      await api.addWatch({
        productId: product.id,
        targetPriceCents,
        emailAlerts,
        notifyBelowAverage: belowAverage,
        notifyAllTimeLow: allTimeLow,
      });
      toast.success(
        watch ? 'Tracking updated' : 'Now tracking this product',
        targetPriceCents ? `We'll alert you under ${money(targetPriceCents)}` : undefined,
      );
      await onChange?.();
    } catch (err) {
      setError(err.message);
      toast.error("Couldn't save that", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.removeWatch(watch.id);
      toast.success('Stopped tracking', product.title);
      await onChange?.();
    } catch (err) {
      toast.error("Couldn't remove that", err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5" aria-labelledby="track-heading">
      <CardHeader
        id="track-heading"
        title={watch ? 'Tracking this product' : 'Track this price'}
        subtitle={
          watch
            ? 'We check this on every scheduled refresh.'
            : "Set a target and we'll tell you the moment it lands."
        }
        action={
          watch ? (
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Stop tracking
            </Button>
          ) : null
        }
      />

      <form onSubmit={save} className="mt-4 space-y-4">
        <div className="flex items-end gap-2">
          <Field
            label="Alert me under"
            prefix="$"
            type="text"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={suggested ? (suggested / 100).toFixed(2) : '0.00'}
            aria-label="Target price in dollars"
            error={error}
            hint={suggested != null ? `Lowest seen recently: ${money(suggested)}` : undefined}
            className="flex-1"
            inputClassName="tabular"
          />
          <Button type="submit" variant="primary" size="lg" loading={busy} className="mb-[26px]">
            {watch ? 'Update' : 'Track'}
          </Button>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-label mb-1 text-muted">Also alert me when</legend>
          <Checkbox
            checked={allTimeLow}
            onChange={setAllTimeLow}
            label="It hits a new all-time low"
          />
          <Checkbox
            checked={belowAverage}
            onChange={setBelowAverage}
            label="It drops below its usual price"
          />
          <Checkbox
            checked={emailAlerts}
            onChange={setEmailAlerts}
            label="Email me as well as in-app"
            description="Needs a mail provider configured on the server."
          />
        </fieldset>

        {watch && (
          <p className="text-help flex items-center gap-1.5 text-muted">
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
            Alerts appear in your notification centre.
          </p>
        )}
      </form>
    </Card>
  );
}
