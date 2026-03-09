/**
 * validateEnv — TaxBridge V13 Sovereign
 *
 * Hard-crash guard — must be the initial import in app.ts, before Fastify() constructor.
 * If any REQUIRED key is missing, process exits with code 1 immediately.
 *
 * C-07 exception: intentional process.exit(1) — no safe fallback for missing
 * DATABASE_URL or JWT_SECRET.
 *
 * Integration keys (DIGITAX, Paystack, Flutterwave, etc.) are NOT hard-required here
 * because they all support mock/degraded mode — missing them should warn, not crash.
 * Set DIGITAX_MOCK_MODE=true, FLW_MOCK_MODE=true, PAYSTACK_MOCK_MODE=true to run
 * without live credentials.
 */

const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'PORT',
] as const;

for (const key of REQUIRED) {
  if (!process.env[key]) {
    process.stderr.write(`FATAL: env ${key} missing\n`);
    process.exit(1);
  }
}

// Warn-only in production — these enable integrations but have mock/degraded fallbacks:
const WARN_IF_MISSING_IN_PROD = [
  'DIGITAX_API_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_ENDPOINT',
  'YOUVERIFY_API_KEY',
  'FLW_SECRET_KEY',
  'PAYSTACK_SECRET_KEY',
  'AT_API_KEY',
] as const;

if (process.env.NODE_ENV === 'production') {
  for (const key of WARN_IF_MISSING_IN_PROD) {
    if (!process.env[key]) {
      process.stderr.write(`WARN: env ${key} not set — integration will run in mock/degraded mode\n`);
    }
  }
}

// Optional with defaults (do NOT add to REQUIRED):
// SENTRY_DSN            → optional; Sentry SDK no-ops gracefully when absent (local dev)
// DIGITAX_MOCK_MODE     → default 'false'
// CBN_MPR               → default '0.2725' (use parseFloat(process.env.CBN_MPR ?? '0.2725'))
// LOG_LEVEL             → default 'info'
// LOG_FORMAT            → default 'json' in production
// REMITA_MERCHANT_ID    → required only when Remita payment gateway is enabled
// JWT_PUBLIC_KEY        → required in production RS256 mode; not required for HS256 local dev
