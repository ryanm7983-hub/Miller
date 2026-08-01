/** Runs the scheduled price refresh a single time (handy for cron/CI). */
import { runPriceRefresh } from '../jobs/refreshPrices.js';

runPriceRefresh()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
