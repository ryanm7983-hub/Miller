import { PriceProvider, normalizeOffer } from './PriceProvider.js';
import { hash, seedFrom, seededRandom } from '../lib/ids.js';
import {
  SAMPLE_PRODUCTS,
  RETAILER_PROFILES,
  DEFAULT_RETAILERS,
} from './mock/catalog.js';

const DAY_MS = 86_400_000;

function epochDay(date = new Date()) {
  return Math.floor(date.getTime() / DAY_MS);
}

function tokenize(str) {
  return String(str ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function titleCase(str) {
  return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Centred pseudo-random value in [-0.5, 0.5) for a (seed, index) pair. */
function noiseAt(seed, index) {
  return seededRandom((seed ^ (index * 2654435761)) >>> 0)() - 0.5;
}

/**
 * Deterministic price for one retailer on one calendar day.
 *
 * Built from a slow seasonal trend, a smoothly interpolated week-to-week
 * wobble and occasional promotions, so the resulting history reads like a real
 * price series (and, crucially, is identical every time it is recomputed).
 */
function mockPriceCents(seed, retailer, day, basePriceCents) {
  const profile = RETAILER_PROFILES[retailer] ?? { bias: 0 };
  const retailerSeed = seedFrom(`${seed}:${retailer}`);

  const trend = Math.sin((day + (retailerSeed % 120)) / 58) * 0.045;
  const drift = Math.cos((day + (retailerSeed % 300)) / 190) * 0.03;

  // Week-anchored wobble, interpolated across the week so consecutive days
  // stay close instead of looking like static.
  const week = Math.floor(day / 7);
  const position = (day - week * 7) / 7;
  const wobble =
    (noiseAt(retailerSeed, week) * (1 - position) + noiseAt(retailerSeed, week + 1) * position) *
      0.04 +
    noiseAt(retailerSeed ^ 0x9e37, day) * 0.003;

  // Promotions run for a week, easing in and out rather than snapping.
  const promoRoll = seededRandom((retailerSeed ^ (week * 40503)) >>> 0)();
  const depth = promoRoll > 0.86 ? 0.05 + (promoRoll - 0.86) * 0.9 : 0;
  const promo = -depth * (0.65 + 0.35 * Math.sin(Math.PI * position));

  const factor = 1 + profile.bias + trend + drift + wobble + promo;
  const floor = Math.round(basePriceCents * 0.55);
  // Round to a realistic .99 price point.
  const raw = Math.max(floor, Math.round(basePriceCents * factor));
  return Math.round(raw / 100) * 100 - 1;
}

function shippingCentsFor(retailer, priceCents, seed, day) {
  const profile = RETAILER_PROFILES[retailer] ?? { freeShipOver: 3500, shipCents: 599 };
  if (profile.freeShipOver === 0) return 0;
  if (priceCents >= profile.freeShipOver) return 0;
  const jitter = seededRandom((seedFrom(`${seed}:${retailer}:ship`) ^ day) >>> 0)();
  return jitter > 0.7 ? 0 : profile.shipCents;
}

function deliveryEstimate(retailer, day) {
  const profile = RETAILER_PROFILES[retailer] ?? { shipDays: 4 };
  const arrival = new Date((day + profile.shipDays) * DAY_MS);
  return `Arrives ${arrival.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`;
}

function buyUrl(retailer, entry) {
  const profile = RETAILER_PROFILES[retailer];
  const host = profile?.host ?? 'example.com';
  // Sample links point at each retailer's search page for the product, which is
  // a valid destination without inventing fake SKU URLs that 404.
  return `https://${host}/s?k=${encodeURIComponent(entry.title)}`;
}

/**
 * MockProvider — offline sample data source.
 *
 * ⚠️ Everything this provider returns is fabricated. It is the default provider
 * so `npm run dev` works with no API keys, and it is the only provider that can
 * back-fill historical prices (real providers only know today's price, so their
 * history accumulates from the moment you start tracking).
 */
export class MockProvider extends PriceProvider {
  static providerName = 'mock';

  get label() {
    return 'Sample data (mock)';
  }

  get capabilities() {
    return {
      searchByText: true,
      searchByUrl: true,
      searchByBarcode: true,
      offers: true,
      live: false,
      scraping: false,
    };
  }

  /** Sample entry -> ProductMatch (without offers). */
  #toMatch(entry) {
    return {
      sourceId: entry.slug,
      title: entry.title,
      brand: entry.brand,
      model: entry.model,
      upc: entry.upc,
      category: entry.category,
      imageUrl: null,
      url: null,
      payload: entry,
    };
  }

  /**
   * Fabricates a catalog entry for a query that matches nothing in the sample
   * set, so any search term still demonstrates the full flow.
   */
  #synthesize(query, { upc = null, retailerHint = null } = {}) {
    const cleaned = titleCase(String(query).replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim());
    const title = cleaned || 'Unknown Product';
    const seed = seedFrom(`synthetic:${title.toLowerCase()}`);
    const rand = seededRandom(seed);
    const basePriceCents = Math.round((1500 + rand() * 60000) / 100) * 100 - 1;
    const retailers = retailerHint
      ? [retailerHint, ...DEFAULT_RETAILERS.filter((r) => r !== retailerHint)].slice(0, 5)
      : DEFAULT_RETAILERS;
    return {
      slug: `synthetic-${hash(title.toLowerCase()).slice(0, 10)}`,
      title,
      brand: title.split(' ')[0],
      model: null,
      upc,
      category: 'General',
      basePriceCents,
      retailers,
      synthesized: true,
    };
  }

  #find(sourceId) {
    return SAMPLE_PRODUCTS.find((p) => p.slug === sourceId) ?? null;
  }

  async searchByText(query, { limit = 8 } = {}) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const scored = SAMPLE_PRODUCTS.map((entry) => {
      const haystack = tokenize(
        [entry.title, entry.brand, entry.model, entry.category].join(' '),
      );
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 2;
        else if (haystack.some((h) => h.startsWith(token) || token.startsWith(h))) score += 1;
      }
      return { entry, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const entries = scored.length > 0
      ? scored.map((s) => s.entry)
      : [this.#synthesize(query)];

    return entries.map((entry) => ({
      ...this.#toMatch(entry),
      offers: this.#offersFor(entry),
    }));
  }

  async searchByUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return [];
    }
    const retailer = Object.entries(RETAILER_PROFILES).find(
      ([, profile]) => parsed.hostname.endsWith(profile.host.replace(/^www\./, '')),
    )?.[0] ?? null;

    // Use the readable parts of the URL as the search term.
    const slugWords = [...parsed.pathname.split('/'), parsed.searchParams.get('k') ?? '']
      .filter((part) => part && !/^(dp|gp|product|ip|p|itm|site)$/i.test(part))
      .filter((part) => !/^[A-Z0-9]{8,}$/.test(part))
      .join(' ')
      .replace(/[-_+]/g, ' ')
      .trim();

    const byText = await this.searchByText(slugWords || parsed.hostname);
    if (byText.length > 0) return byText.slice(0, 3);

    const entry = this.#synthesize(slugWords || 'Product from link', { retailerHint: retailer });
    return [{ ...this.#toMatch(entry), offers: this.#offersFor(entry) }];
  }

  async searchByBarcode(barcode) {
    const digits = String(barcode).replace(/\D/g, '');
    const exact = SAMPLE_PRODUCTS.find((p) => p.upc === digits);
    if (exact) {
      return [{ ...this.#toMatch(exact), offers: this.#offersFor(exact) }];
    }
    // Unknown barcode: deterministically map it onto a sample product so the
    // scan flow is demonstrable end to end.
    const picked = SAMPLE_PRODUCTS[seedFrom(digits) % SAMPLE_PRODUCTS.length];
    const entry = { ...picked, upc: digits, slug: `${picked.slug}-upc-${digits.slice(-4)}` };
    return [{ ...this.#toMatch(entry), offers: this.#offersFor(entry) }];
  }

  async getOffers(product, ref) {
    const entry = this.#entryFor(product, ref);
    return this.#offersFor(entry);
  }

  /**
   * Back-fills sample history. Not part of the PriceProvider interface — only
   * the mock source can know the past, and callers store these rows with
   * `synthetic = 1`.
   *
   * @param {object} product
   * @param {object} ref
   * @param {number} days How many days back to generate.
   * @param {number} stepDays Sampling interval.
   * @returns {{ capturedAt: Date, offers: object[] }[]}
   */
  buildHistory(product, ref, days = 365, stepDays = 1) {
    const entry = this.#entryFor(product, ref);
    const today = epochDay();
    const out = [];
    for (let back = days; back >= stepDays; back -= stepDays) {
      const day = today - back;
      out.push({
        capturedAt: new Date(day * DAY_MS + 12 * 3600_000),
        offers: this.#offersFor(entry, day),
      });
    }
    return out;
  }

  #entryFor(product, ref) {
    const sourceId = ref?.sourceId ?? product?.id;
    return (
      ref?.payload ??
      this.#find(sourceId) ??
      (product?.upc && SAMPLE_PRODUCTS.find((p) => p.upc === product.upc)) ??
      this.#synthesize(product?.title ?? sourceId ?? 'Unknown Product', {
        upc: product?.upc ?? null,
      })
    );
  }

  #offersFor(entry, day = epochDay()) {
    const seed = entry.slug;
    const retailers = entry.retailers?.length ? entry.retailers : DEFAULT_RETAILERS;
    return retailers
      .map((retailer) => {
        const priceCents = mockPriceCents(seed, retailer, day, entry.basePriceCents);
        const stockRoll = seededRandom(
          (seedFrom(`${seed}:${retailer}:stock`) ^ Math.floor(day / 3)) >>> 0,
        )();
        return normalizeOffer({
          retailer,
          url: buyUrl(retailer, entry),
          priceCents,
          shippingCents: shippingCentsFor(retailer, priceCents, seed, day),
          inStock: stockRoll > 0.08,
          condition: retailer === 'eBay' && stockRoll < 0.35 ? 'refurbished' : 'new',
          deliveryEstimate: deliveryEstimate(retailer, day),
          retailerSku: `${retailer.replace(/\W/g, '').toUpperCase().slice(0, 4)}-${hash(seed, retailer).slice(0, 8).toUpperCase()}`,
        });
      })
      .filter(Boolean);
  }
}
