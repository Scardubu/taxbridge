/**
 * Secrets Management Configuration
 *
 * Centralises access to all sensitive configuration values, validates their
 * presence at startup, and provides helpers for secret rotation.
 *
 * In production, secrets should be injected via environment variables from a
 * secrets manager (e.g. HashiCorp Vault, AWS Secrets Manager, Render env
 * groups). This module acts as the single gateway so that the rest of the
 * codebase never reads process.env directly for secrets.
 */

import { createLogger } from '../lib/logger';

const log = createLogger('secrets');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecretDefinition {
  envVar: string;
  required: boolean;
  minLength?: number;
  description: string;
  sensitive?: boolean;
}

export interface SecretValidationResult {
  valid: boolean;
  missing: string[];
  weak: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Secret Registry
// ---------------------------------------------------------------------------

const SECRET_REGISTRY: SecretDefinition[] = [
  // Core
  { envVar: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret', sensitive: true },
  { envVar: 'JWT_REFRESH_SECRET', required: false, minLength: 32, description: 'JWT refresh token secret', sensitive: true },
  { envVar: 'ENCRYPTION_KEY', required: true, minLength: 64, description: 'AES-256 encryption key (hex)', sensitive: true },
  { envVar: 'SESSION_SECRET', required: false, minLength: 32, description: 'Session signing secret', sensitive: true },

  // Database
  { envVar: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string', sensitive: true },
  { envVar: 'DIRECT_URL', required: false, description: 'Direct PostgreSQL URL (bypasses pooler)', sensitive: true },
  { envVar: 'REDIS_URL', required: true, description: 'Redis connection string', sensitive: true },

  // Payment gateways
  { envVar: 'PAYSTACK_SECRET_KEY', required: false, description: 'Paystack secret key', sensitive: true },
  { envVar: 'PAYSTACK_PUBLIC_KEY', required: false, description: 'Paystack public key' },
  { envVar: 'FLW_SECRET_KEY', required: false, description: 'Flutterwave secret key', sensitive: true },
  { envVar: 'FLW_PUBLIC_KEY', required: false, description: 'Flutterwave public key' },
  { envVar: 'FLW_SECRET_HASH', required: false, description: 'Flutterwave webhook hash', sensitive: true },
  { envVar: 'FLW_ENCRYPTION_KEY', required: false, description: 'Flutterwave encryption key', sensitive: true },
  { envVar: 'REMITA_API_KEY', required: false, description: 'Remita API key', sensitive: true },
  { envVar: 'REMITA_MERCHANT_ID', required: false, description: 'Remita merchant ID' },

  // Integrations
  { envVar: 'DIGITAX_API_KEY', required: false, description: 'Digitax (FIRS) API key', sensitive: true },
  { envVar: 'DIGITAX_HMAC_SECRET', required: false, description: 'Digitax HMAC secret', sensitive: true },
  { envVar: 'YOUVERIFY_API_KEY', required: false, description: 'Youverify API key', sensitive: true },

  // SMS providers
  { envVar: 'AT_API_KEY', required: false, description: "Africa's Talking API key", sensitive: true },
  { envVar: 'INFOBIP_API_KEY', required: false, description: 'Infobip API key', sensitive: true },
  { envVar: 'TERMII_API_KEY', required: false, description: 'Termii API key', sensitive: true },

  // Webhooks
  { envVar: 'WEBHOOK_SECRET', required: false, minLength: 16, description: 'Webhook signature secret', sensitive: true },

  // Monitoring
  { envVar: 'SENTRY_DSN', required: false, description: 'Sentry DSN' },
];

// ---------------------------------------------------------------------------
// Secret Access
// ---------------------------------------------------------------------------

/**
 * Retrieve a secret value. Returns undefined if not set.
 */
export function getSecret(envVar: string): string | undefined {
  return process.env[envVar];
}

/**
 * Retrieve a secret value or throw if missing.
 */
export function requireSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Required secret ${envVar} is not set`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate all registered secrets at startup.
 */
export function validateSecrets(): SecretValidationResult {
  const missing: string[] = [];
  const weak: string[] = [];
  const warnings: string[] = [];

  for (const def of SECRET_REGISTRY) {
    const value = process.env[def.envVar];

    if (!value) {
      if (def.required) {
        missing.push(def.envVar);
      }
      continue;
    }

    if (def.minLength && value.length < def.minLength) {
      weak.push(`${def.envVar} (min ${def.minLength} chars, got ${value.length})`);
    }

    // Warn about default / placeholder values in production
    if (process.env.NODE_ENV === 'production') {
      const placeholders = ['changeme', 'secret', 'password', 'test', 'demo', 'example'];
      if (placeholders.some((p) => value.toLowerCase().includes(p))) {
        warnings.push(`${def.envVar} appears to contain a placeholder value`);
      }
    }
  }

  const valid = missing.length === 0 && weak.length === 0;

  if (!valid) {
    log.error('Secret validation failed', { missing, weak });
  }
  if (warnings.length > 0) {
    log.warn('Secret warnings', { warnings });
  }

  return { valid, missing, weak, warnings };
}

// ---------------------------------------------------------------------------
// Rotation Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the previous JWT secret is configured (for graceful rotation).
 * During rotation both the current and previous secrets should be accepted.
 */
export function hasRotatedJWTSecret(): boolean {
  return !!process.env.JWT_SECRET_PREVIOUS;
}

/**
 * Get both current and previous JWT secrets for verification during rotation.
 */
export function getJWTSecrets(): { current: string; previous?: string } {
  return {
    current: requireSecret('JWT_SECRET'),
    previous: process.env.JWT_SECRET_PREVIOUS || undefined,
  };
}

/**
 * Mask a secret for safe logging (show first 4 and last 2 chars).
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 6, 20))}${value.slice(-2)}`;
}

/**
 * Log a summary of configured secrets (masked) for startup diagnostics.
 */
export function logSecretsSummary(): void {
  const configured: string[] = [];
  const notConfigured: string[] = [];

  for (const def of SECRET_REGISTRY) {
    const value = process.env[def.envVar];
    if (value) {
      configured.push(def.envVar);
    } else if (def.required) {
      notConfigured.push(`${def.envVar} (REQUIRED)`);
    } else {
      notConfigured.push(def.envVar);
    }
  }

  log.info('Secrets summary', {
    configured: configured.length,
    notConfigured: notConfigured.length,
    details: {
      configured,
      notConfigured,
    },
  });
}
