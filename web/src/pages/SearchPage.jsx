import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { DataSourceNotice } from '../components/DataSourceNotice.jsx';
import { ArrowDownIcon, CheckIcon, SearchIcon, Spinner } from '../components/Icons.jsx';
import { money } from '../lib/format.js';
import { api } from '../lib/api.js';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  getRecentlyViewed,
} from '../lib/storage.js';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [recents, setRecents] = useState(getRecentSearches);
  const [viewed, setViewed] = useState(getRecentlyViewed);
  const [providers, setProviders] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    setViewed(getRecentlyViewed());
  }, [query]);

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
      });

    return () => controller.abort();
  }, [query]);

  const runSearch = useCallback(
    (value) => {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) return;
      setParams({ q: trimmed });
    },
    [setParams],
  );

  const results = state.data?.results ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="mb-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Find the cheapest place to buy it
        </h1>
        <SearchBar
          value={input}
          onChange={setInput}
          onSearch={runSearch}
          busy={state.status === 'loading'}
          autoFocus={!query}
        />
        <p className="mt-2 text-xs text-muted">
          Type a product name, paste a retailer link, or tap the camera to scan a barcode.
        </p>
      </div>

      {providers && (
        <DataSourceNotice
          providers={providers.providers}
          usingMockData={providers.usingMockData}
        />
      )}

      {state.status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Spinner /> Checking retailers…
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="card p-4 text-sm text-critical">
          {state.error}
        </p>
      )}

      {state.status === 'done' && results.length === 0 && (
        <p className="card p-6 text-center text-sm text-muted">
          No products matched “{query}”. Try a brand and model, or paste the product link.
        </p>
      )}

      {results.length > 0 && (
        <section aria-label="Search results" className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </h2>
          <ul className="space-y-3">
            {results.map((result) => (
              <ResultCard key={result.product.id} result={result} />
            ))}
          </ul>
        </section>
      )}

      {!query && (
        <>
          {recents.length > 0 && (
            <section aria-labelledby="recent-searches">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="recent-searches" className="text-sm font-semibold text-ink-2">
                  Recent searches
                </h2>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-ink"
                  onClick={() => setRecents(clearRecentSearches())}
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recents.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => runSearch(term)}
                      className="chip bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
                    >
                      <SearchIcon className="h-3.5 w-3.5" />
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {viewed.length > 0 && (
            <section aria-labelledby="recently-viewed">
              <h2 id="recently-viewed" className="mb-2 text-sm font-semibold text-ink-2">
                Recently viewed
              </h2>
              <ul className="space-y-2">
                {viewed.map((product) => (
                  <li key={product.id}>
                    <Link
                      to={`/product/${product.id}`}
                      className="card flex items-center gap-3 p-3 transition-colors hover:bg-surface-2"
                    >
                      <ProductImage product={product} className="h-12 w-12" />
                      <span className="line-clamp-2 text-sm font-medium text-ink">
                        {product.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recents.length === 0 && viewed.length === 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Try one of these</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {['Sony WH-1000XM5', 'AirPods Pro', 'Nintendo Switch OLED', 'Dyson V15', '045496882730'].map(
                  (example) => (
                    <li key={example}>
                      <button
                        type="button"
                        onClick={() => runSearch(example)}
                        className="chip bg-surface-2 text-ink-2 hover:text-ink"
                      >
                        {example}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ResultCard({ result }) {
  const { product, bestOffer, offerCount, stats } = result;
  return (
    <li>
      <Link
        to={`/product/${product.id}`}
        className="card flex items-start gap-3.5 p-3 transition-colors hover:bg-surface-2 sm:gap-4 sm:p-4"
      >
        <ProductImage product={product} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />

        <div className="min-w-0 flex-1">
          {product.brand && (
            <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">
              {product.brand}
            </p>
          )}
          <p className="line-clamp-2 text-sm font-semibold text-ink sm:text-base">{product.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {offerCount} {offerCount === 1 ? 'retailer' : 'retailers'}
            {bestOffer ? ` · cheapest at ${bestOffer.retailer}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {stats?.isAllTimeLow && (
              <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
                <CheckIcon className="h-3.5 w-3.5" />
                All-time low
              </span>
            )}
            {stats?.hasRecentDrop && (
              <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
                <ArrowDownIcon className="h-3.5 w-3.5" />
                {stats.recentDropPercent}% this week
              </span>
            )}
            {product.isMock && (
              <span className="chip bg-surface-2 text-muted ring-1 ring-line">sample data</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="tabular text-base font-bold text-ink sm:text-xl">
            {money(bestOffer?.totalCents)}
          </p>
          <p className="text-[10px] text-muted">total</p>
        </div>
      </Link>
    </li>
  );
}
