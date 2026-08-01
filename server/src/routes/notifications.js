import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../auth/index.js';
import { toIso } from '../services/catalog.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function serialize(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.product_title ?? null,
    type: row.type,
    title: row.title,
    body: row.body,
    priceCents: row.price_cents,
    retailer: row.retailer,
    url: row.url,
    read: row.read_at != null,
    emailed: row.emailed_at != null,
    createdAt: toIso(row.created_at),
  };
}

/** GET /api/notifications — in-app notification centre. */
notificationsRouter.get('/', (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const rows = db.prepare(`
      SELECT n.*, p.title AS product_title
      FROM notifications n
      LEFT JOIN products p ON p.id = n.product_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `).all(req.user.id, limit);

    const unread = db
      .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .get(req.user.id).count;

    res.json({ notifications: rows.map(serialize), unreadCount: unread });
  } catch (error) {
    next(error);
  }
});

/** POST /api/notifications/:id/read */
notificationsRouter.post('/:id/read', (req, res, next) => {
  try {
    const result = db
      .prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/** POST /api/notifications/read-all */
notificationsRouter.post('/read-all', (req, res, next) => {
  try {
    db.prepare(
      "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL",
    ).run(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
