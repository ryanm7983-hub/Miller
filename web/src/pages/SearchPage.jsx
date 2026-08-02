import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  Camera,
  Check,
  Search as SearchIcon,
  SearchX,
  Sparkles,
  X,
} from 'lucide-react';
import { Card, Badge, EmptyState, Skeleton } from '../components/ui/Primitives.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { money } from '../lib/format.js';
import { api } from '../lib/api.js';
import { decodeBarcodeFromFile } from '../lib/barcode.js';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../lib/storage.js';

const EXAMPLES = ['Sony WH-1000XM5', 'AirPods Pro', 'Nintendo Switch OLED', 'Dyson V15', '045496882730'];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [recents, setRecents] = useState(getRecentSearches);
  const [providers, setProviders] = useState(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    setInput(query);
    if (!query) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({ ...current, status: 'loading', error: null }));

    api
      .search(query, controller.signal)
      .then((data) => {
        setState({ status: 'done', data, error: null });
        setRecents(addRecentSearch(query));
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', data: null, error: error.message });
        toast.error("That search didn't work", error.message);
      });

    return () => controller.abort();
  }, [query, toast]);

  const runSearch = useCallback(
    (value) => {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) return;
      setParams({ q: trimmed });
    },
    [setParams],
  );

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setScanning(true);
    try {
      const code = await decodeBarcodeFromFile(file);
      setInput(code);
      runSearch(code);
      toast.success('Barcode scanned', code);
    } catch (error) {
      toast.error("Couldn't read that barcode", error.message);
    } finally {
      setScanning(false);
    }
  }

  const results = state.data?.results ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title text-ink">Search</h1>
        <p className="text-help mt-0.5 text-ink-3">
          Type a product name, paste a retailer link, or scan a barcode.
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(input);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={input}
              autoFocus={!query}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Product name, link, or barcode"
              aria-label="Search for a product by name, link or barcode"
              className="h-12 w-full rounded-xl bg-surface-2 pr-10 pl-11 text-[15px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-primary"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => fileRef.current?.click()}
              loading={scanning}
              aria-label="Scan or upload a barcode photo"
              className="px-4"
            >
              <Camera className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="sm:hidden">Scan barcode</span>
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!input.trim()}
              loading={state.status === 'loading'}
              className="flex-1 sm:flex-none"
            >
              Search
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
        </form>

        {providers && (
          <DataSourceNotice
            providers={providers.providers}
            usingMockData={providers.usingMockData}
            className="mt-4"
          />
        )}
      </Card>

      {state.status === 'loading' && <ResultsSkeleton />}

      {state.status === 'error' && (
        <Card>
          <EmptyState
            icon={SearchX}
            title="That search didn't go through"
            description={state.error}
            action={
              <Button variant="secondary" onClick={() => runSearch(query)}>
                Try again
              </Button>
            }
          />
        </Card>
      )}

      {state.status === 'done' && results.length === 0 && (
        <Card>
          <EmptyState
            icon={SearchX}
            title={`Nothing matched “${query}”`}
            description="Try a brand and model together, or paste the product link straight from the retailer."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.slice(0, 3).map((example) => (
                  <Button key={example} variant="secondary" size="sm" onClick={() => runSearch(example)}>
                    {example}
                  </Button>
                ))}
              </div>
            }
          />
        </Card>
      )}

      {results.length > 0 && (
        <section aria-label="Search results" className="space-y-3">
          <p className="text-help text-ink-3">
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </p>
          <ul className="space-y-3">
            {results.map((result, index) => (
              <li
                key={result.product.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
              >
                <ResultCard result={result} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!query && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 sm:p-5">
            <h2 className="text-section text-ink">Try one of these</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <Button variant="secondary" size="sm" onClick={() => runSearch(example)}>
                    <Sparkles className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          {recents.length > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-section text-ink">Recent searches</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRecents(clearRecentSearches());
                    toast.info('Recent searches cleared');
                  }}
                >
                  Clear
                </Button>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {recents.map((term) => (
                  <li key={term}>
                    <Button variant="secondary" size="sm" onClick={() => runSearch(term)}>
                      <SearchIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {term}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result }) {
  const { product, bestOffer, offerCount, stats } = result;
  return (
    <Card interactive className="overflow-hidden">
      <Link
        to={`/product/${product.id}`}
        className="flex items-start gap-3.5 p-3.5 no-underline sm:gap-4 sm:p-4"
      >
        <ProductImage product={product} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />

        <div className="min-w-0 flex-1">
          {product.brand && <p className="text-label text-muted">{product.brand}</p>}
          <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-snug font-semibold text-ink sm:text-[15.5px]">
            {product.title}
          </p>
          <p className="text-help mt-1 text-ink-3">
            {offerCount} {offerCount === 1 ? 'retailer' : 'retailers'}
            {bestOffer ? ` · cheapest at ${bestOffer.retailer}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats?.isAllTimeLow && (
              <Badge tone="success" icon={Check}>
                All-time low
              </Badge>
            )}
            {stats?.hasRecentDrop && (
              <Badge tone="success" icon={ArrowDown}>
                {stats.recentDropPercent}% this week
              </Badge>
            )}
            {product.isMock && <Badge>sample data</Badge>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="tabular text-[17px] leading-tight font-bold text-ink sm:text-xl">
            {money(bestOffer?.totalCents)}
          </p>
          <p className="text-help text-muted">total</p>
        </div>
      </Link>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="flex items-start gap-4 p-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24" />
          <div className="flex-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-3 h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-20" />
        </Card>
      ))}
    </div>
  );
}
