#!/usr/bin/env node

/**
 * TaxBridge - Pre-Deployment Validation Script
 * 
 * Validates that all required environment variables are set
 * and production configuration is ready for deployment.
 * 
 * Usage:
 *   node backend/scripts/validate-deployment.js [environment]
 * 
 * Arguments:
 *   environment: staging|production (default: staging)
 */

const requiredVars = {
  all: [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'SESSION_SECRET',
    'WEBHOOK_SECRET'
  ],
  production: [
    'DUPLO_CLIENT_ID',
    'DUPLO_CLIENT_SECRET',
    'REMITA_MERCHANT_ID',
    'REMITA_API_KEY',
    'REMITA_SERVICE_TYPE_ID',
    'REMITA_WEBHOOK_SECRET',
    'SENTRY_DSN',
    'ALLOWED_ORIGINS'
  ],
  staging: []
};

const optionalVars = [
  'LOG_LEVEL',
  'PORT',
  'ENABLE_METRICS',
  'ENABLE_HEALTH_CHECKS',
  'DB_POOL_MAX',
  'RATE_LIMIT_MAX'
];

function validateEnvironment(env = 'staging') {
  console.log(`\n🔍 Validating ${env.toUpperCase()} environment configuration...\n`);

  const errors = [];
  const warnings = [];
  const info = [];

  // Check required variables for all environments
  for (const varName of requiredVars.all) {
    if (!process.env[varName]) {
      errors.push(`❌ Missing required variable: ${varName}`);
    } else {
      // Validate JWT_SECRET and ENCRYPTION_KEY length
      if (varName === 'JWT_SECRET' && process.env[varName].length < 32) {
        errors.push(`❌ JWT_SECRET must be at least 32 characters (current: ${process.env[varName].length})`);
      }
      if (varName === 'ENCRYPTION_KEY' && process.env[varName].length !== 64) {
        errors.push(`❌ ENCRYPTION_KEY must be exactly 64 hex characters (current: ${process.env[varName].length})`);
      }
      info.push(`✅ ${varName} is set`);
    }
  }

  // Check environment-specific required variables
  if (env === 'production') {
    for (const varName of requiredVars.production) {
      if (varName === 'ALLOWED_ORIGINS') {
        const hasAllowedOrigins = Boolean(process.env.ALLOWED_ORIGINS);
        const hasLegacyCorsOrigins = Boolean(process.env.CORS_ORIGINS);

        if (!hasAllowedOrigins && !hasLegacyCorsOrigins) {
          errors.push('❌ Missing required variable for production: ALLOWED_ORIGINS');
        } else if (!hasAllowedOrigins && hasLegacyCorsOrigins) {
          warnings.push('⚠️  Using legacy CORS_ORIGINS in production; prefer ALLOWED_ORIGINS');
          info.push('✅ CORS_ORIGINS is set (legacy)');
        } else {
          info.push('✅ ALLOWED_ORIGINS is set');
        }

        continue;
      }

      if (!process.env[varName]) {
        errors.push(`❌ Missing required variable for production: ${varName}`);
      } else {
        info.push(`✅ ${varName} is set`);
      }
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      warnings.push(`⚠️  Optional variable not set: ${varName} (will use default)`);
    } else {
      info.push(`✅ ${varName} is set`);
    }
  }

  // Validate mock mode settings
  const digitaxMockMode = String(process.env.DIGITAX_MOCK_MODE || 'false').toLowerCase();
  const remitaMockMode = String(process.env.REMITA_MOCK_MODE || 'false').toLowerCase();

  if (env === 'production') {
    if (digitaxMockMode === 'true') {
      warnings.push(`⚠️  DIGITAX_MOCK_MODE is enabled in production - ensure this is intentional`);
    }
    if (remitaMockMode === 'true') {
      warnings.push(`⚠️  REMITA_MOCK_MODE is enabled in production - ensure this is intentional`);
    }
  }

  info.push(`✅ DIGITAX_MOCK_MODE: ${digitaxMockMode}`);
  info.push(`✅ REMITA_MOCK_MODE: ${remitaMockMode}`);

  // Validate CORS origins
  const corsOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS;
  if (corsOriginsRaw) {
    const origins = corsOriginsRaw.split(',');
    if (origins.includes('*') && env === 'production') {
      errors.push(`❌ ALLOWED_ORIGINS cannot be '*' in production`);
    } else {
      info.push(`✅ ALLOWED_ORIGINS: ${origins.length} origins configured`);
    }
  }

  // Validate database connection string
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push(`❌ DATABASE_URL must be a PostgreSQL connection string`);
    }
    if (dbUrl.includes('localhost') && env === 'production') {
      errors.push(`❌ DATABASE_URL points to localhost in production`);
    }
  }

  // Validate Redis connection string
  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      errors.push(`❌ REDIS_URL must be a Redis connection string`);
    }
    if (redisUrl.includes('localhost') && env === 'production') {
      warnings.push(`⚠️  REDIS_URL points to localhost in production`);
    }
  }

  // Print results
  console.log('\n📋 Validation Results:\n');
  
  if (info.length > 0) {
    console.log('✅ Valid Configuration:');
    info.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach(msg => console.log(`  ${msg}`));
    console.log('');
    console.log(`\n❌ Validation FAILED: ${errors.length} error(s) found\n`);
    process.exit(1);
  }

  console.log(`\n✅ Validation PASSED: ${env.toUpperCase()} environment is ready for deployment\n`);
  process.exit(0);
}

// Main execution
const environment = process.argv[2] || 'staging';

if (!['staging', 'production'].includes(environment)) {
  console.error(`\n❌ Invalid environment: ${environment}`);
  console.error('   Valid options: staging, production\n');
  process.exit(1);
}

validateEnvironment(environment);
