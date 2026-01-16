#!/usr/bin/env node
/**
 * Production Environment Validation Script
 * Validates all required environment variables and external connections
 * Run before production deployment to catch configuration issues early
 */

const crypto = require('crypto');

// Try to load optional dependencies
let Client, redis;
try {
  const pg = require('pg');
  Client = pg.Client;
} catch (e) {
  console.log('⚠️  pg module not found, skipping database test');
}

try {
  redis = require('redis');
} catch (e) {
  console.log('⚠️  redis module not found, skipping Redis test');
}

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'SESSION_SECRET',
  'WEBHOOK_SECRET',
  'ALLOWED_ORIGINS'
];

const OPTIONAL_VARS = [
  'DIGITAX_API_URL',
  'DIGITAX_API_KEY',
  'REMITA_MERCHANT_ID',
  'REMITA_API_KEY',
  'AT_API_KEY',
  'SENTRY_DSN'
];

async function validateEnvironment() {
  console.log('🔍 TaxBridge Production Environment Validation\n');
  console.log('=' .repeat(60));

  let hasErrors = false;
  let hasWarnings = false;

  // 1. Check required environment variables
  console.log('\n📋 Required Environment Variables:');
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ❌ ${varName}: MISSING`);
      hasErrors = true;
    } else {
      const display = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('URL')
        ? `${value.substring(0, 10)}...` 
        : value;
      console.log(`  ✅ ${varName}: ${display}`);
    }
  }

  // 2. Check optional environment variables
  console.log('\n📋 Optional Environment Variables:');
  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ⚠️  ${varName}: NOT SET (will use mock/fallback)`);
      hasWarnings = true;
    } else {
      const display = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 10)}...`
        : value;
      console.log(`  ✅ ${varName}: ${display}`);
    }
  }

  // 3. Validate secret strength
  console.log('\n🔐 Secret Strength Validation:');
  const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'SESSION_SECRET', 'WEBHOOK_SECRET'];
  for (const secret of secrets) {
    const value = process.env[secret];
    if (value) {
      const length = value.length;
      const isHex = /^[0-9a-f]+$/i.test(value);
      
      if (length >= 64 && isHex) {
        console.log(`  ✅ ${secret}: Strong (${length} chars, hex)`);
      } else if (length >= 32) {
        console.log(`  ⚠️  ${secret}: Weak (${length} chars) - recommend 64+ hex chars`);
        hasWarnings = true;
      } else {
        console.log(`  ❌ ${secret}: INSECURE (${length} chars) - MUST be 32+ chars`);
        hasErrors = true;
      }
    }
  }

  // 4. Test database connection
  console.log('\n🗄️  Database Connection Test:');
  const dbUrl = process.env.DATABASE_URL;
  if (!Client) {
    console.log('  ⏭️  pg module not available, skipping database test');
  } else if (dbUrl) {
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      const result = await client.query('SELECT NOW()');
      console.log(`  ✅ PostgreSQL connected: ${result.rows[0].now}`);
      await client.end();
    } catch (error) {
      console.log(`  ❌ PostgreSQL connection failed: ${error.message}`);
      hasErrors = true;
    }
  } else {
    console.log('  ⏭️  DATABASE_URL not set, skipping test');
  }

  // 5. Test Redis connection
  console.log('\n💾 Redis Connection Test:');
  const redisUrl = process.env.REDIS_URL;
  if (!redis) {
    console.log('  ⏭️  redis module not available, skipping Redis test');
  } else if (redisUrl) {
    const client = redis.createClient({ url: redisUrl });
    try {
      await client.connect();
      const pong = await client.ping();
      console.log(`  ✅ Redis connected: ${pong}`);
      await client.quit();
    } catch (error) {
      console.log(`  ❌ Redis connection failed: ${error.message}`);
      hasErrors = true;
    }
  } else {
    console.log('  ⏭️  REDIS_URL not set, skipping test');
  }

  // 6. Validate CORS origins
  console.log('\n🌐 CORS Configuration:');
  const origins = process.env.ALLOWED_ORIGINS;
  if (origins) {
    const originList = origins.split(',').map(o => o.trim());
    console.log(`  ✅ ${originList.length} allowed origin(s):`);
    originList.forEach(origin => {
      const isHttps = origin.startsWith('https://');
      const status = isHttps || origin.includes('localhost') ? '✅' : '⚠️';
      console.log(`    ${status} ${origin}`);
      if (!isHttps && !origin.includes('localhost')) {
        console.log(`      ⚠️  Production origin should use HTTPS`);
        hasWarnings = true;
      }
    });
  } else {
    console.log('  ❌ ALLOWED_ORIGINS not set - CORS will block all requests');
    hasErrors = true;
  }

  // 7. Validate NODE_ENV
  console.log('\n⚙️  Environment Mode:');
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    console.log('  ✅ NODE_ENV=production (optimized builds, no debug logs)');
  } else if (nodeEnv === 'staging') {
    console.log('  ⚠️  NODE_ENV=staging (use production for final deployment)');
    hasWarnings = true;
  } else {
    console.log(`  ❌ NODE_ENV=${nodeEnv} - MUST be "production" or "staging"`);
    hasErrors = true;
  }

  // 8. Check for development artifacts
  console.log('\n🧹 Development Artifact Check:');
  const devIndicators = [
    { key: 'DATABASE_URL', pattern: /localhost|127\.0\.0\.1|dev_password/ },
    { key: 'REDIS_URL', pattern: /localhost|127\.0\.0\.1/ },
    { key: 'DIGITAX_MOCK_MODE', pattern: /true/i },
    { key: 'ALLOWED_ORIGINS', pattern: /localhost/ }
  ];

  for (const { key, pattern } of devIndicators) {
    const value = process.env[key];
    if (value && pattern.test(value)) {
      if (nodeEnv === 'production') {
        console.log(`  ⚠️  ${key} contains development values in production mode`);
        hasWarnings = true;
      } else {
        console.log(`  ℹ️  ${key} using development/test values (OK for staging)`);
      }
    }
  }

  if (!hasWarnings && !hasErrors) {
    console.log('  ✅ No development artifacts detected');
  }

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED - Fix errors before deployment');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS - Review before production');
    process.exit(0);
  } else {
    console.log('✅ VALIDATION PASSED - Environment is production-ready');
    process.exit(0);
  }
}

// Load .env file if it exists
try {
  require('dotenv').config();
  console.log('📄 Loaded environment from .env file\n');
} catch (error) {
  console.log('ℹ️  No .env file found, using system environment variables\n');
}

validateEnvironment().catch(error => {
  console.error('\n💥 Validation script crashed:', error);
  process.exit(1);
});
