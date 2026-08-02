/**
 * Retailer identity.
 *
 * A retailer's colour is fixed to the retailer, not to its rank in the current
 * list — so Walmart is the same hue in the comparison table, in its badge and
 * on the history chart, and filtering or changing the date range never repaints
 * anything. The eight slots are the validated categorical palette.
 */
const KNOWN = [
  'Amazon',
  'Walmart',
  'Target',
  'Best Buy',
  'eBay',
  'B&H Photo',
  'Newegg',
  'Costco',
];

const SLOTS = 8;

function normalize(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\.(com|co\.uk|ca)$/, '')
    .replace(/[^a-z0-9& ]/g, '')
    .trim();
}

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 1-8. Known retailers get a fixed slot; anything a live provider returns that
 * we don't know is hashed into a slot, which is still stable per retailer.
 */
export function retailerSlot(name) {
  const normalized = normalize(name);
  const index = KNOWN.findIndex((known) => normalize(known) === normalized);
  if (index >= 0) return index + 1;
  return (hash(normalized) % SLOTS) + 1;
}

export function retailerColor(name) {
  return `var(--ps-series-${retailerSlot(name)})`;
}

/** Up to two letters for the badge — "B&H Photo" → "BH", "Amazon" → "Am". */
export function retailerInitials(name) {
  const words = String(name ?? '?')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const word = words[0] ?? '?';
  return (word[0] + (word[1] ?? '')).replace(/^./, (c) => c.toUpperCase());
}

export { KNOWN as KNOWN_RETAILERS };
