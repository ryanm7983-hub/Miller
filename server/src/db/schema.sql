-- PriceScout schema. All money is stored as integer cents in `currency`.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A product is the normalized entity we track over time. `id` is deterministic
-- (see services/catalog.js) so the same item found via different providers or
-- search terms collapses onto one row.
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  brand             TEXT,
  model             TEXT,
  upc               TEXT,
  image_url         TEXT,
  category          TEXT,
  -- 'mock' when the row came from sample data, otherwise the provider name.
  origin            TEXT NOT NULL DEFAULT 'mock',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_refreshed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);

-- Per-provider identity for a product, so scheduled refreshes can re-query the
-- exact upstream record instead of re-running a text search.
CREATE TABLE IF NOT EXISTS product_sources (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  source_id  TEXT NOT NULL,
  url        TEXT,
  payload    TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, provider)
);

-- One row per observed listing, appended forever. The current price for a
-- retailer is simply its most recent snapshot.
CREATE TABLE IF NOT EXISTS price_snapshots (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer          TEXT NOT NULL,
  retailer_sku      TEXT,
  url               TEXT,
  price_cents       INTEGER NOT NULL,
  shipping_cents    INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  in_stock          INTEGER NOT NULL DEFAULT 1,
  condition         TEXT NOT NULL DEFAULT 'new',
  delivery_estimate TEXT,
  -- Provider that produced this observation ('mock' for sample data).
  source            TEXT NOT NULL,
  -- 1 when the row is back-filled sample history rather than a real observation.
  synthetic         INTEGER NOT NULL DEFAULT 0,
  captured_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product_time
  ON price_snapshots(product_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_product_retailer_time
  ON price_snapshots(product_id, retailer, captured_at DESC);

CREATE TABLE IF NOT EXISTS watches (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Alert when best total price <= this. NULL means "no explicit target".
  target_price_cents INTEGER,
  notify_below_avg   INTEGER NOT NULL DEFAULT 1,
  notify_all_time_low INTEGER NOT NULL DEFAULT 1,
  email_alerts       INTEGER NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  -- Best total price seen at the moment the alert last fired, used to avoid
  -- re-notifying on every refresh while a price sits below target.
  last_alert_price_cents INTEGER,
  last_alert_at      TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_watches_user ON watches(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES products(id) ON DELETE CASCADE,
  watch_id    TEXT REFERENCES watches(id) ON DELETE SET NULL,
  -- 'target_hit' | 'below_average' | 'all_time_low' | 'price_drop'
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  price_cents INTEGER,
  retailer    TEXT,
  url         TEXT,
  read_at     TEXT,
  emailed_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_time
  ON notifications(user_id, created_at DESC);
