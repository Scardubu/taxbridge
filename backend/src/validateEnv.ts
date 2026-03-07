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
  'NRS_API_KEY',
  'PORT',
  'NODE_ENV',
] as const;

const PROD_REQUIRED = [
  'SENTRY_DSN',
  'RENDER_EXTERNAL_URL',
  'FLUTTERWAVE_SECRET',
  'CBN_MPR',
  'CORS_ORIGIN',
  'DOCUMENT_VAULT_KMS_PROVIDER',
  'R2_ENDPOINT',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
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
    for (const key of PROD_REQUIRED) {
      if (!process.env[key]) missing.push(`${key} is required in production`);
    }
    // Specific value guards
    if (process.env.DIGITAX_MOCK_MODE === 'true') {
      missing.push('DIGITAX_MOCK_MODE must be "false" in production (regulatory gate)');
    }
    if ((process.env.ALLOWED_ORIGINS || '').includes('*')) {
      missing.push('ALLOWED_ORIGINS must not contain wildcard "*" in production');
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
