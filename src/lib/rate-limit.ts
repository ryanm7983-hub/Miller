import 'server-only';

/**
 * In-process sliding-window rate limiter.
 *
 * Adequate for a single-node deployment and for blunting credential-stuffing
 * and AI-cost abuse in development. For multi-instance production, swap the
 * `buckets` map for Redis/Upstash behind this same `consume()` signature.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 3_600_000) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export const LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 10 * 60_000 },
  aiAnalysis: { limit: 40, windowMs: 10 * 60_000 },
  aiHeavy: { limit: 12, windowMs: 10 * 60_000 },
  download: { limit: 200, windowMs: 10 * 60_000 },
  search: { limit: 120, windowMs: 60_000 },
} as const;
