import { ArrowDownIcon, CheckIcon, TrendIcon } from './Icons.jsx';
import { money } from '../lib/format.js';

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="tabular mt-0.5 text-base font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Headline price plus the window's min/avg/max. Status flags always pair an
 * icon with a label, so meaning never rides on colour alone.
 */
export function PriceStats({ stats, bestOffer, days }) {
  if (!stats) return null;

  return (
    <section className="card p-4 sm:p-5" aria-label="Price summary">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Best price right now</p>
          <p className="tabular text-3xl font-bold text-ink">
            {money(stats.currentBestTotalCents)}
          </p>
          {bestOffer && (
            <p className="mt-0.5 text-sm text-ink-2">
              at {bestOffer.retailer}
              {bestOffer.shippingCents === 0 ? ' · free shipping' : ` · +${money(bestOffer.shippingCents)} shipping`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stats.isAllTimeLow && (
            <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
              <CheckIcon className="h-3.5 w-3.5" />
              All-time low
            </span>
          )}
          {stats.hasRecentDrop && (
            <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
              <ArrowDownIcon className="h-3.5 w-3.5" />
              Dropped {stats.recentDropPercent}% this week
            </span>
          )}
          {stats.isBelowAverage && !stats.isAllTimeLow && (
            <span className="chip bg-surface-2 text-ink-2 ring-1 ring-line">
              <TrendIcon className="h-3.5 w-3.5" />
              {stats.percentBelowAverage}% below average
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile label={`${days}d low`} value={money(stats.minCents)} />
        <Tile label={`${days}d avg`} value={money(stats.avgCents)} />
        <Tile label={`${days}d high`} value={money(stats.maxCents)} />
      </div>
    </section>
  );
}
