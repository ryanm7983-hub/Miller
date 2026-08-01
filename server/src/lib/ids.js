import crypto from 'node:crypto';

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

/** Stable hash used for deterministic product ids and mock price seeds. */
export function hash(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

/**
 * Deterministic 32-bit unsigned integer from a string — the seed for the mock
 * provider's pseudo-random walks, so the same product always renders the same
 * sample history.
 */
export function seedFrom(str) {
  return parseInt(hash(str).slice(0, 8), 16) >>> 0;
}

/** Mulberry32: tiny seeded PRNG, returns a function producing floats in [0,1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
