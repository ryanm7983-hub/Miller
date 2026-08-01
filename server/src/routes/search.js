import { Router } from 'express';
import { searchProviders, providerInfo, isMockOnly } from '../providers/index.js';
import { ingestMatch } from '../services/ingest.js';
import { serializeProduct } from '../services/catalog.js';
import { getBestOffer, getCurrentOffers, getStats } from '../services/prices.js';

export const searchRouter = Router();

/**
 * GET /api/search?q=<text | product URL | barcode digits>
 *
 * Fans out to every active PriceProvider, normalizes and stores the matches,
 * then returns each candidate with its current best offer.
 */
searchRouter.get('/', async (req, res, next) => {
  try {
    const query = String(req.query.q ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 8) || 8, 20);

    if (!query) {
      return res.status(400).json({ error: 'Provide a search term with ?q=' });
    }

    const { matches, errors, kind } = await searchProviders(query, { limit });

    const results = matches.map((match) => {
      const product = ingestMatch(match);
      const offers = getCurrentOffers(product.id);
      return {
        product: serializeProduct(product),
        bestOffer: getBestOffer(product.id),
        offerCount: offers.length,
        retailers: offers.map((o) => o.retailer),
        stats: getStats(product.id, 90),
      };
    });

    res.json({
      query,
      kind,
      results,
      providers: providerInfo(),
      usingMockData: isMockOnly(),
      errors,
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/search/providers — which data sources are live vs sample. */
searchRouter.get('/providers', (_req, res) => {
  res.json({ providers: providerInfo(), usingMockData: isMockOnly() });
});
