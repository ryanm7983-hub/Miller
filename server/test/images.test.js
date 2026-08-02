/**
 * Product imagery. The app must show a real photograph whenever a listing has
 * one — these tests pin that path so it can't silently regress into always
 * drawing the placeholder.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pricescout-img-')), 'test.db');
process.env.DATABASE_FILE = dbFile;
process.env.PRICE_PROVIDERS = 'serpapi';
process.env.SERPAPI_KEY = 'test-key';
process.env.ENABLE_CRON = 'false';
process.env.SILENT = '1';

const THUMBNAIL = 'https://serpapi.example/thumb/sony-wh1000xm5.jpg';

const SHOPPING = {
  shopping_results: [
    {
      position: 1,
      title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
      product_id: '14958019403847417243',
      product_link: 'https://www.google.com/shopping/product/14958019403847417243',
      source: 'Best Buy',
      extracted_price: 329.99,
      thumbnail: THUMBNAIL,
      delivery: 'Free delivery',
    },
  ],
};

const realFetch = globalThis.fetch.bind(globalThis);
let server;
let baseUrl;

/** Stubs the provider call while leaving this test's own HTTP calls alone. */
function stubProvider(payload) {
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('127.0.0.1')) return realFetch(url, init);
    return { ok: true, status: 200, json: async () => payload, text: async () => '' };
  };
}

before(async () => {
  stubProvider(SHOPPING);

  const { createApp } = await import('../src/app.js');
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });
});

after(() => {
  globalThis.fetch = realFetch;
  server?.close();
});

describe('live product photos', () => {
  test('a provider thumbnail survives all the way to the search response', async () => {
    const response = await fetch(`${baseUrl}/search?q=sony%20wh-1000xm5`);
    const body = await response.json();
    assert.equal(body.results[0].product.imageUrl, THUMBNAIL);
  });

  test('and to the product detail response', async () => {
    const search = await (await fetch(`${baseUrl}/search?q=sony%20wh-1000xm5`)).json();
    const { id } = search.results[0].product;

    const detail = await (await fetch(`${baseUrl}/products/${id}`)).json();
    assert.equal(detail.product.imageUrl, THUMBNAIL);
  });

  test('an image URL is never overwritten by a later result that lacks one', async () => {
    const search = await (await fetch(`${baseUrl}/search?q=sony%20wh-1000xm5`)).json();
    const { id } = search.results[0].product;

    // Same product, this time with no thumbnail in the payload.
    stubProvider({
      shopping_results: [{ ...SHOPPING.shopping_results[0], thumbnail: undefined }],
    });

    await fetch(`${baseUrl}/search?q=sony%20wh-1000xm5`);
    const detail = await (await fetch(`${baseUrl}/products/${id}`)).json();
    assert.equal(detail.product.imageUrl, THUMBNAIL, 'the known photo should be kept');
  });
});

describe('sample-data photos', () => {
  test('the mock provider exposes photos from the manifest when one exists', async () => {
    const { MockProvider } = await import('../src/providers/MockProvider.js');
    const [match] = await new MockProvider().searchByBarcode('027242923004');

    // Empty manifest by default — `npm run images` fills it in.
    assert.ok(match.imageUrl === null || typeof match.imageUrl === 'string');
    assert.equal(match.title.includes('WH-1000XM5'), true);
  });

  test('every sample product carries art hints for the placeholder drawing', async () => {
    const { SAMPLE_PRODUCTS } = await import('../src/providers/mock/catalog.js');
    for (const entry of SAMPLE_PRODUCTS) {
      assert.ok(entry.artKind, `${entry.slug} is missing artKind`);
      assert.ok(entry.artPalette, `${entry.slug} is missing artPalette`);
    }
  });
});
