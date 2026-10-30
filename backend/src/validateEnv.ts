/**
 * Fail-closed production environment validation. Import before application setup.
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
  if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
    fatal('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are both required in production');
  }
  const privatePem = Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8');
  const publicPem = Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
  if (!privatePem.includes('BEGIN PRIVATE KEY') || !publicPem.includes('BEGIN PUBLIC KEY')) {
    fatal('JWT keys must be base64-encoded PKCS8 private PEM and SPKI public PEM');
  }
  if (process.env.DIGITAX_MOCK_MODE === 'true' ||
      process.env.FLW_MOCK_MODE === 'true' ||
      process.env.PAYSTACK_MOCK_MODE === 'true' ||
      process.env.NRS_MOCK_MODE === 'true') {
    fatal('mock payment/NRS modes are prohibited in production');
  }
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  fatal('JWT_SECRET with at least 32 characters is required outside production');
}
