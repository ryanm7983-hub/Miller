/**
 * PriceProvider — the single seam between PriceScout and the outside world.
 *
 * Everything that knows how to find a product or quote a price implements this
 * interface. Nothing above this layer (routes, jobs, alerting) knows whether the
 * numbers came from sample data, SerpApi, Rainforest, or a retailer's own
 * affiliate feed, so sources can be swapped or combined by changing the
 * `PRICE_PROVIDERS` env var alone.
 *
 * Implementations must:
 *  - return money as INTEGER CENTS (never floats) in `currency`;
 *  - never throw for "no results" — return an empty array;
 *  - throw a `ProviderError` for auth/quota/transport failures so the registry
 *    can degrade to the remaining providers instead of failing the request.
 *
 * @typedef {Object} Offer            A single buyable listing at one retailer.
 * @property {string}  retailer        Display name, e.g. "Amazon".
 * @property {string}  url             Outbound buy link.
 * @property {number}  priceCents      Item price, excluding shipping.
 * @property {number}  shippingCents   0 for free shipping.
 * @property {string}  [currency]      ISO 4217, defaults to "USD".
 * @property {boolean} [inStock]       Defaults to true.
 * @property {string}  [condition]     "new" | "used" | "refurbished".
 * @property {string}  [deliveryEstimate] Human string, e.g. "Arrives Tue, Aug 5".
 * @property {string}  [retailerSku]   Retailer-side identifier when known.
 *
 * @typedef {Object} ProductMatch     A product the provider recognised.
 * @property {string}  sourceId        Provider-side id, used for re-querying.
 * @property {string}  title
 * @property {string}  [brand]
 * @property {string}  [model]
 * @property {string}  [upc]           Preferred key for cross-provider merging.
 * @property {string}  [imageUrl]
 * @property {string}  [category]
 * @property {string}  [url]           Canonical provider page for the product.
 * @property {Offer[]} [offers]        Offers already known from the search hit.
 *
 * @typedef {Object} ProviderCapabilities
 * @property {boolean} searchByText
 * @property {boolean} searchByUrl
 * @property {boolean} searchByBarcode
 * @property {boolean} offers          Can quote prices for a known product.
 * @property {boolean} live            false for sample/mock data.
 * @property {boolean} [scraping]      true if the source scrapes retailer HTML
 *                                     rather than using an official API — the
 *                                     UI surfaces this so operators can opt out.
 */

export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {{ provider?: string, status?: number, retryable?: boolean, cause?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message, { cause: meta.cause });
    this.name = 'ProviderError';
    this.provider = meta.provider;
    this.status = meta.status;
    this.retryable = meta.retryable ?? false;
  }
}

export class PriceProvider {
  /** @type {string} Stable machine name, e.g. "serpapi". */
  static providerName = 'abstract';

  get name() {
    return /** @type {typeof PriceProvider} */ (this.constructor).providerName;
  }

  /** Human-facing label shown in the UI's data-source badges. */
  get label() {
    return this.name;
  }

  /** @returns {ProviderCapabilities} */
  get capabilities() {
    return {
      searchByText: false,
      searchByUrl: false,
      searchByBarcode: false,
      offers: false,
      live: true,
      scraping: false,
    };
  }

  /**
   * True when the provider has everything it needs (API keys, etc.) to run.
   * A misconfigured provider is skipped rather than crashing the server.
   * @returns {boolean}
   */
  isConfigured() {
    return true;
  }

  /**
   * @param {string} _query
   * @param {{ limit?: number }} [_opts]
   * @returns {Promise<ProductMatch[]>}
   */
  async searchByText(_query, _opts) {
    return [];
  }

  /**
   * @param {string} _url A product URL pasted by the user.
   * @returns {Promise<ProductMatch[]>}
   */
  async searchByUrl(_url) {
    return [];
  }

  /**
   * @param {string} _barcode UPC/EAN digits.
   * @returns {Promise<ProductMatch[]>}
   */
  async searchByBarcode(_barcode) {
    return [];
  }

  /**
   * Current offers for a product we already track. `ref` carries whatever the
   * provider previously stored in product_sources, so this can be a cheap
   * direct lookup rather than a re-search.
   *
   * @param {{ id: string, title: string, upc?: string|null, brand?: string|null }} _product
   * @param {{ sourceId?: string, url?: string, payload?: any }} [_ref]
   * @returns {Promise<Offer[]>}
   */
  async getOffers(_product, _ref) {
    return [];
  }
}

/** Normalizes a partial offer into the canonical shape used everywhere else. */
export function normalizeOffer(offer) {
  const priceCents = Math.round(Number(offer.priceCents));
  const shippingCents = Math.max(0, Math.round(Number(offer.shippingCents ?? 0)));
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
  if (!offer.retailer) return null;
  return {
    retailer: String(offer.retailer),
    url: offer.url ?? null,
    priceCents,
    shippingCents,
    totalCents: priceCents + shippingCents,
    currency: offer.currency ?? 'USD',
    inStock: offer.inStock === undefined ? true : Boolean(offer.inStock),
    condition: offer.condition ?? 'new',
    deliveryEstimate: offer.deliveryEstimate ?? null,
    retailerSku: offer.retailerSku ?? null,
  };
}

/** Parses "$1,299.99" / "1299.99 USD" / 1299.99 into integer cents. */
export function parsePriceToCents(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const match = String(input).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[0]) * 100);
}
