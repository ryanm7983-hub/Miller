import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../components/ProductImage.jsx';
import { ArrowDownIcon, CheckIcon, Spinner, TrashIcon } from '../components/Icons.jsx';
import { money, relativeTime } from '../lib/format.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function WatchlistPage() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setStatus('done');
      return;
    }
    try {
      const { items: rows } = await api.watchlist();
      setItems(rows);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [user]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function stopTracking(watchId) {
    setItems((current) => current.filter((item) => item.watch.id !== watchId));
    await api.removeWatch(watchId).catch(() => load());
  }

  if (!ready || status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Loading watchlist…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-lg font-bold text-ink">Your watchlist</h1>
        <p className="mt-1 text-sm text-ink-2">
          Sign in to track products and keep your list across devices.
        </p>
        <Link to="/account" className="btn-primary mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-ink">Watchlist</h1>

      {error && (
        <p role="alert" className="card p-4 text-sm text-critical">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-2">
            Nothing tracked yet. Search for a product and tap <strong>Track</strong> to watch its
            price.
          </p>
          <Link to="/" className="btn-primary mt-4">
            Find a product
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ watch, product, bestOffer, stats, targetMet }) => (
            <li key={watch.id} className="card p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <Link to={`/product/${product.id}`} className="shrink-0">
                  <ProductImage product={product} className="h-16 w-16" />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${product.id}`}
                    className="line-clamp-2 text-sm font-semibold text-ink hover:underline"
                  >
                    {product.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {bestOffer ? `Cheapest at ${bestOffer.retailer}` : 'No current offers'}
                    {product.lastRefreshedAt ? ` · checked ${relativeTime(product.lastRefreshedAt)}` : ''}
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {targetMet && (
                      <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
                        <CheckIcon className="h-3.5 w-3.5" />
                        Target met
                      </span>
                    )}
                    {stats?.hasRecentDrop && (
                      <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
                        <ArrowDownIcon className="h-3.5 w-3.5" />
                        {stats.recentDropPercent}% this week
                      </span>
                    )}
                    {watch.targetPriceCents != null && !targetMet && (
                      <span className="chip bg-surface-2 text-ink-2 ring-1 ring-line">
                        Target {money(watch.targetPriceCents)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-lg font-bold text-ink">
                    {money(bestOffer?.totalCents)}
                  </p>
                  {stats?.avgCents != null && (
                    <p className="tabular text-[11px] text-muted">avg {money(stats.avgCents)}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => stopTracking(watch.id)}
                    className="btn-ghost mt-1 px-2 py-1 text-[11px]"
                    aria-label={`Stop tracking ${product.title}`}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
