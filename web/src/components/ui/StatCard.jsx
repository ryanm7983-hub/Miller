import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, Skeleton } from './Primitives.jsx';

/**
 * A single headline number. The sparkline is decoration for the trend the
 * number already states, so it carries no axis and no tooltip — the chart on
 * the product page is where you go to read values.
 */
export function Sparkline({ values = [], tone = 'primary', className = 'h-8 w-24' }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stroke = tone === 'success' ? 'var(--ps-success)' : 'var(--ps-primary)';

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 28 - ((value - min) / span) * 24 - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const id = `spark-${tone}-${values.length}-${Math.round(values[0])}`;

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${points.join(' ')} 100,28`} fill={`url(#${id})`} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  trendTone,
  sparkline,
  sparklineTone = 'primary',
  loading = false,
}) {
  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="mt-3 h-3 w-20" />
        <Skeleton className="mt-2 h-7 w-24" />
      </Card>
    );
  }

  // Falling prices are good news here, so the tone is passed in rather than
  // inferred from the sign.
  const TrendIcon = trendTone === 'down' ? TrendingDown : TrendingUp;
  const trendClass =
    trendTone === 'good'
      ? 'text-success-text'
      : trendTone === 'bad'
        ? 'text-danger-text'
        : 'text-ink-3';

  return (
    <Card className="group relative overflow-hidden p-4 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-wash text-primary">
          {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
        </span>
        {sparkline && <Sparkline values={sparkline} tone={sparklineTone} />}
      </div>

      <p className="text-label mt-3 text-muted">{label}</p>
      <p className="tabular mt-0.5 text-[26px] leading-8 font-bold tracking-tight text-ink">
        {value}
      </p>

      {(trend || hint) && (
        <div className="mt-1 flex items-center gap-1.5">
          {trend && (
            <span className={`inline-flex items-center gap-1 text-[12.5px] font-semibold ${trendClass}`}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {trend}
            </span>
          )}
          {hint && <span className="text-help text-muted">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
