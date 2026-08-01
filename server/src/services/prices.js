import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';
import { config } from '../config.js';
import { fetchOffers, getProvider } from '../providers/index.js';
import { getProductSources, markRefreshed, toIso, toSqlTime } from './catalog.js';

/**
 * Appends observed offers to price_snapshots.
 *
 * @param {string} productId
 * @param {object[]} offers Normalized offers, each tagged with `source`.
 * @param {{ synthetic?: boolean, capturedAt?: Date }} [opts]
 */
export function recordOffers(productId, offers, opts = {}) {
  const { synthetic = false, capturedAt } = opts;
  const insert = db.prepare(`
    INSERT INTO price_snapshots (
      id, product_id, retailer, retailer_sku, url, price_cents, shipping_cents,
      total_cents, currency, in_stock, condition, delivery_estimate, source,
      synthetic, captured_at
    ) VALUES (
      @id, @productId, @retailer, @retailerSku, @url, @priceCents, @shippingCents,
      @totalCents, @currency, @inStock, @condition, @deliveryEstimate, @source,
      @synthetic, @capturedAt
    )
  `);

  const runAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  const rows = offers.filter(Boolean).map((offer) => ({
    id: newId('snap'),
    productId,
    retailer: offer.retailer,
    retailerSku: offer.retailerSku ?? null,
    url: offer.url ?? null,
    priceCents: offer.priceCents,
    shippingCents: offer.shippingCents ?? 0,
    totalCents: offer.totalCents ?? offer.priceCents + (offer.shippingCents ?? 0),
    currency: offer.currency ?? 'USD',
    inStock: offer.inStock === false ? 0 : 1,
    condition: offer.condition ?? 'new',
    deliveryEstimate: offer.deliveryEstimate ?? null,
    source: offer.source ?? 'unknown',
    synthetic: synthetic ? 1 : 0,
    capturedAt: capturedAt ? toSqlTime(capturedAt) : toSqlTime(new Date()),
  }));

  runAll(rows);
  return rows.length;
}

/** Most recent snapshot per retailer, cheapest total first. */
export function getCurrentOffers(productId) {
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY retailer ORDER BY captured_at DESC, rowid DESC
      ) AS rn
      FROM price_snapshots WHERE product_id = ?
    ) WHERE rn = 1
    ORDER BY total_cents ASC
  `).all(productId);

  const inStock = rows.filter((r) => r.in_stock === 1);
  const bestId = inStock[0]?.id ?? null;

  return rows.map((row) => ({
    id: row.id,
    retailer: row.retailer,
    url: row.url,
    priceCents: row.price_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    inStock: row.in_stock === 1,
    condition: row.condition,
    deliveryEstimate: row.delivery_estimate,
    source: row.source,
    isMock: row.source === 'mock',
    capturedAt: toIso(row.captured_at),
    isBestDeal: row.id === bestId,
  }));
}

/** Cheapest in-stock total right now, or null when nothing is in stock. */
export function getBestOffer(productId) {
  const row = db.prepare(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY retailer ORDER BY captured_at DESC, rowid DESC
      ) AS rn
      FROM price_snapshots WHERE product_id = ?
    ) WHERE rn = 1 AND in_stock = 1
    ORDER BY total_cents ASC LIMIT 1
  `).get(productId);
  if (!row) return null;
  return {
    retailer: row.retailer,
    url: row.url,
    priceCents: row.price_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    source: row.source,
    capturedAt: toIso(row.captured_at),
  };
}

/**
 * Daily price series for the chart: one point per calendar day holding the
 * blended best total plus each retailer's own best total that day.
 *
 * @param {string} productId
 * @param {number} days 30 | 90 | 365
 */
export function getHistory(productId, days = 90) {
  const rows = db.prepare(`
    SELECT date(captured_at) AS day,
           retailer,
           MIN(total_cents) AS total_cents,
           MAX(synthetic)   AS synthetic
    FROM price_snapshots
    WHERE product_id = ?
      AND in_stock = 1
      AND captured_at >= datetime('now', ?)
    GROUP BY day, retailer
    ORDER BY day ASC
  `).all(productId, `-${Number(days)} days`);

  const byDay = new Map();
  const retailers = new Set();
  let anySynthetic = false;
  let anyReal = false;

  for (const row of rows) {
    retailers.add(row.retailer);
    if (row.synthetic === 1) anySynthetic = true;
    else anyReal = true;
    let point = byDay.get(row.day);
    if (!point) {
      point = { date: row.day, bestTotalCents: row.total_cents, retailers: {} };
      byDay.set(row.day, point);
    }
    point.retailers[row.retailer] = row.total_cents;
    point.bestTotalCents = Math.min(point.bestTotalCents, row.total_cents);
  }

  return {
    days,
    series: [...byDay.values()],
    retailers: [...retailers].sort(),
    /** true when part of the window is back-filled sample history. */
    containsSyntheticData: anySynthetic,
    containsLiveData: anyReal,
  };
}

