import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  Trash2,
} from 'lucide-react';
import { Card, Badge, EmptyState, Field, Segmented, Skeleton } from '../components/ui/Primitives.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { money, relativeTime } from '../lib/format.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 8;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'target', label: 'Target met' },
  { value: 'drops', label: 'Dropped' },
];

const SORTS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'drop', label: 'Biggest drop' },
  { value: 'name', label: 'Name' },
];

/**
 * The watchlist as a real data table: search, filter, sort and pagination, with
 * the same rows collapsing into cards on phones rather than scrolling sideways.
 */
export function WatchlistPage() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setStatus('done');
      return;
    }
    try {
      const { items: rows } = await api.watchlist();
      setItems(rows);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      toast.error("Couldn't load your watchlist", error.message);
    }
  }, [user, toast]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, sort]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let rows = items.filter((item) => {
      if (needle && !item.product.title.toLowerCase().includes(needle)) return false;
      if (filter === 'target') return item.targetMet;
      if (filter === 'drops') return Boolean(item.stats?.hasRecentDrop);
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return (a.bestOffer?.totalCents ?? Infinity) - (b.bestOffer?.totalCents ?? Infinity);
        case 'price-desc':
          return (b.bestOffer?.totalCents ?? 0) - (a.bestOffer?.totalCents ?? 0);
        case 'drop':
          return (b.stats?.recentDropPercent ?? 0) - (a.stats?.recentDropPercent ?? 0);
        case 'name':
          return a.product.title.localeCompare(b.product.title);
        default:
          return new Date(b.watch.createdAt) - new Date(a.watch.createdAt);
      }
    });

    return rows;
  }, [items, search, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function stopTracking(item) {
    setRemoving(item.watch.id);
    const previous = items;
    setItems((current) => current.filter((row) => row.watch.id !== item.watch.id));
    try {
      await api.removeWatch(item.watch.id);
      toast.success('Stopped tracking', item.product.title);
    } catch (error) {
      setItems(previous);
      toast.error("Couldn't remove that", error.message);
    } finally {
      setRemoving(null);
    }
  }

  if (!ready || status === 'loading') return <TableSkeleton />;

  if (!user) {
    return (
      <Card>
        <EmptyState
          icon={Bookmark}
          title="Your watchlist lives in your account"
          description="Sign in to track products and keep the list across every device you use."
          action={
            <Link to="/account" className="no-underline">
              <Button variant="primary">Sign in</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">Watchlist</h1>
          <p className="text-help mt-0.5 text-ink-3">
            {items.length} tracked · {items.filter((item) => item.targetMet).length} at or below
            target
          </p>
        </div>
        <Link to="/search" className="no-underline">
          <Button variant="primary" size="md">
            <SearchIcon className="h-4 w-4" aria-hidden="true" />
            Track another
          </Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bookmark}
            title="Nothing tracked yet"
            description="Find a product, set the price you would pay, and we'll watch every retailer for you."
            action={
              <Link to="/search" className="no-underline">
                <Button variant="primary">Find a product</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Filters, in one row above the data. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-3.5 sm:p-4">
            <Field
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by name…"
              aria-label="Filter watchlist by product name"
              icon={SearchIcon}
              className="min-w-48 flex-1"
              inputClassName="h-10"
            />
            <Segmented value={filter} onChange={setFilter} options={FILTERS} label="Filter" />
            <label className="flex items-center gap-2">
              <span className="sr-only">Sort by</span>
              <ArrowUpDown className="h-4 w-4 text-muted" aria-hidden="true" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-10 rounded-xl bg-surface-2 px-3 text-[13px] font-medium text-ink-2 outline-none focus:ring-2 focus:ring-primary"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="No products match those filters"
              description="Try clearing the search box or switching back to “All”."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          ) : (
            <>
              {/* Phones: cards */}
              <ul className="divide-y divide-border lg:hidden">
                {pageRows.map((item) => (
                  <li key={item.watch.id} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <Link to={`/product/${item.product.id}`} className="shrink-0">
                        <ProductImage product={item.product} className="h-14 w-14" rounded="rounded-lg" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/product/${item.product.id}`}
                          className="line-clamp-2 text-[13.5px] font-semibold text-ink no-underline"
                        >
                          {item.product.title}
                        </Link>
                        <p className="text-help mt-0.5 text-muted">
                          {item.bestOffer ? `Cheapest at ${item.bestOffer.retailer}` : 'No offers'}
                        </p>
                        <RowBadges item={item} />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-[15px] font-bold text-ink">
                          {money(item.bestOffer?.totalCents)}
                        </p>
                        {item.stats?.avgCents != null && (
                          <p className="text-help tabular text-muted">
                            avg {money(item.stats.avgCents)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={removing === item.watch.id}
                        onClick={() => stopTracking(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden lg:block">
                <table className="w-full text-left">
                  <thead className="sticky top-16 z-10 bg-surface-2">
                    <tr className="text-label text-muted">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Product</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Cheapest at</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Current</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">90d low</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Target</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Updated</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageRows.map((item) => (
                      <tr
                        key={item.watch.id}
                        className="group transition-colors hover:bg-surface-2"
                      >
                        <th scope="row" className="px-5 py-3 font-normal">
                          <Link
                            to={`/product/${item.product.id}`}
                            className="flex items-center gap-3 no-underline"
                          >
                            <ProductImage
                              product={item.product}
                              className="h-10 w-10 shrink-0"
                              rounded="rounded-lg"
                            />
                            <span className="min-w-0">
                              <span className="line-clamp-1 block text-[13.5px] font-semibold text-ink">
                                {item.product.title}
                              </span>
                              {item.product.brand && (
                                <span className="text-help block text-muted">{item.product.brand}</span>
                              )}
                            </span>
                          </Link>
                        </th>
                        <td className="px-3 py-3 text-[13px] text-ink-2">
                          {item.bestOffer?.retailer ?? '—'}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-[13.5px] font-bold text-ink">
                          {money(item.bestOffer?.totalCents)}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-[13px] text-ink-2">
                          {money(item.stats?.minCents)}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-[13px] text-ink-2">
                          {item.watch.targetPriceCents ? money(item.watch.targetPriceCents) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <RowBadges item={item} />
                        </td>
                        <td className="px-3 py-3 text-help whitespace-nowrap text-muted">
                          {relativeTime(item.product.lastRefreshedAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Stop tracking ${item.product.title}`}
                            loading={removing === item.watch.id}
                            onClick={() => stopTracking(item)}
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <p className="text-help text-muted">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of{' '}
                    {visible.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Previous page"
                      disabled={page === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="text-help tabular px-2 text-ink-2">
                      {page} / {pageCount}
                    </span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Next page"
                      disabled={page === pageCount}
                      onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function RowBadges({ item }) {
  const badges = [];
  if (item.targetMet) badges.push(<Badge key="t" tone="success" icon={Check}>Target met</Badge>);
  if (item.stats?.hasRecentDrop) {
    badges.push(
      <Badge key="d" tone="success" icon={ArrowDown}>
        {item.stats.recentDropPercent}%
      </Badge>,
    );
  }
  if (badges.length === 0 && item.stats?.isBelowAverage) {
    badges.push(<Badge key="a">Below average</Badge>);
  }
  if (badges.length === 0) badges.push(<Badge key="w">Watching</Badge>);
  return <div className="mt-1.5 flex flex-wrap gap-1.5 lg:mt-0">{badges}</div>;
}

function TableSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-40" />
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
