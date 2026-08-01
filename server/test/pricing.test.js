import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate this file's database before anything imports the db module.
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pricescout-')), 'test.db');
process.env.DATABASE_FILE = dbFile;
process.env.PRICE_PROVIDERS = 'mock';
process.env.ENABLE_CRON = 'false';

let modules;

before(async () => {
  modules = {
    normalize: await import('../src/services/normalize.js'),
    mock: await import('../src/providers/MockProvider.js'),
    catalog: await import('../src/services/catalog.js'),
    prices: await import('../src/services/prices.js'),
    alerts: await import('../src/services/alerts.js'),
  };
});

describe('product normalization', () => {
  test('UPC wins over title when building the match key', async () => {
    const { matchKey, productIdFor } = modules.normalize;
    const a = matchKey({ upc: '027242923004', title: 'Sony WH-1000XM5 Headphones' });
    const b = matchKey({ upc: '027242923004', title: 'SONY WH1000XM5 (Black) — refurb' });
    assert.equal(a, b);
    assert.equal(productIdFor(a), productIdFor(b));
  });

  test('titles collapse to the same key despite noise words and case', async () => {
    const { matchKey } = modules.normalize;
    assert.equal(
      matchKey({ title: 'Instant Pot Duo 7-in-1 Electric Pressure Cooker' }),
      matchKey({ title: 'INSTANT POT DUO 7 IN 1 electric pressure cooker' }),
    );
  });

  test('different products get different ids', async () => {
    const { matchKey, productIdFor } = modules.normalize;
    const a = productIdFor(matchKey({ title: 'Sony WH-1000XM5' }));
    const b = productIdFor(matchKey({ title: 'Bose QuietComfort Ultra' }));
    assert.notEqual(a, b);
  });
});

describe('MockProvider', () => {
  test('search by text finds a catalog product with offers', async () => {
    const provider = new modules.mock.MockProvider();
    const [match] = await provider.searchByText('sony wh-1000xm5');
    assert.match(match.title, /WH-1000XM5/);
    assert.ok(match.offers.length >= 5);
    for (const offer of match.offers) {
      assert.ok(Number.isInteger(offer.priceCents) && offer.priceCents > 0);
      assert.equal(offer.totalCents, offer.priceCents + offer.shippingCents);
    }
  });

  test('an unknown query still returns a synthesized product', async () => {
    const provider = new modules.mock.MockProvider();
    const [match] = await provider.searchByText('completely unknown gizmo 9000');
    assert.ok(match);
    assert.ok(match.offers.length > 0);
  });

  test('barcode lookup resolves the matching catalog entry', async () => {
    const provider = new modules.mock.MockProvider();
    const [match] = await provider.searchByBarcode('045496882730');
    assert.match(match.title, /Nintendo Switch OLED/);
  });

  test('a retailer URL resolves to the same product as its name', async () => {
    const provider = new modules.mock.MockProvider();
    const [byUrl] = await provider.searchByUrl(
      'https://www.walmart.com/ip/Dyson-V15-Detect-Cordless-Vacuum-Cleaner/123456',
    );
    assert.match(byUrl.title, /Dyson V15/);
  });

  test('prices are deterministic — the same day always yields the same price', async () => {
    const provider = new modules.mock.MockProvider();
    const first = await provider.searchByText('sony wh-1000xm5');
    const second = await provider.searchByText('sony wh-1000xm5');
    assert.deepEqual(first[0].offers, second[0].offers);
  });

  test('back-filled history is dated, ordered and non-empty', async () => {
    const provider = new modules.mock.MockProvider();
    const [match] = await provider.searchByBarcode('027242923004');
    const history = provider.buildHistory({ title: match.title }, { sourceId: match.sourceId, payload: match.payload }, 30, 1);
    assert.equal(history.length, 30);
    assert.ok(history[0].capturedAt < history.at(-1).capturedAt);
    assert.ok(history[0].offers.length > 0);
  });
});

