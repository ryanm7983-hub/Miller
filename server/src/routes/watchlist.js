import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';
import { requireAuth } from '../auth/index.js';
import { getProduct, serializeProduct } from '../services/catalog.js';
import { getBestOffer, getStats, refreshProduct } from '../services/prices.js';
import { evaluateWatchesForProduct } from '../services/alerts.js';
import { serializeWatch } from './products.js';

export const watchlistRouter = Router();
watchlistRouter.use(requireAuth);

const createSchema = z.object({
  productId: z.string().min(1),
  targetPriceCents: z.number().int().positive().nullable().optional(),
  notifyBelowAverage: z.boolean().optional(),
  notifyAllTimeLow: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
});

const updateSchema = createSchema.partial().omit({ productId: true }).extend({
  active: z.boolean().optional(),
});

/** Keeps the stored 0/1 when the caller omitted the flag. */
function boolToInt(input, current) {
  if (input === undefined) return current === 1 ? 1 : 0;
  return input ? 1 : 0;
}

/** GET /api/watchlist — the user's tracked items with live pricing. */
watchlistRouter.get('/', (req, res, next) => {
  try {
    const rows = db
      .prepare('SELECT * FROM watches WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    const items = rows.map((row) => {
      const product = getProduct(row.product_id);
      const stats = getStats(row.product_id, 90);
      const best = getBestOffer(row.product_id);
      return {
        watch: serializeWatch(row),
        product: serializeProduct(product),
        bestOffer: best,
        stats,
        targetMet:
          row.target_price_cents != null && best != null
            ? best.totalCents <= row.target_price_cents
            : false,
      };
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

/** POST /api/watchlist — start tracking a product. */
watchlistRouter.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body ?? {});
    const product = getProduct(input.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = db
      .prepare('SELECT * FROM watches WHERE user_id = ? AND product_id = ?')
      .get(req.user.id, product.id);

    const id = existing?.id ?? newId('wch');

    if (existing) {
      db.prepare(`
        UPDATE watches SET
          target_price_cents  = @target,
          notify_below_avg    = @belowAvg,
          notify_all_time_low = @allTimeLow,
          email_alerts        = @email,
          active              = 1
        WHERE id = @id
      `).run({
        id,
        target: input.targetPriceCents ?? null,
        belowAvg: input.notifyBelowAverage === false ? 0 : 1,
        allTimeLow: input.notifyAllTimeLow === false ? 0 : 1,
        email: input.emailAlerts ? 1 : 0,
      });
    } else {
      db.prepare(`
        INSERT INTO watches (
          id, user_id, product_id, target_price_cents,
          notify_below_avg, notify_all_time_low, email_alerts
        ) VALUES (@id, @userId, @productId, @target, @belowAvg, @allTimeLow, @email)
      `).run({
        id,
        userId: req.user.id,
        productId: product.id,
        target: input.targetPriceCents ?? null,
        belowAvg: input.notifyBelowAverage === false ? 0 : 1,
        allTimeLow: input.notifyAllTimeLow === false ? 0 : 1,
        email: input.emailAlerts ? 1 : 0,
      });
    }

    // A freshly saved target may already be met — check immediately.
    await refreshProduct(product);
    await evaluateWatchesForProduct(product.id);

    const row = db.prepare('SELECT * FROM watches WHERE id = ?').get(id);
    res.status(existing ? 200 : 201).json({ watch: serializeWatch(row) });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/watchlist/:id — change target price or alert preferences. */
watchlistRouter.patch('/:id', async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body ?? {});
    const row = db
      .prepare('SELECT * FROM watches WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Watch not found' });

    db.prepare(`
      UPDATE watches SET
        target_price_cents  = @target,
        notify_below_avg    = @belowAvg,
        notify_all_time_low = @allTimeLow,
        email_alerts        = @email,
        active              = @active,
        last_alert_price_cents = CASE WHEN @target IS NOT @currentTarget THEN NULL ELSE last_alert_price_cents END,
        last_alert_at          = CASE WHEN @target IS NOT @currentTarget THEN NULL ELSE last_alert_at END
      WHERE id = @id
    `).run({
      id: row.id,
      currentTarget: row.target_price_cents,
      target: input.targetPriceCents === undefined ? row.target_price_cents : input.targetPriceCents,
      belowAvg: boolToInt(input.notifyBelowAverage, row.notify_below_avg),
      allTimeLow: boolToInt(input.notifyAllTimeLow, row.notify_all_time_low),
      email: boolToInt(input.emailAlerts, row.email_alerts),
      active: boolToInt(input.active, row.active),
    });

    await evaluateWatchesForProduct(row.product_id);

    const updated = db.prepare('SELECT * FROM watches WHERE id = ?').get(row.id);
    res.json({ watch: serializeWatch(updated) });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/watchlist/:id — stop tracking. */
watchlistRouter.delete('/:id', (req, res, next) => {
  try {
    const result = db
      .prepare('DELETE FROM watches WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Watch not found' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
