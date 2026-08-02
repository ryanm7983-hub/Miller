import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageX, RefreshCw } from 'lucide-react';
import { ProductHero } from '../components/ProductImage.jsx';
import { PriceStats } from '../components/PriceStats.jsx';
import { OfferList } from '../components/OfferList.jsx';
import { TrackPanel } from '../components/TrackPanel.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { Card, Badge, EmptyState, Skeleton } from '../components/ui/Primitives.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { api } from '../lib/api.js';
import { addRecentlyViewed } from '../lib/storage.js';
import { relativeTime } from '../lib/format.js';
import { useNotifications } from '../context/NotificationsContext.jsx';

// Charting is a large chunk and only this page needs it.
const PriceHistoryChart = lazy(() =>
  import('../components/PriceHistoryChart.jsx').then((module) => ({
    default: module.PriceHistoryChart,
  })),
);

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
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
      toast.success('Prices refreshed');
    } catch (err) {
      toast.error("Couldn't refresh prices", err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function afterWatchChange() {
    await load(days);
    await refreshNotifications();
  }

  if (status === 'loading') return <ProductSkeleton />;

  if (status === 'error') {
    return (
      <Card>
        <EmptyState
          icon={PackageX}
          title="We couldn't load that product"
          description={error}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => load(days)}>
                Try again
              </Button>
              <Link to="/search" className="no-underline">
                <Button variant="primary">Back to search</Button>
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  const { product, offers, stats, history, watch, providers } = data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
          <ProductHero product={product} className="h-48 w-full shrink-0 sm:h-44 sm:w-44" />
          <div className="min-w-0 flex-1">
            {product.brand && <p className="text-label text-muted">{product.brand}</p>}
            <h1 className="text-title mt-1 text-ink text-balance">{product.title}</h1>
            <p className="text-help mt-2 text-muted">
              {[product.model, product.upc && `UPC ${product.upc}`].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {product.isMock && <Badge tone="warning">sample data</Badge>}
              <span className="text-help text-muted">
                Checked {relativeTime(product.lastRefreshedAt)}
              </span>
              <Button variant="ghost" size="sm" onClick={forceRefresh} loading={refreshing}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <PriceStats stats={stats} bestOffer={offers.find((offer) => offer.isBestDeal)} days={days} />

      {/* The comparison table is the point of the page, so it gets full width
          and never has to compete with the sidebar for columns. */}
      <OfferList offers={offers} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Suspense
            fallback={
              <Card className="p-5">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-4 h-56 w-full rounded-xl" />
              </Card>
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
        </div>
        <div className="min-w-0 lg:col-span-2">
          <TrackPanel product={product} watch={watch} stats={stats} onChange={afterWatchChange} />
        </div>
      </div>

      <DataSourceNotice
        providers={providers}
        usingMockData={providers?.every((provider) => !provider.live)}
      />

      {history?.containsSyntheticData && (
        <p className="text-help px-1 text-muted">
          Part of this chart is back-filled sample history so the demo has something to draw. With a
          live provider configured, history builds up from the moment a product is first searched or
          tracked.
        </p>
      )}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-20" />
      <Card className="flex flex-col gap-5 p-5 sm:flex-row">
        <Skeleton className="h-48 w-full rounded-2xl sm:h-44 sm:w-44" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-3/4" />
          <Skeleton className="mt-2 h-6 w-1/2" />
          <Skeleton className="mt-4 h-3 w-40" />
        </div>
      </Card>
      <Card className="p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-9 w-44" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    </div>
  );
}
