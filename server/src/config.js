import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * `PRICE_PROVIDERS` picks which PriceProvider implementations are active, in
 * priority order. `mock` is the built-in offline provider that generates
 * deterministic sample data — it is the default so the app runs with zero keys.
 */
export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseFile: path.resolve(
    serverRoot,
    process.env.DATABASE_FILE ?? 'data/pricescout.db',
  ),
  corsOrigins: list(process.env.CORS_ORIGIN, ['http://localhost:5173']),

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    tokenTtl: process.env.JWT_TTL ?? '30d',
  },

  providers: {
    enabled: list(process.env.PRICE_PROVIDERS, ['mock']),
    serpApiKey: process.env.SERPAPI_KEY ?? '',
    rainforestApiKey: process.env.RAINFOREST_API_KEY ?? '',
    /** Country/locale hints passed through to providers that support them. */
    country: process.env.PROVIDER_COUNTRY ?? 'us',
    language: process.env.PROVIDER_LANGUAGE ?? 'en',
    timeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS ?? 12000),
  },

  jobs: {
    enabled: bool(process.env.ENABLE_CRON, true),
    /** Default: every 6 hours, on the hour. */
    refreshCron: process.env.PRICE_REFRESH_CRON ?? '0 */6 * * *',
    /** Max tracked products refreshed per run (keeps paid API spend bounded). */
    refreshBatchSize: Number(process.env.PRICE_REFRESH_BATCH ?? 50),
    /** Skip a product if it was refreshed more recently than this. */
    minRefreshIntervalMinutes: Number(process.env.MIN_REFRESH_MINUTES ?? 60),
  },

  mail: {
    /** Email is optional — without a key we only create in-app notifications. */
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'PriceScout <alerts@example.com>',
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  },
};

if (isProduction && config.auth.jwtSecret === 'dev-only-insecure-secret-change-me') {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}
