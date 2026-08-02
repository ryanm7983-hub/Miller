import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { ZodError } from 'zod';
import { config } from './config.js';
import { rateLimit } from './lib/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { searchRouter } from './routes/search.js';
import { productsRouter } from './routes/products.js';
import { watchlistRouter } from './routes/watchlist.js';
import { notificationsRouter } from './routes/notifications.js';
import { providerInfo, isMockOnly } from './providers/index.js';

export function createApp() {
  const app = express();

  // Behind Render/Fly/Cloud Run, the client IP arrives in X-Forwarded-For.
  if (config.limits.trustProxy) app.set('trust proxy', 1);

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  if (!process.env.SILENT) app.use(morgan('tiny'));

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      env: config.env,
      providers: providerInfo(),
      usingMockData: isMockOnly(),
    });
  });

  // Search fans out to paid provider APIs, so it is the endpoint worth capping.
  app.use('/api/search', rateLimit({
    max: config.limits.searchPerMinute,
    message: 'Too many searches in a row — give it a minute.',
  }));
  app.use('/api/auth', rateLimit({
    max: config.limits.authPerMinute,
    message: 'Too many attempts — try again in a minute.',
  }));

  app.use('/api/auth', authRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  mountStatic(app);

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

/**
 * Serves the built PWA from the same origin as the API, so a deployment is one
 * service and one URL. Hashed assets are cached hard; index.html never is, so a
 * new build is picked up immediately.
 */
function mountStatic(app) {
  if (!config.static.enabled) return;

  const indexFile = path.join(config.static.dir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    console.warn(
      `[static] SERVE_STATIC is on but ${indexFile} is missing — run "npm run build" first`,
    );
    return;
  }

  app.use(express.static(config.static.dir, {
    index: false,
    setHeaders(res, filePath) {
      if (/\/assets\//.test(filePath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(filePath)) {
        res.set('Cache-Control', 'no-cache');
      }
    },
  }));

  // Client-side routes (/product/:id, /watchlist, …) resolve to the shell.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });

  console.log(`[static] serving the web app from ${config.static.dir}`);
}
