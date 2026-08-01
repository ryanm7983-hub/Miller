import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pricescout-api-')), 'test.db');
process.env.DATABASE_FILE = dbFile;
process.env.PRICE_PROVIDERS = 'mock';
process.env.ENABLE_CRON = 'false';
process.env.JWT_SECRET = 'test-secret';
process.env.SILENT = '1';

let server;
let baseUrl;

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

before(async () => {
  const { createApp } = await import('../src/app.js');
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });
});

after(() => server?.close());

describe('search', () => {
  test('rejects an empty query', async () => {
    const { status } = await call('/search?q=');
    assert.equal(status, 400);
  });

  test('finds a product by name and reports the sample-data source', async () => {
    const { status, body } = await call('/search?q=sony%20wh-1000xm5');
    assert.equal(status, 200);
    assert.equal(body.kind, 'text');
    assert.equal(body.usingMockData, true);
    assert.ok(body.results.length > 0);
    const [first] = body.results;
    assert.equal(first.product.isMock, true);
    assert.ok(first.bestOffer.totalCents > 0);
  });

  test('classifies barcodes and URLs', async () => {
    const barcode = await call('/search?q=045496882730');
    assert.equal(barcode.body.kind, 'barcode');
    assert.match(barcode.body.results[0].product.title, /Nintendo Switch OLED/);

    const url = await call(
      `/search?q=${encodeURIComponent('https://www.walmart.com/ip/Dyson-V15-Detect-Cordless-Vacuum/1')}`,
    );
    assert.equal(url.body.kind, 'url');
    assert.match(url.body.results[0].product.title, /Dyson V15/);
  });

  test('the same product resolves to the same id across searches', async () => {
    const first = await call('/search?q=airpods%20pro');
    const second = await call('/search?q=Apple%20AirPods%20Pro');
    assert.equal(first.body.results[0].product.id, second.body.results[0].product.id);
  });
});

describe('product detail', () => {
  let productId;

  before(async () => {
    const { body } = await call('/search?q=sony%20wh-1000xm5');
    productId = body.results[0].product.id;
  });

  test('returns offers sorted cheapest-first with one best deal', async () => {
    const { status, body } = await call(`/products/${productId}`);
    assert.equal(status, 200);
    assert.ok(body.offers.length > 1);
    const totals = body.offers.map((o) => o.totalCents);
    assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
    assert.equal(body.offers.filter((o) => o.isBestDeal).length, 1);
  });

  test('history windows respect the requested number of days', async () => {
    const short = await call(`/products/${productId}/history?days=30`);
    const long = await call(`/products/${productId}/history?days=365`);
    assert.ok(short.body.history.series.length <= 31);
    assert.ok(long.body.history.series.length > short.body.history.series.length);
    assert.equal(long.body.history.containsSyntheticData, true);
  });

  test('an unknown product is a 404', async () => {
    const { status } = await call('/products/ps_does_not_exist');
    assert.equal(status, 404);
  });
});

describe('auth and watchlist', () => {
  let token;
  let productId;

  before(async () => {
    const search = await call('/search?q=nintendo%20switch%20oled');
    productId = search.body.results[0].product.id;
  });

  test('registration issues a token', async () => {
    const { status, body } = await call('/auth/register', {
      method: 'POST',
      body: { email: 'watcher@example.com', password: 'supersecret' },
    });
    assert.equal(status, 201);
    assert.ok(body.token);
    token = body.token;
  });

  test('rejects a short password and duplicate emails', async () => {
    const short = await call('/auth/register', {
      method: 'POST',
      body: { email: 'x@example.com', password: 'short' },
    });
    assert.equal(short.status, 400);

    const dupe = await call('/auth/register', {
      method: 'POST',
      body: { email: 'watcher@example.com', password: 'supersecret' },
    });
    assert.equal(dupe.status, 409);
  });

  test('the watchlist requires authentication', async () => {
    const { status } = await call('/watchlist');
    assert.equal(status, 401);
  });

  test('tracking a product with a generous target raises an alert', async () => {
    const detail = await call(`/products/${productId}`);
    const currentBest = detail.body.stats.currentBestTotalCents;

    const created = await call('/watchlist', {
      method: 'POST',
      token,
      body: { productId, targetPriceCents: currentBest + 5000 },
    });
    assert.equal(created.status, 201);

    const list = await call('/watchlist', { token });
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].targetMet, true);

    const alerts = await call('/notifications', { token });
    assert.ok(alerts.body.unreadCount >= 1);
    assert.equal(alerts.body.notifications[0].type, 'target_hit');
  });

  test('notifications can be marked read', async () => {
    const before = await call('/notifications', { token });
    const [notification] = before.body.notifications;
    const marked = await call(`/notifications/${notification.id}/read`, { method: 'POST', token });
    assert.equal(marked.status, 200);

    const after = await call('/notifications', { token });
    assert.equal(after.body.unreadCount, 0);
  });

  test('a watch can be removed', async () => {
    const list = await call('/watchlist', { token });
    const { id } = list.body.items[0].watch;
    const removed = await call(`/watchlist/${id}`, { method: 'DELETE', token });
    assert.equal(removed.status, 204);

    const empty = await call('/watchlist', { token });
    assert.equal(empty.body.items.length, 0);
  });

  test("another user cannot delete someone else's watch", async () => {
    const mine = await call('/watchlist', {
      method: 'POST',
      token,
      body: { productId, targetPriceCents: 1000 },
    });
    assert.equal(mine.status, 201);

    const other = await call('/auth/register', {
      method: 'POST',
      body: { email: 'intruder@example.com', password: 'supersecret' },
    });
    const list = await call('/watchlist', { token });
    const watchId = list.body.items[0].watch.id;

    const attempt = await call(`/watchlist/${watchId}`, {
      method: 'DELETE',
      token: other.body.token,
    });
    assert.equal(attempt.status, 404);
  });
});

describe('scheduled refresh job', () => {
  test('re-quotes tracked products and appends history', async () => {
    const { runPriceRefresh } = await import('../src/jobs/refreshPrices.js');
    const summary = await runPriceRefresh({ limit: 10 });
    assert.ok(summary.checked >= 1);
    assert.equal(summary.errors.length, 0);
  });
});
