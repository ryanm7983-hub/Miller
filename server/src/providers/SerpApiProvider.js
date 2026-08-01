import { PriceProvider, ProviderError, normalizeOffer, parsePriceToCents } from './PriceProvider.js';
import { fetchJson } from '../lib/http.js';
import { config } from '../config.js';

const BASE_URL = 'https://serpapi.com/search.json';

/**
 * SerpApiProvider — LIVE data via SerpApi's Google Shopping engines.
 *
 * Requires `SERPAPI_KEY` (paid; a free tier of ~100 searches/month exists).
 * SerpApi is an official third-party API — PriceScout does not scrape retailer
 * sites itself, and each seller row links straight out to the retailer.
 *
 * Engines used:
 *   - `google_shopping`  → product discovery (search / barcode)
 *   - `google_product`   → the seller list for one product id (offers=1)
 *
 * Docs: https://serpapi.com/google-shopping-api,
 *       https://serpapi.com/google-product-api
 */
export class SerpApiProvider extends PriceProvider {
  static providerName = 'serpapi';

  get label() {
    return 'Google Shopping (SerpApi)';
  }

  get capabilities() {
    return {
      searchByText: true,
      // Google Shopping has no lookup-by-URL; we fall back to searching the
      // human-readable words in the URL (see searchByUrl).
      searchByUrl: true,
      searchByBarcode: true,
      offers: true,
      live: true,
      scraping: false,
    };
  }

  isConfigured() {
    return Boolean(config.providers.serpApiKey);
  }

  #url(params) {
    const url = new URL(BASE_URL);
    url.searchParams.set('api_key', config.providers.serpApiKey);
    url.searchParams.set('gl', config.providers.country);
    url.searchParams.set('hl', config.providers.language);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async #get(params) {
    if (!this.isConfigured()) {
      throw new ProviderError('SERPAPI_KEY is not set', { provider: this.name });
    }
    const data = await fetchJson(this.#url(params), {
      provider: this.name,
      timeoutMs: config.providers.timeoutMs,
    });
    if (data.error) {
      throw new ProviderError(`serpapi: ${data.error}`, { provider: this.name });
    }
    return data;
  }

  /** One `shopping_results` row -> ProductMatch with its single inline offer. */
  #toMatch(result) {
    const priceCents = parsePriceToCents(result.extracted_price ?? result.price);
    const offer = priceCents
      ? normalizeOffer({
          retailer: result.source ?? 'Unknown retailer',
          url: result.product_link ?? result.link,
          priceCents,
          shippingCents: parseShipping(result.delivery),
          deliveryEstimate: result.delivery ?? null,
          inStock: true,
        })
      : null;

    return {
      sourceId: String(result.product_id ?? result.position ?? result.title),
      title: result.title,
      brand: result.brand ?? null,
      model: null,
      upc: null,
      imageUrl: result.thumbnail ?? null,
      category: null,
      url: result.product_link ?? result.link ?? null,
      offers: offer ? [offer] : [],
    };
  }

  async searchByText(query, { limit = 8 } = {}) {
    const data = await this.#get({ engine: 'google_shopping', q: query, num: limit });
    const results = Array.isArray(data.shopping_results) ? data.shopping_results : [];
    return results
      .slice(0, limit)
      .map((r) => this.#toMatch(r))
      .filter((m) => m.title);
  }

  /**
   * Google Shopping cannot resolve an arbitrary retailer URL, so we strip the
   * slug out of the path and search for that text instead. Good enough for
   * Amazon/Walmart/Target style URLs, which embed the product name.
   */
  async searchByUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return [];
    }
    const words = parsed.pathname
      .split('/')
      .filter((part) => part.includes('-') && !/^[A-Z0-9]{10}$/.test(part))
      .join(' ')
      .replace(/[-_]/g, ' ')
      .trim();
    if (!words) return [];
    return this.searchByText(words, { limit: 3 });
  }

  async searchByBarcode(barcode) {
    const digits = String(barcode).replace(/\D/g, '');
    if (!digits) return [];
    const matches = await this.searchByText(digits, { limit: 5 });
    return matches.map((m) => ({ ...m, upc: digits }));
  }

  async getOffers(product, ref) {
    const productId = ref?.sourceId;

    if (productId && /^\d+$/.test(productId)) {
      const data = await this.#get({
        engine: 'google_product',
        product_id: productId,
        offers: 'true',
      });
      const sellers =
        data?.sellers_results?.online_sellers ??
        data?.sellers_results?.online_sellers_result ??
        [];
      const offers = sellers.map((seller) => normalizeOffer({
        retailer: seller.name ?? seller.source ?? 'Unknown retailer',
        url: seller.link ?? seller.direct_link ?? null,
        priceCents: parsePriceToCents(seller.base_price ?? seller.price ?? seller.total_price),
        shippingCents: parsePriceToCents(seller.additional_price?.shipping) ?? 0,
        deliveryEstimate: seller.details ?? null,
        condition: /refurb/i.test(seller.condition ?? '') ? 'refurbished' : 'new',
        inStock: true,
      })).filter(Boolean);
      if (offers.length > 0) return offers;
    }

    // Fall back to a fresh product search and keep the best row per retailer.
    const matches = await this.searchByText(product.title, { limit: 10 });
    const byRetailer = new Map();
    for (const match of matches) {
      for (const offer of match.offers ?? []) {
        const existing = byRetailer.get(offer.retailer);
        if (!existing || offer.totalCents < existing.totalCents) {
          byRetailer.set(offer.retailer, offer);
        }
      }
    }
    return [...byRetailer.values()];
  }
}

/** "Free delivery" -> 0, "$5.99 delivery" -> 599, unknown -> 0. */
function parseShipping(delivery) {
  if (!delivery) return 0;
  if (/free/i.test(delivery)) return 0;
  return parsePriceToCents(delivery) ?? 0;
}