describe('price aggregation', () => {
  let productId;

  before(async () => {
    const { upsertProduct } = modules.catalog;
    const { recordOffers } = modules.prices;
    const product = upsertProduct({
      key: 'upc:111111111111',
      title: 'Test Widget',
      upc: '111111111111',
      isMock: true,
      sources: { mock: { sourceId: 'test-widget' } },
    });
    productId = product.id;

    recordOffers(productId, [
      { retailer: 'Amazon', priceCents: 10000, shippingCents: 0, totalCents: 10000, source: 'mock' },
      { retailer: 'Walmart', priceCents: 9500, shippingCents: 999, totalCents: 10499, source: 'mock' },
      { retailer: 'Target', priceCents: 9000, shippingCents: 0, totalCents: 9000, inStock: false, source: 'mock' },
    ]);
  });

  test('offers sort by total price and the cheapest in-stock one is the best deal', () => {
    const offers = modules.prices.getCurrentOffers(productId);
    assert.deepEqual(
      offers.map((o) => o.retailer),
      ['Target', 'Amazon', 'Walmart'],
    );
    const best = offers.find((o) => o.isBestDeal);
    // Target is cheaper but out of stock, so Amazon wins.
    assert.equal(best.retailer, 'Amazon');
  });

  test('shipping is included in the total used for comparison', () => {
    const offers = modules.prices.getCurrentOffers(productId);
    const walmart = offers.find((o) => o.retailer === 'Walmart');
    assert.equal(walmart.totalCents, 10499);
    assert.ok(walmart.totalCents > offers.find((o) => o.retailer === 'Amazon').totalCents);
  });

  test('only the latest snapshot per retailer counts as current', () => {
    modules.prices.recordOffers(productId, [
      { retailer: 'Amazon', priceCents: 8000, shippingCents: 0, totalCents: 8000, source: 'mock' },
    ]);
    const offers = modules.prices.getCurrentOffers(productId);
    const amazon = offers.filter((o) => o.retailer === 'Amazon');
    assert.equal(amazon.length, 1);
    assert.equal(amazon[0].priceCents, 8000);
  });

  test('stats report the all-time low once the price bottoms out', () => {
    const stats = modules.prices.getStats(productId, 90);
    assert.equal(stats.currentBestTotalCents, 8000);
    assert.equal(stats.allTimeLowCents, 8000);
    assert.equal(stats.isAllTimeLow, true);
  });
});

describe('alert rules', () => {
  const baseStats = {
    days: 90,
    avgCents: 20000,
    dataPoints: 30,
    isAllTimeLow: false,
    percentBelowAverage: 25,
  };
  const watch = {
    target_price_cents: 15000,
    notify_below_avg: 1,
    notify_all_time_low: 1,
  };

  test('fires when the best total reaches the target', () => {
    const alert = modules.alerts.evaluateWatch(watch, { totalCents: 15000 }, baseStats);
    assert.equal(alert.type, 'target_hit');
  });

  test('stays quiet above the target when nothing else qualifies', () => {
    const alert = modules.alerts.evaluateWatch(
      { ...watch, notify_below_avg: 0, notify_all_time_low: 0 },
      { totalCents: 19000 },
      baseStats,
    );
    assert.equal(alert, null);
  });

  test('an all-time low fires even without a target', () => {
    const alert = modules.alerts.evaluateWatch(
      { ...watch, target_price_cents: null },
      { totalCents: 17000 },
      { ...baseStats, isAllTimeLow: true },
    );
    assert.equal(alert.type, 'all_time_low');
  });

  test('below-average needs enough history to be meaningful', () => {
    const quiet = modules.alerts.evaluateWatch(
      { ...watch, target_price_cents: null },
      { totalCents: 15000 },
      { ...baseStats, dataPoints: 2 },
    );
    assert.equal(quiet, null);

    const fires = modules.alerts.evaluateWatch(
      { ...watch, target_price_cents: null },
      { totalCents: 15000 },
      baseStats,
    );
    assert.equal(fires.type, 'below_average');
  });

  test('no offers means no alert', () => {
    assert.equal(modules.alerts.evaluateWatch(watch, null, baseStats), null);
  });
});
