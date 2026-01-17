#!/usr/bin/env node

/**
 * TaxBridge - Secret Generator
 *
 * Generates cryptographically strong hex secrets for staging/production.
 * Usage:
 *   node backend/scripts/generate-secrets.js
 *   node backend/scripts/generate-secrets.js --db-password "yourRawPassword"
 */

const crypto = require('crypto');

const args = process.argv.slice(2);
const dbPasswordIndex = args.indexOf('--db-password');
const dbPassword = dbPasswordIndex !== -1 ? args[dbPasswordIndex + 1] : null;

const hex32 = () => crypto.randomBytes(32).toString('hex');

const secrets = {
  JWT_SECRET: hex32(),
  JWT_REFRESH_SECRET: hex32(),
  ENCRYPTION_KEY: hex32(),
  SESSION_SECRET: hex32(),
  WEBHOOK_SECRET: hex32(),
  REMITA_WEBHOOK_SECRET: hex32(),
  DIGITAX_HMAC_SECRET: hex32(),
};

console.log('\n✅ Generated Secrets (keep in a secure password manager)');
console.log('------------------------------------------------------');
Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

if (dbPassword) {
  console.log('\n✅ URL-encoded database password:');
  console.log(encodeURIComponent(dbPassword));
}

console.log('\nℹ️  Do NOT commit these values to source control.');
