import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Bookmark,
  Clock,
  PiggyBank,
  Search as SearchIcon,
  Tag,
  TrendingDown,
} from 'lucide-react';
import { Card, CardHeader, EmptyState, Badge, Skeleton } from '../components/ui/Primitives.jsx';
import { Button } from '../components/ui/Button.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { api } from '../lib/api.js';
import { money, relativeTime } from '../lib/format.js';
import { getRecentlyViewed } from '../lib/storage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';

/**
 * The signed-in home: what changed since you last looked, then the things you
 * track. Summary before detail — every number here links to the page that
 * explains it.
 */
export function DashboardPage() {
  const { user, ready } = useAuth();
  const { items: notifications, unreadCount } = useNotifications();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewed, setViewed] = useState(() => getRecentlyViewed());

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { items } = await api.watchlist();
      setWatchlist(items);
    } catch {
      /* the empty state covers this */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ready) load();
    setViewed(getRecentlyViewed());
  }, [ready, load]);

  const stats = useMemo(() => {
    const withOffers = watchlist.filter((item) => item.bestOffer);

    const drops = withOffers.filter((item) => item.stats?.hasRecentDrop);
    const targetsMet = withOffers.filter((item) => item.targetMet);

    // "Savings" = what you'd pay now versus each item's own recent average.
    const savings = withOffers.reduce((total, item) => {
      const avg = item.stats?.avgCents;
      const now = item.bestOffer?.totalCents;
      return avg && now && avg > now ? total + (avg - now) : total;
    }, 0);

    const bestDeal = withOffers
      .filter((item) => item.stats?.percentBelowAverage > 0)
      .sort((a, b) => b.stats.percentBelowAverage - a.stats.percentBelowAverage)[0];

    return {
      tracked: watchlist.length,
      drops: drops.length,
      targetsMet: targetsMet.length,
      savings,
      bestDeal,
    };
  }, [watchlist]);

  if (!ready || (user && loading)) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <SignedOutHome viewed={viewed} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">Dashboard</h1>
          <p className="text-help mt-0.5 text-ink-3">
            {stats.tracked > 0
              ? `Tracking ${stats.tracked} ${stats.tracked === 1 ? 'product' : 'products'}${
                  unreadCount ? ` · ${unreadCount} new ${unreadCount === 1 ? 'alert' : 'alerts'}` : ''
                }`
              : 'Nothing tracked yet — find a product to get started.'}
          </p>
        </div>
        <Link to="/search" className="no-underline">
          <Button variant="primary" size="md">
            <SearchIcon className="h-4 w-4" aria-hidden="true" />
            Find a product
          </Button>
        </Link>
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Bookmark}
          label="Products tracked"
          value={stats.tracked}
          hint={stats.tracked === 0 ? 'Add your first' : 'On your watchlist'}
        />
        <StatCard
          icon={TrendingDown}
          label="Price drops"
          value={stats.drops}
          trend={stats.drops > 0 ? 'this week' : null}
          trendTone={stats.drops > 0 ? 'good' : 'flat'}
          hint={stats.drops === 0 ? 'No drops this week' : null}
        />
        <StatCard
          icon={Tag}
          label="Targets met"
          value={stats.targetsMet}
          hint={stats.targetsMet > 0 ? 'Ready to buy' : 'Waiting on a drop'}
        />
        <StatCard
          icon={PiggyBank}
          label="Below average by"
          value={money(stats.savings)}
          hint="Versus 90-day averages"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <div className="p-4 sm:p-5">
            <CardHeader
              title="Your watchlist"
              subtitle="Cheapest total price right now, shipping included"
              action={
                <Link to="/watchlist" className="no-underline">
                  <Button variant="ghost" size="sm">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </Link>
              }
            />
          </div>

          {watchlist.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing tracked yet"
              description="Search for a product, set the price you'd pay, and PriceScout will watch it for you."
              action={
                <Link to="/search" className="no-underline">
                  <Button variant="primary">Find a product</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {watchlist.slice(0, 5).map(({ watch, product, bestOffer, stats: itemStats, targetMet }) => (
                <li key={watch.id}>
                  <Link
                    to={`/product/${product.id}`}
                    className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <ProductImage product={product} className="h-11 w-11 shrink-0" rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{product.title}</p>
                      <p className="text-help truncate text-muted">
                        {bestOffer ? `Cheapest at ${bestOffer.retailer}` : 'No offers in stock'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-[15px] font-bold text-ink">
                        {money(bestOffer?.totalCents)}
                      </p>
                      {targetMet ? (
                        <span className="text-help font-semibold text-success-text">Target met</span>
                      ) : itemStats?.hasRecentDrop ? (
                        <span className="text-help font-semibold text-success-text">
                          ↓ {itemStats.recentDropPercent}%
                        </span>
                      ) : watch.targetPriceCents ? (
                        <span className="text-help tabular text-muted">
                          target {money(watch.targetPriceCents)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <div className="p-4 sm:p-5">
            <CardHeader
              title="Recent activity"
              subtitle="Alerts from your tracked products"
              action={
                unreadCount > 0 ? <Badge tone="primary">{unreadCount} new</Badge> : null
              }
            />
          </div>

          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No alerts yet"
              description="When a tracked product hits your target or drops below its average, it shows up here."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {notifications.slice(0, 6).map((notification) => (
                <li key={notification.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.read ? 'bg-border-strong' : 'bg-primary'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink">{notification.title}</p>
                      <p className="text-help mt-0.5 line-clamp-2 text-ink-3">{notification.body}</p>
                      <p className="text-help mt-1 flex items-center gap-1 text-muted">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {viewed.length > 0 && <RecentlyViewed items={viewed} />}
    </div>
  );
}

function RecentlyViewed({ items }) {
  return (
    <Card className="p-4 sm:p-5">
      <CardHeader title="Recently viewed" subtitle="Picked up from this device" />
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.slice(0, 6).map((product) => (
          <li key={product.id}>
            <Link
              to={`/product/${product.id}`}
              className="group flex flex-col gap-2 rounded-xl p-2 no-underline transition-colors hover:bg-surface-2"
            >
              <ProductImage product={product} className="aspect-square w-full" />
              <span className="line-clamp-2 text-[12.5px] leading-snug font-medium text-ink-2 group-hover:text-ink">
                {product.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SignedOutHome({ viewed }) {
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            background:
              'radial-gradient(60% 120% at 15% 0%, var(--ps-primary) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative px-5 py-10 text-center sm:px-10 sm:py-14">
          <Badge tone="primary" className="mx-auto">
            Price tracking, without the guesswork
          </Badge>
          <h1 className="text-display mt-4 text-ink text-balance">
            Know the real price before you buy
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink-3">
            Compare every retailer in one place, see what a product has actually cost over the past
            year, and get told the moment it drops to your price.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/search" className="no-underline">
              <Button variant="primary" size="lg">
                <SearchIcon className="h-4 w-4" aria-hidden="true" />
                Search a product
              </Button>
            </Link>
            <Link to="/account" className="no-underline">
              <Button variant="secondary" size="lg">
                Create a free account
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: SearchIcon,
            title: 'Compare in one place',
            body: 'Every retailer sorted by total price — item plus shipping, not the sticker.',
          },
          {
            icon: TrendingDown,
            title: 'See the real history',
            body: 'A year of price history tells you whether that "deal" is actually a deal.',
          },
          {
            icon: Bell,
            title: 'Get told, not tempted',
            body: 'Set the price you would pay. We watch it and tell you when it lands.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-wash text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-section mt-3.5 text-ink">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{body}</p>
          </Card>
        ))}
      </section>

      {viewed.length > 0 && <RecentlyViewed items={viewed} />}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCard key={index} loading />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <Skeleton className="h-5 w-36" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
