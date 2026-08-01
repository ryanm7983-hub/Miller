import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductImage } from '../components/ProductImage.jsx';
import { PriceStats } from '../components/PriceStats.jsx';
import { OfferList } from '../components/OfferList.jsx';

// Charting is ~40% of the bundle and only the product page needs it.
const PriceHistoryChart = lazy(() =>
  import('../components/PriceHistoryChart.jsx').then((module) => ({
    default: module.PriceHistoryChart,
  })),
);
import { TrackPanel } from '../components/TrackPanel.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { RefreshIcon, Spinner } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
import { addRecentlyViewed } from '../lib/storage.js';
import { relativeTime } from '../lib/format.js';
import { useNotifications } from '../context/NotificationsContext.jsx';

export function ProductPage() {
  const { id } = useParams();
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { refresh: refreshNotifications } = useNotifications();

  const load = useCallback(
    async (nextDays = days) => {
      try {
        const payload = await api.product(id, nextDays);
        setData(payload);
        setStatus('done');
        addRecentlyViewed(payload.product);
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    },
    [id, days],
  );

  useEffect(() => {
    setStatus('loading');
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on id
  }, [id]);

  async function changeDays(nextDays) {
    setDays(nextDays);
    try {
      const { history, stats } = await api.history(id, nextDays);
      setData((current) => (current ? { ...current, history, stats } : current));
    } catch {
      /* keep the current window on failure */
    }
  }

  async function forceRefresh() {
    setRefreshing(true);
    try {
      await api.refreshProduct(id);
      await load(days);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function afterWatchChange() {
    await load(days);
    await refreshNotifications();
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Loading product…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-critical">{error}</p>
        <Link to="/" className="btn-secondary mt-4">
          Back to search
        </Link>
      </div>
    );
  }

  const { product, offers, stats, history, watch, providers } = data;

  return (
    <div className="space-y-4">
      <article className="card p-4 sm:p-5">
        <div className="flex gap-4">
          <ProductImage product={product} className="h-20 w-20 shrink-0 sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-snug font-bold text-ink sm:text-xl">{product.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {[product.brand, product.model, product.upc && `UPC ${product.upc}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {product.isMock && (
                <span className="chip bg-surface-2 text-muted ring-1 ring-line">sample data</span>
              )}
              <span className="text-xs text-muted">
                Checked {relativeTime(product.lastRefreshedAt)}
              </span>
              <button
                type="button"
                onClick={forceRefresh}
                className="btn-ghost px-2 py-1 text-xs"
                disabled={refreshing}
              >
                {refreshing ? <Spinner className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
      </article>

      <PriceStats stats={stats} bestOffer={offers.find((offer) => offer.isBestDeal)} days={days} />

      <OfferList offers={offers} />

      <Suspense
        fallback={
          <div className="card flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Spinner /> Loading price history…
          </div>
        }
      >
        <PriceHistoryChart
          history={history}
          stats={stats}
          days={days}
          onDaysChange={changeDays}
          targetPriceCents={watch?.targetPriceCents ?? null}
        />
      </Suspense>

      <TrackPanel product={product} watch={watch} stats={stats} onChange={afterWatchChange} />

      <DataSourceNotice
        providers={providers}
        usingMockData={providers?.every((provider) => !provider.live)}
        className="mb-2"
      />

      {history?.containsSyntheticData && (
        <p className="px-1 text-xs text-muted">
          Part of this chart is back-filled sample history so the demo has something to draw. With a
          live provider configured, history builds up from the moment a product is first searched or
          tracked.
        </p>
      )}
    </div>
  );
}
