import { createApp } from './app.js';
import { config } from './config.js';
import { startPriceRefreshJob } from './jobs/refreshPrices.js';
import { db } from './db/index.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[api] PriceScout listening on http://localhost:${config.port}`);
  startPriceRefreshJob();
});

/**
 * Platforms like Render and Fly send SIGTERM on deploy. Finish in-flight
 * requests and close SQLite cleanly so the WAL is checkpointed.
 */
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} received — shutting down`);
    server.close(() => {
      try {
        db.close();
      } catch (error) {
        console.warn('[api] database close failed:', error.message);
      }
      process.exit(0);
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
