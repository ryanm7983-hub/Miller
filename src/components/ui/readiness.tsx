import { cn } from '@/lib/utils';
import { RISK_LEVEL_META, type RiskLevel } from '@/lib/enums';
import { Badge } from './badge';

function scoreTone(score: number) {
  if (score >= 80) return { stroke: 'stroke-strong-500', text: 'text-strong-600' };
  if (score >= 55) return { stroke: 'stroke-caution-500', text: 'text-caution-600' };
  return { stroke: 'stroke-risk-500', text: 'text-risk-600' };
}

export function scoreVerdict(score: number): string {
  if (score >= 90) return 'Audit ready';
  if (score >= 75) return 'Nearly ready';
  if (score >= 55) return 'Work to do';
  if (score >= 30) return 'Significant gaps';
  return 'Early stage';
}

/**
 * The headline readiness gauge. Rendered as inline SVG so it prints cleanly in
 * reports and needs no client-side charting library.
 */
export function ReadinessRing({
  score,
  size = 168,
  strokeWidth = 12,
  label = 'Audit readiness',
  riskLevel,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  riskLevel?: RiskLevel;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tone = scoreTone(clamped);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-ink-100"
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={cn(tone.stroke, 'transition-[stroke-dashoffset] duration-700 ease-out')}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('tnum font-bold leading-none', tone.text)}
            style={{ fontSize: size * 0.28 }}
          >
            {clamped}
            <span style={{ fontSize: size * 0.14 }}>%</span>
          </span>
          <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
            {scoreVerdict(clamped)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-500">{label}</span>
        {riskLevel && (
          <Badge tone={RISK_LEVEL_META[riskLevel].tone} dot>
            {RISK_LEVEL_META[riskLevel].label} audit risk
          </Badge>
        )}
      </div>
    </div>
  );
}

/** Compact inline readiness bar for list rows and client tables. */
export function ReadinessBar({ score, className }: { score: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const fill =
    clamped >= 80 ? 'bg-strong-500' : clamped >= 55 ? 'bg-caution-500' : 'bg-risk-500';
  const text =
    clamped >= 80 ? 'text-strong-600' : clamped >= 55 ? 'text-caution-600' : 'text-risk-600';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="h-1.5 w-full min-w-[56px] max-w-[120px] overflow-hidden rounded-full bg-ink-100">
        <div className={cn('h-full rounded-full transition-all', fill)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn('tnum shrink-0 text-[13px] font-semibold', text)}>{clamped}%</span>
    </div>
  );
}
