/**
 * Typed environment access with development-safe defaults.
 *
 * Secrets are never inlined into the client bundle: this module is only ever
 * imported from server components, route handlers and server actions.
 */

function required(name: string, devFallback?: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production' && devFallback === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (devFallback === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

export const env = {
  get appUrl() {
    return optional('APP_URL', 'http://localhost:3000');
  },
  get authSecret() {
    // A stable dev fallback keeps `npm run dev` zero-config while production
    // boots fail loudly if the secret was never set.
    return required(
      'AUTH_SECRET',
      process.env.NODE_ENV === 'production' ? undefined : 'auditready-development-secret-not-for-production'
    );
  },
  get sessionDays() {
    return num('SESSION_DAYS', 14);
  },

  // AI
  get aiProvider() {
    return optional('AI_PROVIDER', process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock');
  },
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY ?? '';
  },
  get aiModel() {
    return optional('AI_MODEL', 'claude-opus-5');
  },
  get aiMaxChars() {
    return num('AI_MAX_INPUT_CHARS', 24000);
  },

  // Storage
  get storageDriver() {
    return optional('STORAGE_DRIVER', process.env.S3_BUCKET ? 's3' : 'local');
  },
  get storageLocalDir() {
    return optional('STORAGE_LOCAL_DIR', './storage');
  },
  get s3(): { bucket: string; region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string } {
    return {
      bucket: optional('S3_BUCKET', ''),
      region: optional('S3_REGION', 'us-east-1'),
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: optional('S3_ACCESS_KEY_ID', ''),
      secretAccessKey: optional('S3_SECRET_ACCESS_KEY', ''),
    };
  },
  get maxUploadBytes() {
    return num('MAX_UPLOAD_MB', 25) * 1024 * 1024;
  },
  get ocrEnabled() {
    return bool('OCR_ENABLED', false);
  },

  // Email
  get emailProvider() {
    return optional('EMAIL_PROVIDER', 'console');
  },
  get emailFrom() {
    return optional('EMAIL_FROM', 'AuditReady <notifications@auditready.app>');
  },

  // Billing
  get billingProvider() {
    return optional('BILLING_PROVIDER', process.env.STRIPE_SECRET_KEY ? 'stripe' : 'simulator');
  },
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY ?? '';
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET ?? '';
  },

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};
