import { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { longDate, money, moneyShort, shortDate } from '../lib/format.js';

const RANGES = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
];

/** Validated categorical slots, assigned to retailers in fixed order. */
const SERIES_SLOTS = [
  'var(--ps-series-1)',
  'var(--ps-series-2)',
  'var(--ps-series-3)',
  'var(--ps-series-4)',
  'var(--ps-series-5)',
  'var(--ps-series-6)',
  'var(--ps-series-7)',
  'var(--ps-series-8)',
];
const MAX_SERIES = SERIES_SLOTS.length;

/**
 * Colour follows the retailer, never its rank: once a retailer has a slot it
 * keeps it, so changing the date range or hiding a series never repaints the
 * others.
 */
function useRetailerColors(retailers) {
  const assigned = useRef(new Map());
  return useMemo(() => {
    const map = assigned.current;
    for (const retailer of [...retailers].sort()) {
      if (!map.has(retailer) && map.size < MAX_SERIES) {
        map.set(retailer, SERIES_SLOTS[map.size]);
      }
    }
    return new Map(map);
  }, [retailers]);
}

const NICE_STEPS_CENTS = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 25_000, 50_000];

/**
 * Keeps the plot filled by the data (the domain stays where the prices are)
 * while labelling it at human price steps — $300, $325, $350…
 */
