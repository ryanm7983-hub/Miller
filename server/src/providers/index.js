import { config } from '../config.js';
import { MockProvider } from './MockProvider.js';
import { SerpApiProvider } from './SerpApiProvider.js';
import { RainforestProvider } from './RainforestProvider.js';
import { ProviderError } from './PriceProvider.js';
import { matchKey } from '../services/normalize.js';

const REGISTRY = {
  [MockProvider.providerName]: MockProvider,
  [SerpApiProvider.providerName]: SerpApiProvider,
  [RainforestProvider.providerName]: RainforestProvider,
};

/** @type {import('./PriceProvider.js').PriceProvider[]} */
const activeProviders = [];

for (const name of config.providers.enabled) {
  const Impl = REGISTRY[name];
  if (!Impl) {
    console.warn(`[providers] unknown provider "${name}" — ignoring`);
    continue;
  }
  const instance = new Impl();
  if (!instance.isConfigured()) {
    console.warn(
      `[providers] "${name}" is enabled but not configured (missing API key) — skipping`,
    );
    continue;
  }
  activeProviders.push(instance);
}

if (activeProviders.length === 0) {
  console.warn('[providers] no provider configured — falling back to mock sample data');
  activeProviders.push(new MockProvider());
}

console.log(
  `[providers] active: ${activeProviders.map((p) => `${p.name}${p.capabilities.live ? '' : ' (sample data)'}`).join(', ')}`,
);

export function getProviders() {
  return activeProviders;
}

export function getProvider(name) {
  return activeProviders.find((p) => p.name === name) ?? null;
}

export function providerInfo() {
  return activeProviders.map((p) => ({
    name: p.name,
    label: p.label,
    live: p.capabilities.live,
    scraping: Boolean(p.capabilities.scraping),
    capabilities: p.capabilities,
  }));
}

/** True when every active provider is sample data. */
export function isMockOnly() {
  return activeProviders.every((p) => !p.capabilities.live);
}

const BARCODE_RE = /^\s*\d{8,14}\s*$/;

/** Classifies raw search input so we call the right provider method. */
export function detectQueryKind(input) {
  const value = String(input ?? '').trim();
  if (!value) return 'empty';
  if (/^https?:\/\//i.test(value)) return 'url';
  if (BARCODE_RE.test(value)) return 'barcode';
  return 'text';
}

async function callProvider(provider, kind, value, opts) {
  switch (kind) {
    case 'url':
      return provider.capabilities.searchByUrl ? provider.searchByUrl(value) : [];
    case 'barcode':
      return provider.capabilities.searchByBarcode ? provider.searchByBarcode(value) : [];
    default:
      return provider.capabilities.searchByText ? provider.searchByText(value, opts) : [];
  }
}

/**
 * Fans a search out to every active provider and merges the results into one
 * list of candidate products. Matches are merged on UPC when available and on a
 * normalized title key otherwise, so the same item found by two providers
 * becomes a single row carrying both providers' offers.
 *
 * @returns {Promise<{ matches: any[], errors: {provider: string, message: string}[] }>}
 */
export async function searchProviders(query, { limit = 8 } = {}) {
  const kind = detectQueryKind(query);
  if (kind === 'empty') return { matches: [], errors: [], kind };

  const settled = await Promise.allSettled(
    activeProviders.map(async (provider) => ({
      provider,
      matches: await callProvider(provider, kind, String(query).trim(), { limit }),
    })),
  );

  const errors = [];
  const merged = new Map();

  for (const result of settled) {
    if (result.status === 'rejected') {
      const err = result.reason;
      const provider = err instanceof ProviderError ? err.provider : 'unknown';
      console.warn(`[providers] ${provider} search failed:`, err.message);
      errors.push({ provider: provider ?? 'unknown', message: err.message });
      continue;
    }
    const { provider, matches } = result.value;
    for (const match of matches) {
      if (!match?.title) continue;
      const key = matchKey(match);
      const existing = merged.get(key);
      if (existing) {
        existing.sources[provider.name] = {
          sourceId: match.sourceId,
          url: match.url ?? null,
          payload: match.payload ?? null,
        };
        existing.offers.push(
          ...(match.offers ?? []).map((o) => ({ ...o, source: provider.name })),
        );
        existing.upc ??= match.upc ?? null;
        existing.imageUrl ??= match.imageUrl ?? null;
        existing.brand ??= match.brand ?? null;
        existing.isMock = existing.isMock && !provider.capabilities.live;
      } else {
        merged.set(key, {
          key,
          title: match.title,
          brand: match.brand ?? null,
          model: match.model ?? null,
          upc: match.upc ?? null,
          imageUrl: match.imageUrl ?? null,
          category: match.category ?? null,
          isMock: !provider.capabilities.live,
          sources: {
            [provider.name]: {
              sourceId: match.sourceId,
              url: match.url ?? null,
              payload: match.payload ?? null,
            },
          },
          offers: (match.offers ?? []).map((o) => ({ ...o, source: provider.name })),
        });
      }
    }
  }

  return { matches: [...merged.values()].slice(0, limit), errors, kind };
}

/**
 * Re-quotes a tracked product across every provider that has an identity for it.
 * Keeps the cheapest offer per retailer.
 *
 * @param {object} product Row from `products`.
 * @param {Record<string, {sourceId: string, url?: string, payload?: any}>} refs
 */
export async function fetchOffers(product, refs = {}) {
  const usable = activeProviders.filter((p) => p.capabilities.offers);
  const settled = await Promise.allSettled(
    usable.map(async (provider) => ({
      provider,
      offers: await provider.getOffers(product, refs[provider.name]),
    })),
  );

  const errors = [];
  const byRetailer = new Map();

  for (const result of settled) {
    if (result.status === 'rejected') {
      const err = result.reason;
      const provider = err instanceof ProviderError ? err.provider : 'unknown';
      console.warn(`[providers] ${provider} getOffers failed:`, err.message);
      errors.push({ provider: provider ?? 'unknown', message: err.message });
      continue;
    }
    const { provider, offers } = result.value;
    for (const offer of offers ?? []) {
      if (!offer) continue;
      const tagged = { ...offer, source: provider.name };
      const existing = byRetailer.get(offer.retailer);
      // Prefer live data over sample data, then the cheaper total.
      const preferExisting =
        existing &&
        (existing.source !== 'mock' && tagged.source === 'mock'
          ? true
          : existing.totalCents <= tagged.totalCents &&
            !(existing.source === 'mock' && tagged.source !== 'mock'));
      if (!preferExisting) byRetailer.set(offer.retailer, tagged);
    }
  }

  return { offers: [...byRetailer.values()], errors };
}
