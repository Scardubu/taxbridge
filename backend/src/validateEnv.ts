/**
 * Fail-closed production environment validation. Import before application setup.
 * The API must never boot with incomplete asymmetric auth or mock provider modes.
 */
const required = ['DATABASE_URL', 'REDIS_URL', 'PORT'] as const;

function fatal(message: string): never {
  process.stderr.write(`FATAL: ${message}\n`);
  process.exit(1);
}

for (const key of required) {
  if (!process.env[key]) fatal(`env ${key} missing`);
}

if (!process.env.ALLOWED_ORIGINS && !process.env.CORS_ORIGIN) {
  fatal('env ALLOWED_ORIGINS or CORS_ORIGIN missing');
}

if (process.env.NODE_ENV === 'production') {
  const requiredProductionSecrets = [
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'INTERNAL_API_KEY',
    'ADMIN_API_KEYS',
    'ENCRYPTION_KEY',
  ] as const;

  for (const key of requiredProductionSecrets) {
    if (!process.env[key]) fatal(`env ${key} missing in production`);
  }

  const privatePem = Buffer.from(process.env.JWT_PRIVATE_KEY!, 'base64').toString('utf8');
  const publicPem = Buffer.from(process.env.JWT_PUBLIC_KEY!, 'base64').toString('utf8');
  if (!privatePem.includes('BEGIN PRIVATE KEY') || !publicPem.includes('BEGIN PUBLIC KEY')) {
    fatal('JWT keys must be base64-encoded PKCS8 private PEM and SPKI public PEM');
  }

  const mockFlags = [
    'DIGITAX_MOCK_MODE',
    'NRS_MOCK_MODE',
    'REMITA_MOCK_MODE',
    'FLW_MOCK_MODE',
    'PAYSTACK_MOCK_MODE',
  ] as const;
  const enabledOrUnspecified = mockFlags.filter((key) => process.env[key] !== 'false');
  if (enabledOrUnspecified.length > 0) {
    fatal(`production mock flags must be explicitly false: ${enabledOrUnspecified.join(', ')}`);
  }
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  fatal('JWT_SECRET with at least 32 characters is required outside production');
}
