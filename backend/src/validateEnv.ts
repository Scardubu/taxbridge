/**
 * Fail-closed production environment validation.
 * This module is imported before Fastify application initialization.
 */
import { createPrivateKey, createPublicKey } from 'node:crypto';

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
  for (const key of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'INTERNAL_API_KEY', 'ADMIN_API_KEYS']) {
    if (!process.env[key]?.trim()) fatal(`env ${key} missing`);
  }
  if ((process.env.INTERNAL_API_KEY ?? '').length < 32) {
    fatal('INTERNAL_API_KEY must contain at least 32 characters');
  }
  const adminKeys = (process.env.ADMIN_API_KEYS ?? '').split(',').map((key) => key.trim()).filter(Boolean);
  if (adminKeys.length === 0 || adminKeys.some((key) => key.length < 32)) {
    fatal('ADMIN_API_KEYS must contain one or more keys of at least 32 characters');
  }

  try {
    const privatePem = Buffer.from(process.env.JWT_PRIVATE_KEY!, 'base64').toString('utf8');
    const publicPem = Buffer.from(process.env.JWT_PUBLIC_KEY!, 'base64').toString('utf8');
    if (!privatePem.includes('BEGIN PRIVATE KEY') || !publicPem.includes('BEGIN PUBLIC KEY')) {
      fatal('JWT keys must be base64-encoded PKCS8 private PEM and SPKI public PEM');
    }
    const privateKey = createPrivateKey({ key: privatePem, format: 'pem', type: 'pkcs8' });
    const publicKey = createPublicKey({ key: publicPem, format: 'pem', type: 'spki' });
    if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') {
      fatal('Production JWT keys must be RSA keys for RS256');
    }
    if ((privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
        (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      fatal('Production RS256 keys must be at least 2048 bits');
    }
    const derived = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
    const configured = publicKey.export({ type: 'spki', format: 'der' });
    if (!Buffer.isBuffer(derived) || !Buffer.isBuffer(configured) || !derived.equals(configured)) {
      fatal('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY do not form a key pair');
    }
  } catch {
    fatal('JWT key material is invalid or cannot be parsed as an RS256 key pair');
  }

  const mockFlags = ['DIGITAX_MOCK_MODE', 'NRS_MOCK_MODE', 'REMITA_MOCK_MODE', 'FLW_MOCK_MODE', 'PAYSTACK_MOCK_MODE'] as const;
  const enabled = mockFlags.filter((key) => process.env[key]?.toLowerCase() === 'true');
  if (enabled.length > 0) fatal(`mock integrations are prohibited in production: ${enabled.join(', ')}`);
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  fatal('JWT_SECRET with at least 32 characters is required outside production');
}
