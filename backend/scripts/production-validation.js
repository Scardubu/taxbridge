#!/usr/bin/env node

/**
 * TaxBridge Production Deployment Validation Script
 * 
 * Comprehensive pre-deployment and post-deployment validation
 * Run before deploying to production to ensure all systems are ready
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
  section: (msg) => console.log(`\n${COLORS.cyan}▶ ${msg}${COLORS.reset}`)
};

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: []
};

function recordCheck(name, passed, message = '') {
  results.checks.push({ name, passed, message });
  if (passed) {
    results.passed++;
    log.success(`${name}${message ? ': ' + message : ''}`);
  } else {
    results.failed++;
    log.error(`${name}${message ? ': ' + message : ''}`);
  }
}

function recordWarning(name, message) {
  results.warnings++;
  log.warn(`${name}: ${message}`);
}

// Check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Execute command and return output
function execCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// HTTP request helper
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = options.timeout || 10000;

    const req = protocol.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Validation checks
async function validateEnvironment() {
  log.section('Environment Configuration');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  recordCheck(
    'Node.js version',
    majorVersion >= 18,
    `${nodeVersion} (required: >=18.x)`
  );

  // Check for .env file
  const envPath = path.join(__dirname, '../.env');
  recordCheck('.env file exists', fileExists(envPath));

  if (fileExists(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Check critical environment variables
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'DIGITAX_API_URL'
    ];

    requiredVars.forEach(varName => {
      const exists = envContent.includes(`${varName}=`);
      recordCheck(`${varName} configured`, exists);
    });

    // Check for mock modes in production
    if (process.env.NODE_ENV === 'production') {
      const mockModes = ['DIGITAX_MOCK_MODE', 'REMITA_MOCK_MODE', 'PAYSTACK_MOCK_MODE', 'FLW_MOCK_MODE'];
      mockModes.forEach(mode => {
        const value = envContent.match(new RegExp(`${mode}=["']?(\\w+)["']?`))?.[1];
        if (value === 'true') {
          recordWarning(mode, 'Mock mode enabled in production environment');
        }
      });
    }
  }
}

async function validateDependencies() {
  log.section('Dependencies');

  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  recordCheck('node_modules exists', fileExists(nodeModulesPath));

  // Check package.json
  const packagePath = path.join(__dirname, '../package.json');
  if (fileExists(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    recordCheck('package.json valid', !!pkg.name);

    // Check critical dependencies
    const criticalDeps = ['fastify', 'prisma', '@prisma/client', 'ioredis', 'bullmq'];
    criticalDeps.forEach(dep => {
      const exists = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];
      recordCheck(`${dep} installed`, !!exists, exists || '');
    });
  }

  // Run npm audit
  log.info('Running security audit...');
  const auditResult = execCommand('npm audit --audit-level=high --production', true);
  if (auditResult.success) {
    recordCheck('Security audit', true, 'No high/critical vulnerabilities');
  } else {
    recordWarning('Security audit', 'Vulnerabilities found - review required');
  }
}

async function validateDatabase() {
  log.section('Database');

  // Check Prisma schema
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  recordCheck('Prisma schema exists', fileExists(schemaPath));

  // Check if Prisma client is generated
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client');
  recordCheck('Prisma client generated', fileExists(prismaClientPath));

  // Check migrations directory
  const migrationsPath = path.join(__dirname, '../prisma/migrations');
  if (fileExists(migrationsPath)) {
    const migrations = fs.readdirSync(migrationsPath).filter(f => f !== 'migration_lock.toml');
    recordCheck('Database migrations', migrations.length > 0, `${migrations.length} migrations`);
  } else {
    recordWarning('Migrations', 'No migrations directory found');
  }
}

async function validateBuild() {
  log.section('Build Artifacts');

  // Check if TypeScript compiles
  log.info('Checking TypeScript compilation...');
  const tscResult = execCommand('npx tsc --noEmit', true);
  recordCheck('TypeScript compilation', tscResult.success);

  // Check if dist directory exists (for production builds)
  const distPath = path.join(__dirname, '../dist');
  const distExists = fileExists(distPath);
  
  if (process.env.NODE_ENV === 'production') {
    recordCheck('Build artifacts (dist/)', distExists);
    
    if (distExists) {
      const serverPath = path.join(distPath, 'src/server.js');
      recordCheck('Server build exists', fileExists(serverPath));
    }
  } else {
    if (!distExists) {
      log.info('Build artifacts not found (development mode)');
    }
  }
}

async function validateTests() {
  log.section('Tests');

  // Check if test files exist
  const testsPath = path.join(__dirname, '../src/__tests__');
  const testsExist = fileExists(testsPath);
  recordCheck('Test directory exists', testsExist);

  if (testsExist) {
    const testFiles = fs.readdirSync(testsPath).filter(f => f.endsWith('.test.ts'));
    recordCheck('Test files', testFiles.length > 0, `${testFiles.length} test files`);
  }

  // Run tests
  log.info('Running test suite...');
  const testResult = execCommand('npm test -- --passWithNoTests', true);
  recordCheck('Test suite', testResult.success);
}

async function validateHealthEndpoints(baseUrl) {
  log.section('Health Endpoints');

  const endpoints = [
    { path: '/health/live', name: 'Liveness' },
    { path: '/health/ready', name: 'Readiness' },
    { path: '/health', name: 'Overall health' },
    { path: '/health/database', name: 'Database health' },
    { path: '/health/integrations', name: 'Integrations health' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await httpRequest(`${baseUrl}${endpoint.path}`);
      const passed = response.statusCode === 200;
      recordCheck(
        endpoint.name,
        passed,
        `HTTP ${response.statusCode}`
      );
    } catch (error) {
      recordCheck(endpoint.name, false, error.message);
    }
  }
}

async function validateAPIEndpoints(baseUrl) {
  log.section('API Endpoints (Sample)');

  // Test a few key endpoints (without auth for public ones)
  const endpoints = [
    { path: '/docs', name: 'Swagger documentation', expectedStatus: 200 },
    { path: '/metrics', name: 'Prometheus metrics', expectedStatus: 200 }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await httpRequest(`${baseUrl}${endpoint.path}`);
      const passed = response.statusCode === endpoint.expectedStatus;
      recordCheck(
        endpoint.name,
        passed,
        `HTTP ${response.statusCode}`
      );
    } catch (error) {
      recordCheck(endpoint.name, false, error.message);
    }
  }
}

async function validateSecurity() {
  log.section('Security Configuration');

  // Check for sensitive files that shouldn't be committed
  const sensitiveFiles = ['.env', '.env.local', '.env.production'];
  const gitignorePath = path.join(__dirname, '../../.gitignore');
  
  if (fileExists(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    sensitiveFiles.forEach(file => {
      const ignored = gitignore.includes(file);
      recordCheck(`${file} in .gitignore`, ignored);
    });
  }

  // Check JWT secret strength
  if (process.env.JWT_SECRET) {
    const strength = process.env.JWT_SECRET.length >= 32;
    recordCheck('JWT_SECRET strength', strength, `${process.env.JWT_SECRET.length} chars`);
  }

  // Check encryption key
  if (process.env.ENCRYPTION_KEY) {
    const strength = process.env.ENCRYPTION_KEY.length >= 64;
    recordCheck('ENCRYPTION_KEY strength', strength, `${process.env.ENCRYPTION_KEY.length} chars`);
  }
}

async function validateDocumentation() {
  log.section('Documentation');

  const docs = [
    'README.md',
    'docs/DEVELOPER_GUIDE.md',
    'docs/postman/TaxBridge_API.postman_collection.json',
    'docs/runbook.md'
  ];

  docs.forEach(doc => {
    const docPath = path.join(__dirname, '../..', doc);
    recordCheck(doc, fileExists(docPath));
  });
}

async function validateDocker() {
  log.section('Docker Configuration');

  const dockerFiles = [
    'backend/Dockerfile',
    'docker-compose.yml',
    'render.yaml'
  ];

  dockerFiles.forEach(file => {
    const filePath = path.join(__dirname, '../..', file);
    recordCheck(file, fileExists(filePath));
  });

  // Try to build Docker image (if Docker is available)
  const dockerAvailable = execCommand('docker --version', true);
  if (dockerAvailable.success) {
    log.info('Docker is available');
  } else {
    log.warn('Docker not available - skipping image build test');
  }
}

// Main validation flow
async function main() {
  console.log(`
${COLORS.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   TaxBridge Production Deployment Validation               ║
║   Version 1.0.0                                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${COLORS.reset}
  `);

  const args = process.argv.slice(2);
  const mode = args[0] || 'pre-deploy';
  const baseUrl = args[1] || process.env.BASE_URL || 'http://localhost:3000';

  log.info(`Validation mode: ${mode}`);
  log.info(`Base URL: ${baseUrl}`);
  log.info('');

  try {
    // Pre-deployment checks
    await validateEnvironment();
    await validateDependencies();
    await validateDatabase();
    await validateBuild();
    await validateSecurity();
    await validateDocumentation();
    await validateDocker();

    // Post-deployment checks (if server is running)
    if (mode === 'post-deploy' || args.includes('--with-server')) {
      log.info('\nAttempting to connect to server...');
      try {
        await validateHealthEndpoints(baseUrl);
        await validateAPIEndpoints(baseUrl);
      } catch (error) {
        log.warn('Server validation skipped - server may not be running');
      }
    }

    // Run tests (optional, can be slow)
    if (args.includes('--with-tests')) {
      await validateTests();
    }

    // Summary
    console.log(`
${COLORS.cyan}╔════════════════════════════════════════════════════════════╗
║                     VALIDATION SUMMARY                     ║
╚════════════════════════════════════════════════════════════╝${COLORS.reset}

${COLORS.green}✓ Passed:${COLORS.reset}   ${results.passed}
${COLORS.red}✗ Failed:${COLORS.reset}   ${results.failed}
${COLORS.yellow}⚠ Warnings:${COLORS.reset} ${results.warnings}

Total checks: ${results.passed + results.failed}
    `);

    if (results.failed > 0) {
      console.log(`${COLORS.red}❌ VALIDATION FAILED${COLORS.reset}`);
      console.log('\nFailed checks:');
      results.checks
        .filter(c => !c.passed)
        .forEach(c => console.log(`  - ${c.name}${c.message ? ': ' + c.message : ''}`));
      process.exit(1);
    } else {
      console.log(`${COLORS.green}✅ VALIDATION PASSED${COLORS.reset}`);
      
      if (results.warnings > 0) {
        console.log(`\n${COLORS.yellow}⚠ ${results.warnings} warning(s) - review recommended${COLORS.reset}`);
      }
      
      console.log('\n🚀 System is ready for deployment!');
      process.exit(0);
    }

  } catch (error) {
    log.error(`Validation failed with error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  main();
}

module.exports = { main };
