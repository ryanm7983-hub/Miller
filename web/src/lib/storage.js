/**
 * Search history and recently-viewed products live in localStorage: they are
 * per-device conveniences, they survive offline, and they need no account.
 * (The watchlist, which must follow the user across devices, is server-side.)
 */
const SEARCHES_KEY = 'pricescout.recentSearches';
const VIEWED_KEY = 'pricescout.recentlyViewed';
const MAX_SEARCHES = 8;
const MAX_VIEWED = 12;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — recents are non-essential */
  }
}

export function getRecentSearches() {
  const value = read(SEARCHES_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function addRecentSearch(query) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return getRecentSearches();
  const next = [trimmed, ...getRecentSearches().filter((q) => q !== trimmed)].slice(0, MAX_SEARCHES);
  write(SEARCHES_KEY, next);
  return next;
}

export function clearRecentSearches() {
  write(SEARCHES_KEY, []);
  return [];
}

export function getRecentlyViewed() {
  const value = read(VIEWED_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function addRecentlyViewed(product) {
  if (!product?.id) return getRecentlyViewed();
  const entry = {
    id: product.id,
    title: product.title,
    imageUrl: product.imageUrl ?? null,
    brand: product.brand ?? null,
    viewedAt: new Date().toISOString(),
  };
  const next = [entry, ...getRecentlyViewed().filter((p) => p.id !== product.id)].slice(0, MAX_VIEWED);
  write(VIEWED_KEY, next);
  return next;
}
