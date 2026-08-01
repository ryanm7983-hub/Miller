import { createApp } from './app.js';
import { config } from './config.js';
import { startPriceRefreshJob } from './jobs/refreshPrices.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[api] PriceScout API listening on http://localhost:${config.port}`);
  startPriceRefreshJob();
});
