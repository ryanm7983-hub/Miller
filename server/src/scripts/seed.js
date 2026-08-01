/**
 * Seeds the database with the sample catalog, a year of sample price history,
 * a demo account and a couple of tracked items (one of which fires an alert).
 *
 * ⚠️ Everything written here is SAMPLE DATA (source = 'mock').
 *
 *   npm run seed
 *   → demo@pricescout.app / demo1234
 */
import { db } from '../db/index.js';
import { MockProvider } from '../providers/MockProvider.js';
import { SAMPLE_PRODUCTS } from '../providers/mock/catalog.js';
import { matchKey } from '../services/normalize.js';
import { upsertProduct, markRefreshed } from '../services/catalog.js';
import { backfillMockHistory, getBestOffer, recordOffers } from '../services/prices.js';
import { evaluateWatchesForProduct } from '../services/alerts.js';
import { createUser } from '../auth/index.js';
import { newId } from '../lib/ids.js';

const provider = new MockProvider();

function toMerged(match) {
  return {
    key: matchKey(match),
    title: match.title,
    brand: match.brand,
    model: match.model,
    upc: match.upc,
    imageUrl: match.imageUrl,
    category: match.category,
    isMock: true,
    sources: {
      mock: { sourceId: match.sourceId, url: match.url ?? null, payload: match.payload ?? null },
    },
    offers: (match.offers ?? []).map((offer) => ({ ...offer, source: 'mock' })),
  };
}

async function seedProducts() {
  const products = [];
  for (const entry of SAMPLE_PRODUCTS) {
    const [match] = await provider.searchByBarcode(entry.upc);
    if (!match) continue;
    const merged = toMerged(match);
    const product = upsertProduct(merged);
    recordOffers(product.id, merged.offers);
    markRefreshed(product.id);
    backfillMockHistory(product, { days: 365, stepDays: 1 });
    products.push(product);
    console.log(`  seeded ${product.title}`);
  }
  return products;
}

function ensureDemoUser() {
  const existing = db.prepare('SELECT id, email FROM users WHERE email = ?').get('demo@pricescout.app');
  if (existing) return existing;
  return createUser('demo@pricescout.app', 'demo1234');
}

async function seedWatches(user, products) {
  const picks = products.slice(0, 3);
  for (const [index, product] of picks.entries()) {
    const best = getBestOffer(product.id);
    if (!best) continue;
    // First pick gets a target just above the current price so the alert fires
    // immediately; the others sit below, waiting for a real drop.
    const target = index === 0
      ? Math.round(best.totalCents * 1.02)
      : Math.round(best.totalCents * 0.85);

    db.prepare(`
      INSERT INTO watches (id, user_id, product_id, target_price_cents, email_alerts)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(user_id, product_id) DO UPDATE SET target_price_cents = excluded.target_price_cents
    `).run(newId('wch'), user.id, product.id, target);

    const alerts = await evaluateWatchesForProduct(product.id);
    console.log(
      `  tracking ${product.title} @ target ${(target / 100).toFixed(2)}${alerts.length ? ' (alert raised)' : ''}`,
    );
  }
}

async function main() {
  console.log('Seeding PriceScout sample data…');
  const products = await seedProducts();
  const user = ensureDemoUser();
  await seedWatches(user, products);

  const snapshots = db.prepare('SELECT COUNT(*) AS c FROM price_snapshots').get().c;
  console.log(`\nDone: ${products.length} products, ${snapshots} price snapshots.`);
  console.log('Demo login: demo@pricescout.app / demo1234');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
