import { InfoIcon } from './Icons.jsx';

/**
 * Honest labelling of where the numbers came from. PriceScout ships with a
 * sample-data provider, and it must never be mistaken for live pricing.
 */
export function DataSourceNotice({ providers = [], usingMockData, className = '' }) {
  if (!providers.length) return null;

  const live = providers.filter((p) => p.live);
  const scrapers = providers.filter((p) => p.scraping);

  if (usingMockData) {
    return (
      <div
        className={`flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-2 ring-1 ring-line ${className}`}
      >
        <InfoIcon className="mt-px h-4 w-4 shrink-0 text-muted" />
        <p>
          <span className="font-semibold text-ink">Sample data.</span> Prices, retailers and
          history on this screen are generated for demonstration — no live retailer data is being
          used. Add a provider API key (<code className="tabular">PRICE_PROVIDERS</code> in{' '}
          <code>server/.env</code>) to switch to real prices.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted ${className}`}>
      <span>Live data via {live.map((p) => p.label).join(', ')}</span>
      {scrapers.length > 0 && (
        <span className="chip bg-surface-2 text-ink-2">
          {scrapers.map((p) => p.label).join(', ')} uses scraping
        </span>
      )}
    </div>
  );
}

/** Small inline badge for a single mock-sourced value. */
export function MockBadge({ className = '' }) {
  return (
    <span className={`chip bg-surface-2 text-ink-2 ring-1 ring-line ${className}`}>
      sample data
    </span>
  );
}
