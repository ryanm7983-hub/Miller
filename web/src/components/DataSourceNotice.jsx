import { Info } from 'lucide-react';
import { Badge } from './ui/Primitives.jsx';

/**
 * Honest labelling of where the numbers came from. PriceScout ships with a
 * sample-data provider, and it must never be mistaken for live pricing.
 */
export function DataSourceNotice({ providers = [], usingMockData, className = '' }) {
  if (!providers.length) return null;

  const live = providers.filter((provider) => provider.live);
  const scrapers = providers.filter((provider) => provider.scraping);

  if (usingMockData) {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-xl bg-warning-wash p-3 ring-1 ring-inset ring-warning/25 ${className}`}
      >
        <Info className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-help text-ink-2">
          <span className="font-semibold text-ink">Sample data.</span> Prices, retailers and history
          here are generated for demonstration — no live retailer data is in use. Set{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11.5px]">PRICE_PROVIDERS</code> in{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11.5px]">server/.env</code> to
          switch to real prices.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-help text-muted">
        Live data via {live.map((provider) => provider.label).join(', ')}
      </span>
      {scrapers.length > 0 && (
        <Badge tone="warning">
          {scrapers.map((provider) => provider.label).join(', ')} uses scraping
        </Badge>
      )}
    </div>
  );
}
