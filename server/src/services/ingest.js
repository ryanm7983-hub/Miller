import { config } from '../config.js';
import { upsertProduct, markRefreshed } from './catalog.js';
import { backfillMockHistory, hasSnapshots, recordOffers } from './prices.js';

function minutesSince(sqlTime) {
  if (!sqlTime) return Infinity;
  const then = Date.parse(`${String(sqlTime).replace(' ', 'T')}Z`);
  return Number.isNaN(then) ? Infinity : (Date.now() - then) / 60000;
}

/**
 * Turns a merged search match into a tracked product and opportunistically
 * records the offers that came back with the search — searching is itself a
 * price observation, so history starts accruing from the first search.
 *
 * Snapshots are skipped when the product was quoted very recently, to keep
 * repeated searches from flooding the table.
 */
export function ingestMatch(match) {
  const product = upsertProduct(match);

  const offers = (match.offers ?? []).filter(Boolean);
  const stale =
    !hasSnapshots(product.id) ||
    minutesSince(product.last_refreshed_at) >= config.jobs.minRefreshIntervalMinutes;

  if (offers.length > 0 && stale) {
    // Keep the cheapest offer per retailer for this observation.
    const byRetailer = new Map();
    for (const offer of offers) {
      const existing = byRetailer.get(offer.retailer);
      if (!existing || offer.totalCents < existing.totalCents) byRetailer.set(offer.retailer, offer);
    }
    recordOffers(product.id, [...byRetailer.values()]);
    markRefreshed(product.id);
  }

  backfillMockHistory(product);
  return product;
}
