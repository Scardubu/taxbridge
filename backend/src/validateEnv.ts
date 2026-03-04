/**
 * validateEnv — TaxBridge V12
 *
 * Hard-crashes the process on startup if any required environment variable
 * is missing or clearly invalid. This prevents subtle runtime failures from
 * misconfigured deployments.
 *
 * MUST be the first import in server.ts / app.ts so it fires before any
 * service initialisation that depends on these variables.
 *
 * C-07 exception: this file intentionally calls process.exit(1) — it is
 * the one place where hard exit is acceptable because there is no safe
 * fallback for a missing DATABASE_URL or JWT_SECRET.
 */

const ALWAYS_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
  'NODE_ENV',
] as const;

/**
 * These are required for full production operation but some third-party
 * services may not be onboarded yet during early deployment. They produce
 * loud warnings but do NOT crash the process (C-07 graceful degradation).
 */
const PROD_RECOMMENDED = [
  'SENTRY_DSN',
  'NRS_API_KEY',
  'FLUTTERWAVE_SECRET',
  'EXPO_ACCESS_TOKEN',
  'ALLOWED_ORIGINS',
] as const;

// ─── Formatters ───────────────────────────────────────────────────────────────

function fail(messages: string[]): never {
  console.error('\n╔═══════════════════════════════════════════════════╗');
  console.error('║   TaxBridge: FATAL — Missing environment variables ║');
  console.error('╚═══════════════════════════════════════════════════╝');
  messages.forEach((m) => console.error(`  ✗  ${m}`));
  console.error('\nSet the missing variables and restart the process.\n');
  process.exit(1);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of ALWAYS_REQUIRED) {
    if (!process.env[key]) missing.push(`${key} is required in all environments`);
  }

  if (process.env.NODE_ENV === 'production') {
    // Hard block: wildcard CORS is never acceptable in production
    if ((process.env.ALLOWED_ORIGINS || '').includes('*')) {
      missing.push('ALLOWED_ORIGINS must not contain wildcard "*" in production');
    }

    // Warn-only: third-party services not yet onboarded — log loudly but don't crash.
    // Once all integrations are live, move these back to `missing` (hard fail).
    const warnings: string[] = [];
    for (const key of PROD_RECOMMENDED) {
      if (!process.env[key]) warnings.push(`${key} is recommended in production`);
    }
    if (process.env.DIGITAX_MOCK_MODE === 'true') {
      warnings.push('DIGITAX_MOCK_MODE is "true" — NRS submissions will be mocked (regulatory risk)');
    }
    if (warnings.length > 0) {
      console.warn('\n╔══════════════════════════════════════════════════════╗');
      console.warn('║  TaxBridge: WARNING — Recommended env vars missing   ║');
      console.warn('╚══════════════════════════════════════════════════════╝');
      warnings.forEach((w) => console.warn(`  ⚠  ${w}`));
      console.warn('\nThe server will start but some features may be degraded.\n');
    }
  }

  // JWT secret minimum length — 32 chars per OWASP recommendation
  if (
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET.length < 32
  ) {
    missing.push('JWT_SECRET must be at least 32 characters');
  }
  if (
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_REFRESH_SECRET.length < 32
  ) {
    missing.push('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  if (missing.length > 0) fail(missing);
}

// Run immediately on import so "import './validateEnv'" is all that's needed.
validateEnv();
