#!/usr/bin/env node

/**
 * TaxBridge — Pre-Production Readiness Check
 * 
 * Comprehensive validation script that checks all components
 * required for F3 staging deployment and F4 load testing.
 * 
 * Usage:
 *   node backend/scripts/pre-production-check.js [--verbose]
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..');

let totalChecks = 0;
let passedChecks = 0;
const issues = [];

function log(msg, level = 'info') {
  if (level === 'debug' && !isVerbose) return;
  console.log(msg);
}

function check(name, fn, critical = false) {
  totalChecks++;
  process.stdout.write(`  ${name}... `);
  try {
    const result = fn();
    if (result === true) {
      passedChecks++;
      console.log('✅');
      return true;
    } else {
      const reason = typeof result === 'string' ? result : 'Failed';
      console.log(`❌ ${reason}`);
      issues.push({ name, reason, critical });
      return false;
    }
  } catch (err) {
    const reason = err.message || String(err);
    console.log(`❌ ${reason}`);
    issues.push({ name, reason, critical });
    return false;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ============================================================
// 1. FILE STRUCTURE CHECKS
// ============================================================
console.log('\n📁 File Structure Checks\n');

check('package.json exists', () => fileExists(path.join(repoRoot, 'package.json')), true);
check('backend/package.json exists', () => fileExists(path.join(backendDir, 'package.json')), true);
check('backend/prisma/schema.prisma exists', () => fileExists(path.join(backendDir, 'prisma', 'schema.prisma')), true);
check('render.yaml exists', () => fileExists(path.join(repoRoot, 'render.yaml')));
check('render.staging.yaml exists', () => fileExists(path.join(repoRoot, 'render.staging.yaml')));
check('docs/INTEGRATION_CHECKLIST.md exists', () => fileExists(path.join(repoRoot, 'docs', 'INTEGRATION_CHECKLIST.md')));

// ============================================================
// 2. SCRIPTS VALIDATION
// ============================================================
console.log('\n📜 Scripts Validation\n');

check('validate-health.js exists', () => fileExists(path.join(backendDir, 'scripts', 'validate-health.js')));
check('validate-deployment.js exists', () => fileExists(path.join(backendDir, 'scripts', 'validate-deployment.js')));
check('run-migrations.js exists', () => fileExists(path.join(backendDir, 'scripts', 'run-migrations.js')));
check('prisma-generate-if-needed.js exists', () => fileExists(path.join(backendDir, 'scripts', 'prisma-generate-if-needed.js')));
check('run-f3-staging.js exists', () => fileExists(path.join(backendDir, 'scripts', 'run-f3-staging.js')));

// ============================================================
// 3. BUILD VALIDATION
// ============================================================
console.log('\n🔨 Build Output Validation\n');

const distServer = path.join(backendDir, 'dist', 'src', 'server.js');
const distQueueIndex = path.join(backendDir, 'dist', 'src', 'queue', 'index.js');

check('dist/src/server.js exists', () => fileExists(distServer));
check('dist/src/queue/index.js exists (worker entry)', () => fileExists(distQueueIndex));

// Check Prisma client generation markers
const prismaClientMarkers = [
  path.join(repoRoot, 'node_modules', '.prisma', 'client', 'index.js'),
  path.join(backendDir, 'node_modules', '.prisma', 'client', 'index.js'),
];
const hasPrismaClient = prismaClientMarkers.some(fileExists);
check('Prisma client generated', () => hasPrismaClient);

// ============================================================
// 4. LOAD TEST SCRIPTS
// ============================================================
console.log('\n📊 Load Test Scripts\n');

const loadTestDir = path.join(backendDir, 'load-test');
check('k6-smoke.js exists', () => fileExists(path.join(loadTestDir, 'k6-smoke.js')));
check('k6-script.js exists', () => fileExists(path.join(loadTestDir, 'k6-script.js')));
check('k6-soak.js exists', () => fileExists(path.join(loadTestDir, 'k6-soak.js')));
check('run-f4-tests.js exists', () => fileExists(path.join(loadTestDir, 'run-f4-tests.js')));

// ============================================================
// 5. RENDER BLUEPRINT VALIDATION
// ============================================================
console.log('\n🚀 Render Blueprint Validation\n');

function validateRenderBlueprint(fileName) {
  const filePath = path.join(repoRoot, fileName);
  if (!fileExists(filePath)) return `File not found: ${fileName}`;

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for required fields
  if (!content.includes('PRISMA_SKIP_POSTINSTALL_GENERATE')) return 'Missing PRISMA_SKIP_POSTINSTALL_GENERATE';
  if (!content.includes('NODE_VERSION')) return 'Missing NODE_VERSION';
  if (!content.includes('healthCheckPath: /health')) return 'Missing healthCheckPath';
  if (!content.includes('yarn workspace @taxbridge/backend build')) return 'Missing build command';
  if (!content.includes('yarn workspace @taxbridge/backend start')) return 'Missing start command';

  return true;
}

check('render.yaml is valid', () => validateRenderBlueprint('render.yaml'));
check('render.staging.yaml is valid', () => validateRenderBlueprint('render.staging.yaml'));

// ============================================================
// 6. PACKAGE.JSON SCRIPTS
// ============================================================
console.log('\n📦 Package.json Scripts\n');

const backendPkg = readJson(path.join(backendDir, 'package.json'));
const scripts = backendPkg.scripts || {};

check('build script exists', () => 'build' in scripts);
check('start script exists', () => 'start' in scripts);
check('worker script exists', () => 'worker' in scripts);
check('prisma:generate script exists', () => 'prisma:generate' in scripts);
check('prisma:migrate:deploy script exists', () => 'prisma:migrate:deploy' in scripts);
check('build includes prisma generate', () => scripts.build?.includes('prisma generate'));
check('prestart lifecycle hook exists', () => 'prestart' in scripts);
check('preworker lifecycle hook exists', () => 'preworker' in scripts);

// ============================================================
// 7. HEALTH ENDPOINT REGISTRATION
// ============================================================
console.log('\n🏥 Health Endpoint Registration\n');

const serverTs = path.join(backendDir, 'src', 'server.ts');
const serverContent = fileExists(serverTs) ? fs.readFileSync(serverTs, 'utf8') : '';

check('/health endpoint registered', () => serverContent.includes("app.get('/health'"));
check('/health/db endpoint registered', () => serverContent.includes("app.get('/health/db'"));
check('/health/queues endpoint registered', () => serverContent.includes("app.get('/health/queues'"));
check('/health/digitax endpoint registered', () => serverContent.includes("app.get('/health/digitax'"));
check('/health/remita endpoint registered', () => serverContent.includes("app.get('/health/remita'"));

// ============================================================
// 8. INTEGRATION ROUTES
// ============================================================
console.log('\n🔗 Integration Routes\n');

check('/api/v1/invoices route registered', () => serverContent.includes('invoicesRoutes'));
check('/api/v1/payments route registered', () => serverContent.includes('paymentsRoutes'));

// ============================================================
// 9. ENVIRONMENT TEMPLATES
// ============================================================
console.log('\n🔐 Environment Templates\n');

check('backend/.env.example exists', () => fileExists(path.join(backendDir, '.env.example')));
check('.env.production.example exists', () => fileExists(path.join(repoRoot, '.env.production.example')));

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('\n📋 Pre-Production Readiness Summary\n');

const criticalIssues = issues.filter(i => i.critical);
const warnings = issues.filter(i => !i.critical);

console.log(`  Total Checks: ${totalChecks}`);
console.log(`  Passed: ${passedChecks}/${totalChecks} (${Math.round(passedChecks / totalChecks * 100)}%)`);

if (criticalIssues.length > 0) {
  console.log(`\n❌ Critical Issues (${criticalIssues.length}):`);
  criticalIssues.forEach(i => console.log(`   - ${i.name}: ${i.reason}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Warnings (${warnings.length}):`);
  warnings.forEach(i => console.log(`   - ${i.name}: ${i.reason}`));
}

if (criticalIssues.length === 0 && warnings.length === 0) {
  console.log('\n✅ All checks passed! Ready for F3 staging deployment.\n');
  console.log('Next steps:');
  console.log('  1. Deploy via Render Blueprint: render.staging.yaml');
  console.log('  2. Run migrations in Render shell: yarn workspace @taxbridge/backend prisma:migrate:deploy');
  console.log('  3. Validate health: node backend/scripts/validate-health.js <staging-url>\n');
  process.exit(0);
} else if (criticalIssues.length > 0) {
  console.log('\n❌ Pre-production check FAILED due to critical issues.\n');
  process.exit(1);
} else {
  console.log('\n✅ Pre-production check PASSED with warnings.\n');
  process.exit(0);
}
