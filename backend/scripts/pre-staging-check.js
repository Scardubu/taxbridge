#!/usr/bin/env node

/**
 * TaxBridge - Pre-Staging Deployment Check
 * 
 * Validates local backend environment and configuration before
 * deploying to Render staging. Run this locally to catch issues early.
 * 
 * Usage:
 *   node backend/scripts/pre-staging-check.js
 */

const path = require('path');
const fs = require('fs');

console.log('\n🔍 TaxBridge Pre-Staging Deployment Check\n');
console.log('='.repeat(50));

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function pass(message) {
  console.log(`✅ ${message}`);
  checks.passed++;
}

function fail(message) {
  console.log(`❌ ${message}`);
  checks.failed++;
}

function warn(message) {
  console.log(`⚠️  ${message}`);
  checks.warnings++;
}

function info(message) {
  console.log(`   ${message}`);
}

// Check 1: Required files exist
console.log('\n📁 Checking required files...');

const requiredFiles = [
  'backend/package.json',
  'backend/tsconfig.json',
  'backend/prisma/schema.prisma',
  'render.staging.yaml',
  'backend/.env.staging.example'
];

for (const file of requiredFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    pass(`Found: ${file}`);
  } else {
    fail(`Missing: ${file}`);
  }
}

// Check 2: Environment variable templates
console.log('\n🔐 Checking environment templates...');

const stagingEnvPath = path.resolve(process.cwd(), 'backend/.env.staging.example');
if (fs.existsSync(stagingEnvPath)) {
  const content = fs.readFileSync(stagingEnvPath, 'utf-8');
  
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'DIGITAX_MOCK_MODE',
    'REMITA_MOCK_MODE'
  ];
  
  for (const v of requiredVars) {
    if (content.includes(v)) {
      pass(`Template includes: ${v}`);
    } else {
      fail(`Template missing: ${v}`);
    }
  }
} else {
  fail('Cannot check environment template (file missing)');
}

// Check 3: Render blueprint structure
console.log('\n📐 Checking Render blueprint...');

const renderYamlPath = path.resolve(process.cwd(), 'render.staging.yaml');
if (fs.existsSync(renderYamlPath)) {
  const content = fs.readFileSync(renderYamlPath, 'utf-8');
  
  const requiredSections = [
    'taxbridge-api-staging',
    'taxbridge-worker-staging',
    'taxbridge-redis-staging',
    'healthCheckPath: /health',
    'DIGITAX_MOCK_MODE',
    'REMITA_MOCK_MODE'
  ];
  
  for (const section of requiredSections) {
    if (content.includes(section)) {
      pass(`Blueprint includes: ${section}`);
    } else {
      fail(`Blueprint missing: ${section}`);
    }
  }
}

// Check 4: Prisma schema
console.log('\n🗄️ Checking Prisma schema...');

const schemaPath = path.resolve(process.cwd(), 'backend/prisma/schema.prisma');
if (fs.existsSync(schemaPath)) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  
  const requiredModels = ['User', 'Invoice', 'IdempotencyCache'];
  
  for (const model of requiredModels) {
    if (content.includes(`model ${model}`)) {
      pass(`Schema includes model: ${model}`);
    } else {
      fail(`Schema missing model: ${model}`);
    }
  }
}

// Check 5: Health endpoints in server
console.log('\n🏥 Checking health endpoint registration...');

const serverPath = path.resolve(process.cwd(), 'backend/src/server.ts');
if (fs.existsSync(serverPath)) {
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  const healthEndpoints = [
    "'/health'",
    "'/health/db'",
    "'/health/queues'",
    "'/health/digitax'",
    "'/health/remita'"
  ];
  
  for (const endpoint of healthEndpoints) {
    if (content.includes(endpoint)) {
      pass(`Server registers: ${endpoint}`);
    } else {
      fail(`Server missing: ${endpoint}`);
    }
  }
}

// Check 6: Load test scripts
console.log('\n📊 Checking load test scripts...');

const loadTestDir = path.resolve(process.cwd(), 'backend/load-test');
if (fs.existsSync(loadTestDir)) {
  const expectedScripts = ['k6-script.js', 'k6-smoke.js', 'k6-soak.js', 'k6-offline-sync-burst.js'];
  
  for (const script of expectedScripts) {
    const scriptPath = path.join(loadTestDir, script);
    if (fs.existsSync(scriptPath)) {
      pass(`Load test found: ${script}`);
    } else {
      warn(`Load test missing: ${script}`);
    }
  }
}

// Check 7: Validate health script
console.log('\n🔧 Checking validation scripts...');

const validateHealthPath = path.resolve(process.cwd(), 'backend/scripts/validate-health.js');
if (fs.existsSync(validateHealthPath)) {
  pass('Health validation script exists');
} else {
  fail('Health validation script missing');
}

const runMigrationsPath = path.resolve(process.cwd(), 'backend/scripts/run-migrations.js');
if (fs.existsSync(runMigrationsPath)) {
  pass('Migration runner script exists');
} else {
  fail('Migration runner script missing');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📋 Pre-Staging Check Summary:\n');
console.log(`   ✅ Passed:   ${checks.passed}`);
console.log(`   ⚠️  Warnings: ${checks.warnings}`);
console.log(`   ❌ Failed:   ${checks.failed}`);

if (checks.failed > 0) {
  console.log('\n❌ Pre-staging check FAILED');
  console.log('   Fix the issues above before deploying to Render.\n');
  process.exit(1);
} else if (checks.warnings > 0) {
  console.log('\n⚠️  Pre-staging check PASSED WITH WARNINGS');
  console.log('   Review warnings above, but deployment can proceed.\n');
  process.exit(0);
} else {
  console.log('\n✅ Pre-staging check PASSED');
  console.log('   Ready to deploy to Render staging!\n');
  process.exit(0);
}
