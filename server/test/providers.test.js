/**
 * Live-provider tests. Real API keys are never used here — `fetch` is stubbed
 * with payloads shaped like the ones SerpApi and Rainforest actually return, so
 * the parsing, money handling and merge logic are covered without spending
 * quota.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pricescout-prov-')), 'test.db');
process.env.DATABASE_FILE = dbFile;
process.env.PRICE_PROVIDERS = 'serpapi,rainforest';
process.env.SERPAPI_KEY = 'test-serpapi-key';
process.env.RAINFOREST_API_KEY = 'test-rainforest-key';
process.env.ENABLE_CRON = 'false';

const GOOGLE_SHOPPING = {
  shopping_results: [
    {
      position: 1,
      title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
      product_id: '14958019403847417243',
      product_link: 'https://www.google.com/shopping/product/14958019403847417243',
      source: 'Best Buy',
      price: '$329.99',
      extracted_price: 329.99,
      thumbnail: 'https://encrypted-tbn0.gstatic.com/shopping?q=abc',
      delivery: 'Free delivery',
    },
    {
      position: 2,
      title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
      product_id: '14958019403847417243',
      product_link: 'https://www.google.com/shopping/product/14958019403847417243',
      source: 'Walmart',
      price: '$348.00',
      extracted_price: 348,
      delivery: '$5.99 delivery',
    },
  ],
};

const GOOGLE_PRODUCT = {
  sellers_results: {
    online_sellers: [
      {
        position: 1,
        name: 'Amazon.com',
        link: 'https://www.amazon.com/dp/B09XS7JWHH',
        base_price: '$298.00',
        additional_price: { shipping: 'Free', tax: '$26.07' },
        total_price: '$324.07',
        details: 'Free delivery by Tue, Aug 5',
      },
      {
        position: 2,
        name: 'Target',
        link: 'https://www.target.com/p/-/A-86412839',
        base_price: '$319.99',
        additional_price: { shipping: '$8.99', tax: '$28.00' },
        total_price: '$356.98',
        details: 'Delivery in 3-5 days',
      },
    ],
  },
};

const RAINFOREST_PRODUCT = {
  request_info: { success: true },
  product: {
    title: 'Sony WH-1000XM5 Wireless Industry Leading Headphones',
    asin: 'B09XS7JWHH',
    link: 'https://www.amazon.com/dp/B09XS7JWHH',
    brand: 'Sony',
    model_number: 'WH-1000XM5',
    main_image: { link: 'https://m.media-amazon.com/images/I/abc.jpg' },
    buybox_winner: {
      price: { value: 289.99, currency: 'USD', raw: '$289.99' },
      shipping: { raw: 'FREE' },
      availability: { type: 'in_stock' },
    },
  },
};

let calls = [];
let handler = null;
const realFetch = globalThis.fetch;

function stubFetch() {
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    const result = handler(href);
    if (result instanceof Error) throw result;
    return {
      ok: result.status < 400,
      status: result.status,
      json: async () => result.body,
      text: async () => JSON.stringify(result.body),
    };
  };
}

const ok = (body) => ({ status: 200, body });

let SerpApiProvider;
let RainforestProvider;
let ProviderError;
let registry;

before(async () => {
  stubFetch();
  ({ SerpApiProvider } = await import('../src/providers/SerpApiProvider.js'));
  ({ RainforestProvider } = await import('../src/providers/RainforestProvider.js'));
  ({ ProviderError } = await import('../src/providers/PriceProvider.js'));
  registry = await import('../src/providers/index.js');
});

after(() => { globalThis.fetch = realFetch; });

beforeEach(() => { calls = []; });

describe('SerpApiProvider (Google Shopping)', () => {
  test('is only active when a key is configured', () => {
    assert.equal(new SerpApiProvider().isConfigured(), true);
  });

  test('sends the key, engine and query, and never leaks the key into results', async () => {
    handler = () => ok(GOOGLE_SHOPPING);
    const matches = await new SerpApiProvider().searchByText('sony wh-1000xm5');

    const [url] = calls;
    assert.match(url, /engine=google_shopping/);
    assert.match(url, /api_key=test-serpapi-key/);
    assert.match(url, /q=sony\+wh-1000xm5/);
    assert.ok(!JSON.stringify(matches).includes('test-serpapi-key'));
  });

  test('parses prices into integer cents and free vs paid delivery', async () => {
    handler = () => ok(GOOGLE_SHOPPING);
    const matches = await new SerpApiProvider().searchByText('sony wh-1000xm5');

    const bestBuy = matches[0].offers[0];
    assert.equal(bestBuy.retailer, 'Best Buy');
    assert.equal(bestBuy.priceCents, 32999);
    assert.equal(bestBuy.shippingCents, 0);
    assert.equal(bestBuy.totalCents, 32999);

    const walmart = matches[1].offers[0];
    assert.equal(walmart.priceCents, 34800);
    assert.equal(walmart.shippingCents, 599);
    assert.equal(walmart.totalCents, 35399);
  });

  test('keeps the provider product id so refreshes can re-query directly', async () => {
    handler = () => ok(GOOGLE_SHOPPING);
    const [match] = await new SerpApiProvider().searchByText('sony');
    assert.equal(match.sourceId, '14958019403847417243');
    assert.equal(match.imageUrl, 'https://encrypted-tbn0.gstatic.com/shopping?q=abc');
  });

  test('getOffers reads the seller list, with shipping added to the item price', async () => {
    handler = () => ok(GOOGLE_PRODUCT);
    const offers = await new SerpApiProvider().getOffers(
      { title: 'Sony WH-1000XM5' },
      { sourceId: '14958019403847417243' },
    );

    assert.match(calls[0], /engine=google_product/);
    assert.match(calls[0], /product_id=14958019403847417243/);

    const amazon = offers.find((offer) => offer.retailer === 'Amazon.com');
    assert.equal(amazon.priceCents, 29800);
    assert.equal(amazon.shippingCents, 0);

    const target = offers.find((offer) => offer.retailer === 'Target');
    assert.equal(target.priceCents, 31999);
    assert.equal(target.shippingCents, 899);
    assert.equal(target.totalCents, 32898);
  });

  test('falls back to a text search when there is no usable product id', async () => {
    handler = () => ok(GOOGLE_SHOPPING);
    const offers = await new SerpApiProvider().getOffers({ title: 'Sony WH-1000XM5' }, null);
    assert.match(calls[0], /engine=google_shopping/);
    // One row per retailer, cheapest kept.
    assert.deepEqual(offers.map((offer) => offer.retailer).sort(), ['Best Buy', 'Walmart']);
  });

  test('a search URL is turned into a text query', async () => {
    handler = () => ok(GOOGLE_SHOPPING);
    await new SerpApiProvider().searchByUrl('https://www.walmart.com/ip/Sony-WH-1000XM5-Headphones/1234');
    assert.match(calls[0], /q=Sony\+WH\+1000XM5\+Headphones/);
  });

  test('an API error becomes a ProviderError rather than a crash', async () => {
    handler = () => ok({ error: 'Invalid API key' });
    await assert.rejects(
      () => new SerpApiProvider().searchByText('anything'),
      (error) => error instanceof ProviderError && /Invalid API key/.test(error.message),
    );
  });

  test('an HTTP failure is reported with its status and retryability', async () => {
    handler = () => ({ status: 429, body: { error: 'quota exceeded' } });
    await assert.rejects(
      () => new SerpApiProvider().searchByText('anything'),
      (error) => error.status === 429 && error.retryable === true,
    );
  });

  test('empty results are an empty list, not an error', async () => {
    handler = () => ok({ shopping_results: [] });
    assert.deepEqual(await new SerpApiProvider().searchByText('nothing at all'), []);
  });
});

describe('RainforestProvider (Amazon)', () => {
  test('extracts the ASIN from an Amazon URL and looks it up directly', async () => {
    handler = () => ok(RAINFOREST_PRODUCT);
    const [match] = await new RainforestProvider().searchByUrl('https://www.amazon.com/dp/B09XS7JWHH?ref=xyz');

    assert.match(calls[0], /type=product/);
    assert.match(calls[0], /asin=B09XS7JWHH/);
    assert.equal(match.sourceId, 'B09XS7JWHH');
    assert.equal(match.brand, 'Sony');
    assert.equal(match.offers[0].retailer, 'Amazon');
    assert.equal(match.offers[0].priceCents, 28999);
    assert.equal(match.offers[0].shippingCents, 0);
  });

  test('ignores a non-Amazon URL instead of guessing', async () => {
    handler = () => ok(RAINFOREST_PRODUCT);
    assert.deepEqual(await new RainforestProvider().searchByUrl('https://www.target.com/p/thing/-/A-1'), []);
    assert.equal(calls.length, 0);
  });

  test('surfaces a failed request as a ProviderError', async () => {
    handler = () => ok({ request_info: { success: false, message: 'Invalid API key' } });
    await assert.rejects(
      () => new RainforestProvider().getOffers({ title: 'x' }, { sourceId: 'B09XS7JWHH' }),
      (error) => error instanceof ProviderError,
    );
  });
});

describe('provider registry', () => {
  test('reports both live sources and no sample data', () => {
    const info = registry.providerInfo();
    assert.deepEqual(info.map((provider) => provider.name).sort(), ['rainforest', 'serpapi']);
    assert.equal(info.every((provider) => provider.live), true);
    assert.equal(registry.isMockOnly(), false);
  });

  test('merges both providers and keeps one row per retailer', async () => {
    handler = (url) => (url.includes('rainforestapi') ? ok(RAINFOREST_PRODUCT) : ok(GOOGLE_PRODUCT));

    const { offers, errors } = await registry.fetchOffers(
      { id: 'ps_test', title: 'Sony WH-1000XM5' },
      { serpapi: { sourceId: '14958019403847417243' }, rainforest: { sourceId: 'B09XS7JWHH' } },
    );

    assert.equal(errors.length, 0);
    const retailers = offers.map((offer) => offer.retailer).sort();
    assert.deepEqual(retailers, ['Amazon', 'Amazon.com', 'Target']);
    assert.equal(offers.find((offer) => offer.retailer === 'Amazon').source, 'rainforest');
  });

  test('one provider failing does not lose the other provider results', async () => {
    handler = (url) => (url.includes('rainforestapi')
      ? { status: 500, body: { error: 'upstream down' } }
      : ok(GOOGLE_PRODUCT));

    const { offers, errors } = await registry.fetchOffers(
      { id: 'ps_test', title: 'Sony WH-1000XM5' },
      { serpapi: { sourceId: '14958019403847417243' }, rainforest: { sourceId: 'B09XS7JWHH' } },
    );

    assert.equal(errors.length, 1);
    assert.equal(errors[0].provider, 'rainforest');
    assert.ok(offers.length >= 2);
  });

  test('a search fans out to every provider and merges by product', async () => {
    handler = (url) => (url.includes('rainforestapi')
      ? ok({ request_info: { success: true }, search_results: [] })
      : ok(GOOGLE_SHOPPING));

    const { matches, kind } = await registry.searchProviders('sony wh-1000xm5');
    assert.equal(kind, 'text');
    // Both shopping rows describe the same product, so they collapse to one.
    assert.equal(matches.length, 1);
    assert.equal(matches[0].isMock, false);
    assert.deepEqual(matches[0].offers.map((offer) => offer.retailer).sort(), ['Best Buy', 'Walmart']);
  });
});
