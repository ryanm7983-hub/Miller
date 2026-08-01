import { PriceProvider, ProviderError, normalizeOffer, parsePriceToCents } from './PriceProvider.js';
import { fetchJson } from '../lib/http.js';
import { config } from '../config.js';

const BASE_URL = 'https://api.rainforestapi.com/request';

/**
 * RainforestProvider — LIVE Amazon-only data via Rainforest API.
 *
 * Requires `RAINFOREST_API_KEY` (paid). Enable it alongside `serpapi` to get a
 * better Amazon price than Google Shopping usually reports:
 *   PRICE_PROVIDERS=serpapi,rainforest
 *
 * Only contributes an "Amazon" row; the registry merges it with other
 * providers' retailers.
 *
 * Docs: https://docs.trajectdata.com/rainforestapi/product-data-api/overview
 */
export class RainforestProvider extends PriceProvider {
  static providerName = 'rainforest';

  get label() {
    return 'Amazon (Rainforest API)';
  }

  get capabilities() {
    return {
      searchByText: true,
      searchByUrl: true,
      searchByBarcode: false,
      offers: true,
      live: true,
      scraping: false,
    };
  }

  isConfigured() {
    return Boolean(config.providers.rainforestApiKey);
  }

  async #get(params) {
    if (!this.isConfigured()) {
      throw new ProviderError('RAINFOREST_API_KEY is not set', { provider: this.name });
    }
    const url = new URL(BASE_URL);
    url.searchParams.set('api_key', config.providers.rainforestApiKey);
    url.searchParams.set('amazon_domain', process.env.AMAZON_DOMAIN ?? 'amazon.com');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const data = await fetchJson(url.toString(), {
      provider: this.name,
      timeoutMs: config.providers.timeoutMs,
    });
    if (data.request_info && data.request_info.success === false) {
      throw new ProviderError(
        `rainforest: ${data.request_info.message ?? 'request failed'}`,
        { provider: this.name },
      );
    }
    return data;
  }

  #offerFromProduct(product) {
    const price = product?.buybox_winner?.price ?? product?.price;
    const priceCents = parsePriceToCents(price?.value ?? price?.raw);
    if (!priceCents) return null;
    const shipping = product?.buybox_winner?.shipping;
    return normalizeOffer({
      retailer: 'Amazon',
      url: product.link ?? (product.asin ? `https://www.amazon.com/dp/${product.asin}` : null),
      priceCents,
      shippingCents: shipping?.raw && !/free/i.test(shipping.raw)
        ? parsePriceToCents(shipping.value ?? shipping.raw) ?? 0
        : 0,
      inStock: product?.buybox_winner?.availability?.type !== 'out_of_stock',
      condition: product?.buybox_winner?.condition?.is_new === false ? 'used' : 'new',
      deliveryEstimate: product?.buybox_winner?.fulfillment?.standard_delivery?.name ?? null,
      retailerSku: product.asin ?? null,
    });
  }

  async searchByText(query, { limit = 5 } = {}) {
    const data = await this.#get({ type: 'search', search_term: query });
    const results = Array.isArray(data.search_results) ? data.search_results : [];
    return results.slice(0, limit).map((result) => {
      const priceCents = parsePriceToCents(result.price?.value ?? result.price?.raw);
      const offer = priceCents
        ? normalizeOffer({
            retailer: 'Amazon',
            url: result.link,
            priceCents,
            shippingCents: 0,
            inStock: true,
            retailerSku: result.asin,
          })
        : null;
      return {
        sourceId: result.asin,
        title: result.title,
        brand: null,
        model: null,
        upc: null,
        imageUrl: result.image ?? null,
        url: result.link ?? null,
        offers: offer ? [offer] : [],
      };
    });
  }

  /** Amazon URLs carry the ASIN, which is a direct product lookup. */
  async searchByUrl(url) {
    const asin = String(url).match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i)?.[1];
    if (!asin) return [];
    const data = await this.#get({ type: 'product', asin });
    const product = data.product;
    if (!product) return [];
    const offer = this.#offerFromProduct(product);
    return [{
      sourceId: asin,
      title: product.title,
      brand: product.brand ?? null,
      model: product.model_number ?? null,
      upc: product.upc ?? null,
      imageUrl: product.main_image?.link ?? null,
      url: product.link ?? null,
      offers: offer ? [offer] : [],
    }];
  }

  async getOffers(product, ref) {
    const asin = ref?.sourceId;
    if (asin && /^[A-Z0-9]{10}$/i.test(asin)) {
      const data = await this.#get({ type: 'product', asin });
      const offer = this.#offerFromProduct(data.product);
      return offer ? [offer] : [];
    }
    const matches = await this.searchByText(product.title, { limit: 1 });
    return matches[0]?.offers ?? [];
  }
}
