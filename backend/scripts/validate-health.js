#!/usr/bin/env node

/**
 * TaxBridge - Health Check Validator
 * 
 * Validates that all health check endpoints are responding correctly
 * before marking deployment as successful.
 * 
 * Usage:
 *   node backend/scripts/validate-health.js <base-url>
 * 
 * Example:
 *   node backend/scripts/validate-health.js https://api-staging.taxbridge.ng
 */

const https = require('https');
const http = require('http');

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error('\n❌ Error: Base URL is required');
  console.error('   Usage: node validate-health.js <base-url>\n');
  process.exit(1);
}

const endpoints = [
  { path: '/health/live', name: 'Liveness Check', required: true },
  { path: '/health/ready', name: 'Readiness Check', required: true },
  // Deep health (includes DB + Redis + integrations). Useful for dashboards/ops, but not the primary deploy gate.
  { path: '/health', name: 'Deep Health Check', required: false },
  { path: '/health/digitax', name: 'DigiTax Health Check', required: false },
  { path: '/health/duplo', name: 'Legacy Duplo Alias (DigiTax)', required: false },
  { path: '/health/remita', name: 'Remita Health Check', required: false },
  { path: '/health/db', name: 'Database Health Check', required: true },
  { path: '/health/queues', name: 'Queue Health Check', required: true }
];

function checkEndpoint(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();

    protocol.get(url, { timeout: 10000 }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const latency = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            latency,
            data: json
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            latency,
            data: { error: 'Invalid JSON response' }
          });
        }
      });
    }).on('error', (error) => {
      reject(error);
    }).on('timeout', () => {
      reject(new Error('Request timeout'));
    });
  });
}

async function validateHealth() {
  console.log(`\n🏥 Validating Health Endpoints: ${baseUrl}\n`);

  const results = [];
  let hasErrors = false;

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    process.stdout.write(`Checking ${endpoint.name}... `);

    try {
      const result = await checkEndpoint(url);
      
      if (result.status === 200 || result.status === 503) {
        const statusIcon = result.status === 200 ? '✅' : '⚠️ ';
        console.log(`${statusIcon} ${result.status} (${result.latency}ms)`);
        
        if (result.status === 503 && endpoint.required) {
          hasErrors = true;
          console.log(`   ❌ Required endpoint is degraded`);
        }

        results.push({
          endpoint: endpoint.name,
          status: result.status === 200 ? 'healthy' : 'degraded',
          latency: result.latency,
          details: result.data
        });
      } else {
        console.log(`❌ ${result.status}`);
        if (endpoint.required) {
          hasErrors = true;
        }
        results.push({
          endpoint: endpoint.name,
          status: 'error',
          latency: result.latency,
          details: result.data
        });
      }
    } catch (error) {
      console.log(`❌ ${error.message}`);
      if (endpoint.required) {
        hasErrors = true;
      }
      results.push({
        endpoint: endpoint.name,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log('\n📊 Health Check Summary:\n');
  
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`  ✅ Healthy: ${healthy}/${endpoints.length}`);
  if (degraded > 0) {
    console.log(`  ⚠️  Degraded: ${degraded}/${endpoints.length}`);
  }
  if (errors > 0) {
    console.log(`  ❌ Errors: ${errors}/${endpoints.length}`);
  }

  // Check average latency
  const avgLatency = results
    .filter(r => r.latency)
    .reduce((sum, r) => sum + r.latency, 0) / results.filter(r => r.latency).length;
  
  console.log(`\n  ⏱️  Average Latency: ${avgLatency.toFixed(0)}ms`);

  if (avgLatency > 500) {
    console.log(`  ⚠️  Warning: High latency detected`);
  }

  if (hasErrors) {
    console.log('\n❌ Health check FAILED: One or more required endpoints are not healthy\n');
    process.exit(1);
  }

  console.log('\n✅ Health check PASSED: All required endpoints are healthy\n');
  process.exit(0);
}

validateHealth().catch(error => {
  console.error('\n❌ Health check failed:', error.message);
  process.exit(1);
});
