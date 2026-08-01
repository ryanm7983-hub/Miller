import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { searchRouter } from './routes/search.js';
import { productsRouter } from './routes/products.js';
import { watchlistRouter } from './routes/watchlist.js';
import { notificationsRouter } from './routes/notifications.js';
import { providerInfo, isMockOnly } from './providers/index.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  if (!process.env.SILENT) app.use(morgan('tiny'));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      env: config.env,
      providers: providerInfo(),
      usingMockData: isMockOnly(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: error.issues[0]?.message ?? 'Invalid request',
        issues: error.issues,
      });
    }
    const status = error.status ?? 500;
    if (status >= 500) console.error('[api]', error);
    res.status(status).json({ error: error.message ?? 'Something went wrong' });
  });

  return app;
}