function niceScale(min, max, targetTicks = 4) {
  const low = Math.max(0, Math.floor(min));
  const high = Math.ceil(max);
  const span = Math.max(high - low, 1);
  const step =
    NICE_STEPS_CENTS.find((candidate) => span / candidate <= targetTicks) ??
    Math.ceil(span / targetTicks / 100_000) * 100_000;
  const ticks = [];
  for (let value = Math.ceil(low / step) * step; value <= high; value += step) ticks.push(value);
  return { min: low, max: high, ticks };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((entry) => entry.value != null)
    .sort((a, b) => a.value - b.value);

  return (
    <div className="min-w-44 rounded-xl bg-surface p-3 text-xs shadow-lg ring-1 ring-line">
      <p className="mb-2 font-semibold text-ink">{longDate(label)}</p>
      <ul className="space-y-1">
        {rows.map((entry, index) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.stroke }}
              />
              {entry.name}
            </span>
            <span className={`tabular ${index === 0 ? 'font-semibold text-ink' : 'text-ink-2'}`}>
              {money(entry.value)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">Total incl. shipping</p>
    </div>
  );
}

function DashSwatch({ color }) {
  return (
    <svg width="16" height="4" aria-hidden="true">
      <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  );
}

function Legend({ items }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ rows, columns }) {
  return (
    <div className="mt-4 max-h-72 overflow-auto rounded-xl ring-1 ring-line">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Price history data</caption>
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Date</th>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-3 py-2 text-right font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.date}>
              <th scope="row" className="px-3 py-1.5 font-normal whitespace-nowrap text-ink-2">
                {longDate(row.date)}
              </th>
              {columns.map((column) => (
                <td key={column} className="tabular px-3 py-1.5 text-right text-ink">
                  {row[column] == null ? '—' : money(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Price over time. Defaults to the blended best price (one series, no legend
 * needed) with a per-retailer breakdown a tap away.
 */
export function PriceHistoryChart({
  history,
  stats,
  days,
  onDaysChange,
  targetPriceCents = null,
  loading = false,
}) {
  const [byRetailer, setByRetailer] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const retailers = useMemo(
    () => (history?.retailers ?? []).slice(0, MAX_SERIES),
    [history?.retailers],
  );
  const colors = useRetailerColors(retailers);

  const data = useMemo(() => {
    const series = history?.series ?? [];
    return series.map((point) => ({
      date: point.date,
      best: point.bestTotalCents,
      ...Object.fromEntries(retailers.map((retailer) => [retailer, point.retailers[retailer] ?? null])),
    }));
  }, [history?.series, retailers]);

  const { ticks, domain, yTicks, low } = useMemo(() => {
    if (data.length === 0) {
      return { ticks: [], domain: ['auto', 'auto'], yTicks: undefined, low: null };
    }
    const values = data.flatMap((point) =>
      byRetailer
        ? retailers.map((retailer) => point[retailer]).filter((v) => v != null)
        : [point.best],
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.12, max * 0.02);
    const scale = niceScale(min - pad, max + pad);

    const tickCount = Math.min(6, data.length);
    const step = Math.max(1, Math.floor((data.length - 1) / Math.max(1, tickCount - 1)));
    const picked = [];
    for (let i = 0; i < data.length; i += step) picked.push(data[i].date);
    if (picked.at(-1) !== data.at(-1).date) picked.push(data.at(-1).date);

    const lowestIndex = data.reduce(
      (best, point, index) => (point.best != null && point.best < data[best].best ? index : best),
      0,
    );

    return {
      ticks: picked,
      domain: [scale.min, scale.max],
      yTicks: scale.ticks,
      low: { index: lowestIndex, ...data[lowestIndex] },
    };
  }, [data, byRetailer, retailers]);

  const legendItems = byRetailer
    ? retailers.map((retailer) => ({ name: retailer, color: colors.get(retailer) }))
    : [];

  const hasData = data.length > 1;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="history-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="history-heading" className="text-base font-semibold text-ink">
            {byRetailer ? 'Price by retailer' : 'Best price over time'}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Total including shipping{history?.containsSyntheticData ? ' · includes sample history' : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => onDaysChange(range.days)}
              aria-pressed={days === range.days}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === range.days ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="py-12 text-center text-sm text-muted">
          {loading ? 'Loading price history…' : 'Not enough history yet — check back after the next price refresh.'}
        </p>
      ) : (
        <>
          <div className="mt-4 h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ps-line)" strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--ps-baseline)' }}
                  tick={{ fill: 'var(--ps-muted)', fontSize: 11 }}
                  minTickGap={12}
                />
                <YAxis
                  domain={domain}
                  ticks={yTicks}
                  tickFormatter={moneyShort}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fill: 'var(--ps-muted)', fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'var(--ps-baseline)', strokeWidth: 1 }}
                />

                {/* Threshold rules are keyed below the plot, not labelled
                    inline, so nothing collides with the series on a phone. */}
                {stats?.avgCents != null && !byRetailer && (
                  <ReferenceLine y={stats.avgCents} stroke="var(--ps-muted)" strokeDasharray="4 4" />
                )}

                {targetPriceCents != null && (
                  <ReferenceLine y={targetPriceCents} stroke="var(--ps-good)" strokeDasharray="4 4" />
                )}

                {byRetailer ? (
                  retailers.map((retailer) => (
                    <Line
                      key={retailer}
                      type="monotone"
                      dataKey={retailer}
                      name={retailer}
                      stroke={colors.get(retailer)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--ps-surface)' }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey="best"
                    name="Best price"
                    stroke="var(--ps-series-1)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--ps-surface)' }}
                    isAnimationActive={false}
                  />
                )}

                {!byRetailer && low && (
                  <ReferenceDot
                    x={low.date}
                    y={low.best}
                    r={4}
                    fill="var(--ps-series-1)"
                    stroke="var(--ps-surface)"
                    strokeWidth={2}
                    label={{
                      value: `low ${money(low.best)}`,
                      position: low.index > data.length * 0.75 ? 'left' : 'top',
                      fill: 'var(--ps-ink)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {legendItems.length > 0 && <Legend items={legendItems} />}

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {stats?.avgCents != null && !byRetailer && (
              <li className="flex items-center gap-1.5">
                <DashSwatch color="var(--ps-muted)" />
                {days}-day average {money(stats.avgCents)}
              </li>
            )}
            {targetPriceCents != null && (
              <li className="flex items-center gap-1.5 text-good-text">
                <DashSwatch color="var(--ps-good)" />
                Your target {money(targetPriceCents)}
              </li>
            )}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setByRetailer((value) => !value)}
              className="btn-secondary px-3 py-1.5 text-xs"
              aria-pressed={byRetailer}
            >
              {byRetailer ? 'Show blended best price' : 'Break down by retailer'}
            </button>
            <button
              type="button"
              onClick={() => setShowTable((value) => !value)}
              className="btn-ghost px-3 py-1.5 text-xs"
              aria-expanded={showTable}
            >
              {showTable ? 'Hide data table' : 'View as table'}
            </button>
          </div>

          {showTable && (
            <DataTable
              rows={[...data].reverse().map((point) => ({
                date: point.date,
                'Best price': point.best,
                ...Object.fromEntries(retailers.map((r) => [r, point[r]])),
              }))}
              columns={byRetailer ? retailers : ['Best price']}
            />
          )}
        </>
      )}
    </section>
  );
}
