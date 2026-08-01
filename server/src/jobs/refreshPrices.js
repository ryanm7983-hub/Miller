import cron from 'node-cron';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { refreshProduct } from '../services/prices.js';
import { evaluateWatchesForProduct } from '../services/alerts.js';

let running = false;

/**
 * Re-quotes every watched product, appends the result to price history and
 * fires any alerts that now qualify.
 *
 * Products are ordered by staleness and capped at `PRICE_REFRESH_BATCH` per run
 * so a large watchlist cannot blow through a paid API quota in one go.
 */
export async function runPriceRefresh({ limit = config.jobs.refreshBatchSize } = {}) {
  if (running) {
    console.log('[jobs] refresh already in progress — skipping this tick');
    return { skipped: true };
  }
  running = true;
  const startedAt = Date.now();

  try {
    const products = db.prepare(`
      SELECT p.* FROM products p
      WHERE EXISTS (SELECT 1 FROM watches w WHERE w.product_id = p.id AND w.active = 1)
      ORDER BY COALESCE(p.last_refreshed_at, '1970-01-01') ASC
      LIMIT ?
    `).all(limit);

    let refreshed = 0;
    let alerts = 0;
    const errors = [];

    for (const product of products) {
      try {
        const result = await refreshProduct(product, { force: true });
        if (result.refreshed) refreshed += 1;
        errors.push(...result.errors);
        const created = await evaluateWatchesForProduct(product.id);
        alerts += created.length;
      } catch (error) {
        console.warn(`[jobs] refresh failed for ${product.id}:`, error.message);
        errors.push({ productId: product.id, message: error.message });
      }
    }

    const summary = {
      checked: products.length,
      refreshed,
      alerts,
      errors,
      durationMs: Date.now() - startedAt,
    };
    console.log(
      `[jobs] price refresh: ${summary.checked} tracked products, ${refreshed} updated, ${alerts} alerts (${summary.durationMs}ms)`,
    );
    return summary;
  } finally {
    running = false;
  }
}

/** Starts the scheduled refresh unless ENABLE_CRON=false. */
export function startPriceRefreshJob() {
  if (!config.jobs.enabled) {
    console.log('[jobs] scheduled price refresh disabled (ENABLE_CRON=false)');
    return null;
  }
  if (!cron.validate(config.jobs.refreshCron)) {
    console.warn(`[jobs] invalid PRICE_REFRESH_CRON "${config.jobs.refreshCron}" — job not started`);
    return null;
  }
  const task = cron.schedule(config.jobs.refreshCron, () => {
    runPriceRefresh().catch((error) => console.error('[jobs] refresh crashed:', error));
  });
  console.log(`[jobs] price refresh scheduled: "${config.jobs.refreshCron}"`);
  return task;
}
