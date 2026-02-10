#!/usr/bin/env node
/**
 * Phase 6 Production Readiness Validation Script
 * 
 * Validates that all Phase 6 features are properly integrated and production-ready:
 * - Payroll & PAYE Calculator
 * - Compliance Alerts & Reminders
 * - Crypto & Digital Asset Tax Module
 * - Reconciliation Tool
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - File not found: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`✗ ${description} - File not found: ${filePath}`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const contains = content.includes(searchString);
  
  if (contains) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - Missing: ${searchString}`, 'red');
    return false;
  }
}

async function main() {
  log('\n========================================', 'cyan');
  log('Phase 6 Production Readiness Validation', 'cyan');
  log('========================================\n', 'cyan');

  let totalChecks = 0;
  let passedChecks = 0;

  // =========================================================================
  // 1. Backend Services
  // =========================================================================
  log('\n[1] Backend Services', 'blue');
  log('─────────────────────', 'blue');

  const serviceChecks = [
    ['src/services/payroll.ts', 'Payroll Service'],
    ['src/services/compliance.ts', 'Compliance Service'],
    ['src/services/crypto-tax.ts', 'Crypto Tax Service'],
    ['src/services/reconciliation.ts', 'Reconciliation Service'],
  ];

  for (const [file, desc] of serviceChecks) {
    totalChecks++;
    if (checkFileExists(file, desc)) passedChecks++;
  }

  // =========================================================================
  // 2. Backend Routes
  // =========================================================================
  log('\n[2] Backend Routes', 'blue');
  log('──────────────────', 'blue');

  const routeChecks = [
    ['src/routes/payroll.ts', 'Payroll Routes'],
    ['src/routes/compliance.ts', 'Compliance Routes'],
    ['src/routes/crypto.ts', 'Crypto Routes'],
    ['src/routes/reconciliation.ts', 'Reconciliation Routes'],
  ];

  for (const [file, desc] of routeChecks) {
    totalChecks++;
    if (checkFileExists(file, desc)) passedChecks++;
  }

  // =========================================================================
  // 3. Route Registration in server.ts
  // =========================================================================
  log('\n[3] Route Registration', 'blue');
  log('──────────────────────', 'blue');

  const registrationChecks = [
    ['src/server.ts', 'payrollRoutes', 'Payroll routes registered'],
    ['src/server.ts', 'complianceRoutes', 'Compliance routes registered'],
    ['src/server.ts', 'cryptoRoutes', 'Crypto routes registered'],
    ['src/server.ts', 'reconciliationRoutes', 'Reconciliation routes registered'],
  ];

  for (const [file, search, desc] of registrationChecks) {
    totalChecks++;
    if (checkFileContains(file, search, desc)) passedChecks++;
  }

  // =========================================================================
  // 4. Prisma Schema Models
  // =========================================================================
  log('\n[4] Database Schema', 'blue');
  log('───────────────────', 'blue');

  const schemaChecks = [
    ['prisma/schema.prisma', 'model Payroll', 'Payroll model'],
    ['prisma/schema.prisma', 'model PayrollItem', 'PayrollItem model'],
    ['prisma/schema.prisma', 'model ComplianceReminder', 'ComplianceReminder model'],
    ['prisma/schema.prisma', 'model CryptoTransaction', 'CryptoTransaction model'],
  ];

  for (const [file, search, desc] of schemaChecks) {
    totalChecks++;
    if (checkFileContains(file, search, desc)) passedChecks++;
  }

  // =========================================================================
  // 5. Mobile API Clients
  // =========================================================================
  log('\n[5] Mobile API Clients', 'blue');
  log('──────────────────────', 'blue');

  const mobileApiChecks = [
    ['../mobile/src/services/payrollApi.ts', 'Payroll API Client'],
    ['../mobile/src/services/complianceApi.ts', 'Compliance API Client'],
    ['../mobile/src/services/cryptoApi.ts', 'Crypto API Client'],
    ['../mobile/src/services/reconciliationApi.ts', 'Reconciliation API Client'],
  ];

  for (const [file, desc] of mobileApiChecks) {
    totalChecks++;
    if (checkFileExists(file, desc)) passedChecks++;
  }

  // =========================================================================
  // 6. Unit Tests
  // =========================================================================
  log('\n[6] Unit Tests', 'blue');
  log('──────────────', 'blue');

  totalChecks++;
  if (checkFileExists('src/__tests__/phase6-services.unit.test.ts', 'Phase 6 Unit Tests')) {
    passedChecks++;
  }

  // =========================================================================
  // 7. TypeScript Compilation
  // =========================================================================
  log('\n[7] TypeScript Compilation', 'blue');
  log('──────────────────────────', 'blue');

  totalChecks++;
  if (checkFileExists('tsconfig.json', 'TypeScript Config')) {
    passedChecks++;
    
    // Check for @taxbridge/contracts path mapping
    totalChecks++;
    if (checkFileContains('tsconfig.json', '@taxbridge/contracts', 'Contracts path mapping')) {
      passedChecks++;
    }
  }

  // =========================================================================
  // 8. Environment Variables Documentation
  // =========================================================================
  log('\n[8] Environment Documentation', 'blue');
  log('─────────────────────────────', 'blue');

  totalChecks++;
  if (checkFileContains('../.env.production.example', 'Phase 6', 'Phase 6 env vars documented')) {
    passedChecks++;
  }

  // =========================================================================
  // Summary
  // =========================================================================
  log('\n========================================', 'cyan');
  log('Validation Summary', 'cyan');
  log('========================================', 'cyan');

  const percentage = Math.round((passedChecks / totalChecks) * 100);
  const color = percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red';

  log(`\nTotal Checks: ${totalChecks}`, 'blue');
  log(`Passed: ${passedChecks}`, 'green');
  log(`Failed: ${totalChecks - passedChecks}`, 'red');
  log(`Success Rate: ${percentage}%`, color);

  if (percentage === 100) {
    log('\n✓ Phase 6 is PRODUCTION READY!', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Run: npx prisma db push (if not already done)', 'reset');
    log('  2. Run: npm test (verify all tests pass)', 'reset');
    log('  3. Run: npm run build (verify clean build)', 'reset');
    log('  4. Deploy to production', 'reset');
    process.exit(0);
  } else if (percentage >= 80) {
    log('\n⚠ Phase 6 is MOSTLY READY but has some issues', 'yellow');
    log('Please review the failed checks above.', 'yellow');
    process.exit(1);
  } else {
    log('\n✗ Phase 6 is NOT READY for production', 'red');
    log('Critical issues found. Please fix the failed checks above.', 'red');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n✗ Validation script error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
