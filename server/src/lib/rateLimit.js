/**
 * Small fixed-window rate limiter — no dependency, no shared store.
 *
 * Its job is cost control, not security: search hits paid provider APIs, and
 * one stuck client retrying in a loop can burn a month's quota in minutes. For
 * multi-instance deployments, swap the Map for Redis.
 */
const WINDOW_MS = 60_000;

export function rateLimit({ max, windowMs = WINDOW_MS, message }) {
  const hits = new Map();

  // Drop expired buckets periodically so the Map cannot grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return function limiter(req, res, next) {
    if (max <= 0) return next();

    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let bucket = hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(remaining));
    res.set('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        error: message ?? 'Too many requests — try again in a minute.',
      });
    }

    return next();
  };
}
