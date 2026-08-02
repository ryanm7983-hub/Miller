import { ArrowDown, Check, TrendingDown } from 'lucide-react';
import { Card, Badge } from './ui/Primitives.jsx';
import { money } from '../lib/format.js';

function Tile({ label, value, emphasis = false }) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${
        emphasis ? 'bg-success-wash ring-1 ring-inset ring-success-border' : 'bg-surface-2'
      }`}
    >
      <p className="text-label text-muted">{label}</p>
      <p
        className={`tabular mt-0.5 text-[15px] font-bold ${
          emphasis ? 'text-success-text' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Headline price plus the window's low / average / high. Every status flag
 * pairs an icon with a label, so meaning never rides on colour alone.
 */
export function PriceStats({ stats, bestOffer, days }) {
  if (!stats) return null;

  return (
    <Card className="p-4 sm:p-5" aria-label="Price summary">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label text-muted">Best price right now</p>
          <p className="tabular mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
            {money(stats.currentBestTotalCents)}
          </p>
          {bestOffer && (
            <p className="mt-2 text-[13px] text-ink-2">
              at <span className="font-semibold text-ink">{bestOffer.retailer}</span>
              {bestOffer.shippingCents === 0
                ? ' · free shipping'
                : ` · +${money(bestOffer.shippingCents)} shipping`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stats.isAllTimeLow && (
            <Badge tone="success" icon={Check}>
              All-time low
            </Badge>
          )}
          {stats.hasRecentDrop && (
            <Badge tone="success" icon={ArrowDown}>
              Dropped {stats.recentDropPercent}% this week
            </Badge>
          )}
          {stats.isBelowAverage && !stats.isAllTimeLow && (
            <Badge icon={TrendingDown}>{stats.percentBelowAverage}% below average</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile
          label={`${days}d low`}
          value={money(stats.minCents)}
          emphasis={stats.currentBestTotalCents != null && stats.currentBestTotalCents <= stats.minCents}
        />
        <Tile label={`${days}d average`} value={money(stats.avgCents)} />
        <Tile label={`${days}d high`} value={money(stats.maxCents)} />
      </div>
    </Card>
  );
}
