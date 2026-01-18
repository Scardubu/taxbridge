#!/usr/bin/env node

/**
 * TaxBridge - Staging Deployment Validator
 *
 * Comprehensive validation of staging environment after F3 deployment.
 * Runs health checks, API smoke tests, and mock mode verification.
 *
 * Usage:
 *   node backend/scripts/validate-staging.js [staging-url]
 *
 * Example:
 *   node backend/scripts/validate-staging.js https://taxbridge-api-staging.onrender.com
 */

const https = require('https');
const http = require('http');

const STAGING_URL = process.argv[2] || process.env.STAGING_URL || 'https://taxbridge-api-staging.onrender.com';

const passed = [];
const failed = [];
const warnings = [];

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const start = Date.now();

    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), latency });
        } catch {
          resolve({ status: res.statusCode, data, latency });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function check(name, fn) {
  process.stdout.write(`  Checking ${name}... `);
  try {
    const result = await fn();
    if (result.pass) {
      console.log(`✅ ${result.message || 'OK'}`);
      passed.push(name);
    } else if (result.warn) {
      console.log(`⚠️  ${result.message}`);
      warnings.push({ name, message: result.message });
    } else {
      console.log(`❌ ${result.message || 'FAILED'}`);
      failed.push({ name, message: result.message });
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
    failed.push({ name, message: err.message });
  }
}

async function runValidation() {
  console.log(`\n🚀 TaxBridge Staging Validator`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Target: ${STAGING_URL}\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Section 1: Health Endpoints
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n📊 Health Endpoints`);
  console.log(`─────────────────────────────────────────────────`);

  await check('Base health (/health)', async () => {
    const res = await request(`${STAGING_URL}/health`);
    if (res.status === 200) {
      return { pass: true, message: `200 OK (${res.latency}ms)` };
    }
    return { pass: false, message: `Status ${res.status}` };
  });

  await check('Database health (/health/db)', async () => {
    const res = await request(`${STAGING_URL}/health/db`);
    if (res.status === 200) {
      return { pass: true, message: `200 OK (${res.latency}ms)` };
    }
    if (res.status === 503) {
      return { pass: false, message: `Database unhealthy: ${JSON.stringify(res.data)}` };
    }
    return { pass: false, message: `Status ${res.status}` };
  });

  await check('Queue health (/health/queues)', async () => {
    const res = await request(`${STAGING_URL}/health/queues`);
    if (res.status === 200) {
      return { pass: true, message: `200 OK (${res.latency}ms)` };
    }
    if (res.status === 503) {
      return { warn: true, message: `Queues degraded (may be expected if worker not yet deployed)` };
    }
    return { pass: false, message: `Status ${res.status}` };
  });

  await check('DigiTax health (/health/digitax)', async () => {
    const res = await request(`${STAGING_URL}/health/digitax`);
    if (res.status === 200) {
      const mode = res.data?.mode || res.data?.status;
      return { pass: true, message: `200 OK - mode: ${mode} (${res.latency}ms)` };
    }
    if (res.status === 503) {
      return { warn: true, message: `DigiTax degraded (expected for staging mock mode)` };
    }
    return { pass: false, message: `Status ${res.status}` };
  });

  await check('Remita health (/health/remita)', async () => {
    const res = await request(`${STAGING_URL}/health/remita`);
    if (res.status === 200) {
      const mode = res.data?.mode || res.data?.status;
      return { pass: true, message: `200 OK - mode: ${mode} (${res.latency}ms)` };
    }
    if (res.status === 503) {
      return { warn: true, message: `Remita degraded (expected for staging mock mode)` };
    }
    return { pass: false, message: `Status ${res.status}` };
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Section 2: Mock Mode Verification (Staging Safety)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n🔒 Mock Mode Verification (Safety)`);
  console.log(`─────────────────────────────────────────────────`);

  await check('DigiTax in mock mode', async () => {
    const res = await request(`${STAGING_URL}/health/digitax`);
    if (res.status === 200 && res.data) {
      const mode = res.data.mode || (res.data.mock ? 'mock' : 'live');
      if (mode === 'mock' || res.data.mock === true) {
        return { pass: true, message: 'Confirmed mock mode (safe for staging)' };
      }
      return { warn: true, message: `Mode is "${mode}" - verify this is expected` };
    }
    return { warn: true, message: 'Could not determine mode' };
  });

  await check('Remita in mock mode', async () => {
    const res = await request(`${STAGING_URL}/health/remita`);
    if (res.status === 200 && res.data) {
      const mode = res.data.mode || (res.data.mock ? 'mock' : 'live');
      if (mode === 'mock' || res.data.mock === true) {
        return { pass: true, message: 'Confirmed mock mode (no real payments)' };
      }
      return { warn: true, message: `Mode is "${mode}" - verify this is expected` };
    }
    return { warn: true, message: 'Could not determine mode' };
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Section 3: API Smoke Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n🧪 API Smoke Tests`);
  console.log(`─────────────────────────────────────────────────`);

  await check('Invoice endpoint reachable (/api/v1/invoices)', async () => {
    const res = await request(`${STAGING_URL}/api/v1/invoices`, { method: 'GET' });
    // 401 is expected without auth token
    if (res.status === 401 || res.status === 200) {
      return { pass: true, message: `Endpoint active (${res.status} - auth required)` };
    }
    return { pass: false, message: `Unexpected status ${res.status}` };
  });

  await check('Auth endpoint reachable (/api/v1/auth/login)', async () => {
    const res = await request(`${STAGING_URL}/api/v1/auth/login`, {
      method: 'POST',
      body: { email: 'test@test.com', password: 'test' },
    });
    // 400/401 is expected with invalid credentials
    if (res.status === 400 || res.status === 401 || res.status === 422) {
      return { pass: true, message: `Endpoint active (${res.status} - validation working)` };
    }
    return { pass: false, message: `Unexpected status ${res.status}` };
  });

  await check('Sync endpoint reachable (/api/v1/sync)', async () => {
    const res = await request(`${STAGING_URL}/api/v1/sync`, { method: 'GET' });
    // 401 is expected without auth
    if (res.status === 401 || res.status === 200) {
      return { pass: true, message: `Endpoint active (${res.status})` };
    }
    if (res.status === 404) {
      return { warn: true, message: 'Sync endpoint not found (may need auth)' };
    }
    return { pass: false, message: `Unexpected status ${res.status}` };
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Section 4: Latency Check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n⏱️  Latency Check`);
  console.log(`─────────────────────────────────────────────────`);

  await check('Cold-start latency', async () => {
    const res = await request(`${STAGING_URL}/health`);
    if (res.latency > 2000) {
      return { warn: true, message: `${res.latency}ms (high - may be cold start)` };
    }
    if (res.latency > 500) {
      return { warn: true, message: `${res.latency}ms (moderate)` };
    }
    return { pass: true, message: `${res.latency}ms` };
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 VALIDATION SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`  ✅ Passed:   ${passed.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  ❌ Failed:   ${failed.length}`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    warnings.forEach((w) => console.log(`   - ${w.name}: ${w.message}`));
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failures:`);
    failed.forEach((f) => console.log(`   - ${f.name}: ${f.message}`));
    console.log(`\n❌ STAGING VALIDATION FAILED\n`);
    process.exit(1);
  }

  if (warnings.length > 0 && failed.length === 0) {
    console.log(`\n🟡 STAGING VALIDATION PASSED WITH WARNINGS`);
    console.log(`   Review warnings before proceeding to F4 load tests.\n`);
    process.exit(0);
  }

  console.log(`\n✅ STAGING VALIDATION PASSED`);
  console.log(`   Ready for F4 load testing: yarn workspace @taxbridge/backend test:load:f4\n`);
  process.exit(0);
}

runValidation().catch((err) => {
  console.error(`\n❌ Validation script error: ${err.message}\n`);
  process.exit(1);
});
