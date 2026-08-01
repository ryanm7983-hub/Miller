import { hash } from '../lib/ids.js';

const NOISE_WORDS = new Set([
  'the', 'and', 'with', 'for', 'new', 'model', 'inch', 'in', 'of', 'a', 'an',
  'wireless', 'bluetooth', 'edition', 'gen', 'generation', 'color', 'colour',
]);

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/** Compact, comparable form of a product title. */
export function titleKey(title) {
  const tokens = String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !NOISE_WORDS.has(t));
  return tokens.slice(0, 8).join('-');
}

/**
 * The key used to decide whether two provider results describe the same
 * product. UPC wins when present, then brand+model, then the title.
 */
export function matchKey(match) {
  const upc = String(match.upc ?? '').replace(/\D/g, '');
  if (upc.length >= 8) return `upc:${upc}`;
  if (match.brand && match.model) return `bm:${slugify(`${match.brand} ${match.model}`)}`;
  return `t:${titleKey(match.title)}`;
}

/**
 * Deterministic, stable public product id. Deriving it from the match key
 * (rather than a random uuid) means the same item searched twice — or found via
 * two different providers — resolves to the same tracked product.
 */
export function productIdFor(key) {
  return `ps_${hash(key).slice(0, 16)}`;
}
