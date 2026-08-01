import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';
import { getBestOffer, getStats } from './prices.js';
import { priceAlertEmail, sendEmail } from './mailer.js';

/** Re-alerting is suppressed unless the price improves, or this long passes. */
const REALERT_AFTER_HOURS = 168; // 7 days
/** "Below average" needs a real gap, not rounding noise. */
const BELOW_AVG_MARGIN = 0.98;

export function formatPrice(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);
}

/**
 * Decides whether a watch should fire, given the product's current best offer.
 * Returns the alert to raise, or null.
 */
export function evaluateWatch(watch, best, stats) {
  if (!best) return null;
  const price = best.totalCents;

  if (watch.target_price_cents != null && price <= watch.target_price_cents) {
    return {
      type: 'target_hit',
      title: 'Target price reached',
      reason: `Now at or below your ${formatPrice(watch.target_price_cents)} target.`,
    };
  }

  if (watch.notify_all_time_low === 1 && stats.isAllTimeLow && stats.dataPoints > 1) {
    return {
      type: 'all_time_low',
      title: 'Lowest price we have seen',
      reason: 'This is the lowest total price recorded since tracking began.',
    };
  }

  if (
    watch.notify_below_avg === 1 &&
    stats.avgCents != null &&
    stats.dataPoints >= 5 &&
    price <= Math.round(stats.avgCents * BELOW_AVG_MARGIN)
  ) {
    return {
      type: 'below_average',
      title: 'Below its usual price',
      reason: `${stats.percentBelowAverage}% below the ${stats.days}-day average of ${formatPrice(stats.avgCents)}.`,
    };
  }

  return null;
}

/** Suppresses repeat alerts while a price simply sits below the threshold. */
function shouldSuppress(watch, price) {
  if (watch.last_alert_at == null) return false;
  if (watch.last_alert_price_cents != null && price < watch.last_alert_price_cents) return false;
  const lastMs = Date.parse(`${String(watch.last_alert_at).replace(' ', 'T')}Z`);
  const hours = (Date.now() - lastMs) / 3_600_000;
  return hours < REALERT_AFTER_HOURS;
}

/**
 * Evaluates every active watch on a product and creates notifications.
 *
 * @param {string} productId
 * @returns {Promise<object[]>} notifications created
 */
export async function evaluateWatchesForProduct(productId) {
  const watches = db
    .prepare('SELECT * FROM watches WHERE product_id = ? AND active = 1')
    .all(productId);
  if (watches.length === 0) return [];

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  const best = getBestOffer(productId);
  const stats = getStats(productId, 90);
  const created = [];

  for (const watch of watches) {
    const alert = evaluateWatch(watch, best, stats);
    if (!alert || shouldSuppress(watch, best.totalCents)) continue;

    const priceText = formatPrice(best.totalCents, best.currency);
    const id = newId('ntf');
    db.prepare(`
      INSERT INTO notifications (id, user_id, product_id, watch_id, type, title, body, price_cents, retailer, url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      watch.user_id,
      productId,
      watch.id,
      alert.type,
      alert.title,
      `${product.title} — ${priceText} at ${best.retailer}. ${alert.reason}`,
      best.totalCents,
      best.retailer,
      best.url,
    );

    db.prepare(`
      UPDATE watches
      SET last_alert_price_cents = ?, last_alert_at = datetime('now')
      WHERE id = ?
    `).run(best.totalCents, watch.id);

    created.push({ id, watchId: watch.id, userId: watch.user_id, type: alert.type });

    if (watch.email_alerts === 1) {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(watch.user_id);
      if (user?.email) {
        const body = priceAlertEmail({
          productTitle: product.title,
          productId,
          retailer: best.retailer,
          priceText,
          reason: alert.reason,
        });
        const sent = await sendEmail({
          to: user.email,
          subject: `${alert.title}: ${product.title}`,
          ...body,
        });
        if (sent) {
          db.prepare("UPDATE notifications SET emailed_at = datetime('now') WHERE id = ?").run(id);
        }
      }
    }
  }

  return created;
}
