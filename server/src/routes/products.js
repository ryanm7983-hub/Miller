import { Router } from 'express';
import { db } from '../db/index.js';
import { optionalAuth } from '../auth/index.js';
import { getProduct, serializeProduct } from '../services/catalog.js';
import {
  getCurrentOffers,
  getHistory,
  getStats,
  refreshProduct,
} from '../services/prices.js';
import { providerInfo } from '../providers/index.js';

export const productsRouter = Router();

function loadProduct(req, res) {
  const product = getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  return product;
}

function watchFor(userId, productId) {
  if (!userId) return null;
  const row = db
    .prepare('SELECT * FROM watches WHERE user_id = ? AND product_id = ?')
    .get(userId, productId);
  return row ? serializeWatch(row) : null;
}

export function serializeWatch(row) {
  return {
    id: row.id,
    productId: row.product_id,
    targetPriceCents: row.target_price_cents,
    notifyBelowAverage: row.notify_below_avg === 1,
    notifyAllTimeLow: row.notify_all_time_low === 1,
    emailAlerts: row.email_alerts === 1,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/** GET /api/products/:id — detail page payload. */
productsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const product = loadProduct(req, res);
    if (!product) return;

    const days = Number(req.query.days ?? 90);
    // Quote again if our last observation is stale (no-op when fresh).
    const { errors } = await refreshProduct(product);

    res.json({
      product: serializeProduct(getProduct(product.id)),
      offers: getCurrentOffers(product.id),
      stats: getStats(product.id, days),
      history: getHistory(product.id, days),
      watch: watchFor(req.user?.id, product.id),
      providers: providerInfo(),
      errors,
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/products/:id/history?days=30|90|365 */
productsRouter.get('/:id/history', (req, res, next) => {
  try {
    const product = loadProduct(req, res);
    if (!product) return;
    const days = [30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
    res.json({ history: getHistory(product.id, days), stats: getStats(product.id, days) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/products/:id/refresh — force a re-quote now. */
productsRouter.post('/:id/refresh', async (req, res, next) => {
  try {
    const product = loadProduct(req, res);
    if (!product) return;
    const { refreshed, errors } = await refreshProduct(product, { force: true });
    res.json({
      refreshed,
      offers: getCurrentOffers(product.id),
      stats: getStats(product.id, 90),
      errors,
    });
  } catch (error) {
    next(error);
  }
});