/**
 * Min / max / average over the requested window, plus all-time low detection
 * and a recent-drop flag used for the "price dropped" badge.
 */
export function getStats(productId, days = 90) {
  const window = db.prepare(`
    SELECT MIN(best) AS min_cents, MAX(best) AS max_cents, AVG(best) AS avg_cents, COUNT(*) AS points
    FROM (
      SELECT date(captured_at) AS day, MIN(total_cents) AS best
      FROM price_snapshots
      WHERE product_id = ? AND in_stock = 1 AND captured_at >= datetime('now', ?)
      GROUP BY day
    )
  `).get(productId, `-${Number(days)} days`);

  const allTime = db.prepare(`
    SELECT MIN(total_cents) AS min_cents, MAX(total_cents) AS max_cents
    FROM price_snapshots WHERE product_id = ? AND in_stock = 1
  `).get(productId);

  const best = getBestOffer(productId);
  const current = best?.totalCents ?? null;

  // Best price roughly a week ago, for the "recently dropped" indicator.
  const previous = db.prepare(`
    SELECT MIN(total_cents) AS best
    FROM price_snapshots
    WHERE product_id = ? AND in_stock = 1
      AND captured_at BETWEEN datetime('now', '-10 days') AND datetime('now', '-3 days')
  `).get(productId)?.best ?? null;

  const avg = window?.avg_cents != null ? Math.round(window.avg_cents) : null;
  const dropPct =
    current != null && previous ? Math.round(((previous - current) / previous) * 1000) / 10 : null;

  return {
    days,
    currentBestTotalCents: current,
    minCents: window?.min_cents ?? null,
    maxCents: window?.max_cents ?? null,
    avgCents: avg,
    dataPoints: window?.points ?? 0,
    allTimeLowCents: allTime?.min_cents ?? null,
    allTimeHighCents: allTime?.max_cents ?? null,
    isAllTimeLow: current != null && allTime?.min_cents != null && current <= allTime.min_cents,
    isBelowAverage: current != null && avg != null && current < avg,
    percentBelowAverage:
      current != null && avg ? Math.round(((avg - current) / avg) * 1000) / 10 : null,
    recentDropPercent: dropPct != null && dropPct > 0 ? dropPct : null,
    /** UI badge: a meaningful drop within the last ~week. */
    hasRecentDrop: dropPct != null && dropPct >= 3,
  };
}

export function hasSnapshots(productId) {
  return (
    db.prepare('SELECT 1 FROM price_snapshots WHERE product_id = ? LIMIT 1').get(productId) !==
    undefined
  );
}

function minutesSince(sqlTime) {
  if (!sqlTime) return Infinity;
  const then = Date.parse(`${String(sqlTime).replace(' ', 'T')}Z`);
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 60000;
}

/**
 * Seeds sample history for a product when the mock provider is active and the
 * product has no history yet. Rows are written with `synthetic = 1` and the API
 * reports `containsSyntheticData` so the UI can label the chart.
 */
export function backfillMockHistory(product, { days = 365, stepDays = 1 } = {}) {
  const mock = getProvider('mock');
  if (!mock) return 0;

  const alreadySeeded = db
    .prepare('SELECT 1 FROM price_snapshots WHERE product_id = ? AND synthetic = 1 LIMIT 1')
    .get(product.id);
  if (alreadySeeded) return 0;

  const refs = getProductSources(product.id);
  const history = mock.buildHistory(product, refs.mock, days, stepDays);
  let written = 0;
  for (const point of history) {
    written += recordOffers(
      product.id,
      point.offers.map((o) => ({ ...o, source: 'mock' })),
      { synthetic: true, capturedAt: point.capturedAt },
    );
  }
  return written;
}

/**
 * Re-quotes a product and appends the result to its history.
 *
 * @param {object} product products row
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ refreshed: boolean, offers: object[], errors: object[] }>}
 */
export async function refreshProduct(product, { force = false } = {}) {
  const fresh =
    !force &&
    hasSnapshots(product.id) &&
    minutesSince(product.last_refreshed_at) < config.jobs.minRefreshIntervalMinutes;

  if (fresh) {
    return { refreshed: false, offers: getCurrentOffers(product.id), errors: [] };
  }

  const refs = getProductSources(product.id);
  const { offers, errors } = await fetchOffers(product, refs);

  if (offers.length > 0) {
    recordOffers(product.id, offers);
    markRefreshed(product.id);
  }

  // Sample data only: fill in the past so the chart has something to draw.
  backfillMockHistory(product);

  return { refreshed: offers.length > 0, offers: getCurrentOffers(product.id), errors };
}
