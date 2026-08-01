import { db } from '../db/index.js';
import { matchKey, productIdFor } from './normalize.js';

/**
 * Persists a merged provider match as a tracked product and remembers each
 * provider's identity for it, so scheduled refreshes can re-query directly.
 *
 * @param {object} match Merged match from `searchProviders`.
 * @returns {object} The stored product row.
 */
export function upsertProduct(match) {
  const key = match.key ?? matchKey(match);
  const id = match.id ?? productIdFor(key);
  const origin = match.isMock ? 'mock' : Object.keys(match.sources ?? {})[0] ?? 'unknown';

  db.prepare(`
    INSERT INTO products (id, title, brand, model, upc, image_url, category, origin)
    VALUES (@id, @title, @brand, @model, @upc, @imageUrl, @category, @origin)
    ON CONFLICT(id) DO UPDATE SET
      title      = excluded.title,
      brand      = COALESCE(excluded.brand, products.brand),
      model      = COALESCE(excluded.model, products.model),
      upc        = COALESCE(excluded.upc, products.upc),
      image_url  = COALESCE(excluded.image_url, products.image_url),
      category   = COALESCE(excluded.category, products.category),
      updated_at = datetime('now')
  `).run({
    id,
    title: match.title,
    brand: match.brand ?? null,
    model: match.model ?? null,
    upc: match.upc ?? null,
    imageUrl: match.imageUrl ?? null,
    category: match.category ?? null,
    origin,
  });

  const upsertSource = db.prepare(`
    INSERT INTO product_sources (product_id, provider, source_id, url, payload)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product_id, provider) DO UPDATE SET
      source_id  = excluded.source_id,
      url        = COALESCE(excluded.url, product_sources.url),
      payload    = COALESCE(excluded.payload, product_sources.payload),
      updated_at = datetime('now')
  `);

  for (const [provider, ref] of Object.entries(match.sources ?? {})) {
    upsertSource.run(
      id,
      provider,
      String(ref.sourceId ?? id),
      ref.url ?? null,
      ref.payload ? JSON.stringify(ref.payload) : null,
    );
  }

  return getProduct(id);
}

export function getProduct(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) ?? null;
}

/** @returns {Record<string, {sourceId: string, url: string|null, payload: any}>} */
export function getProductSources(productId) {
  const rows = db
    .prepare('SELECT provider, source_id, url, payload FROM product_sources WHERE product_id = ?')
    .all(productId);
  const out = {};
  for (const row of rows) {
    out[row.provider] = {
      sourceId: row.source_id,
      url: row.url,
      payload: row.payload ? safeParse(row.payload) : null,
    };
  }
  return out;
}

export function markRefreshed(productId) {
  db.prepare("UPDATE products SET last_refreshed_at = datetime('now') WHERE id = ?").run(productId);
}

export function serializeProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    model: product.model,
    upc: product.upc,
    imageUrl: product.image_url,
    category: product.category,
    origin: product.origin,
    isMock: product.origin === 'mock',
    lastRefreshedAt: toIso(product.last_refreshed_at),
    createdAt: toIso(product.created_at),
  };
}

export function toIso(sqlTime) {
  if (!sqlTime) return null;
  return `${String(sqlTime).replace(' ', 'T')}Z`;
}

export function toSqlTime(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
