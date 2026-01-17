#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const loadTestDir = __dirname;

const baseUrl = process.env.BASE_URL;
if (!baseUrl) {
  console.warn('⚠️  BASE_URL is not set. Defaulting to http://localhost:3000');
}

const env = {
  ...process.env,
  BASE_URL: baseUrl || 'http://localhost:3000',
};

const scenarios = [
  { name: 'Smoke Test', file: 'k6-smoke.js' },
  { name: 'Load Test', file: 'k6-script.js' },
  { name: 'Soak Test', file: 'k6-soak.js' },
];

for (const scenario of scenarios) {
  console.log(`\n🚦 Running ${scenario.name}...`);

  const result = spawnSync('k6', ['run', path.join(loadTestDir, scenario.file)], {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    console.error(`❌ Failed to run ${scenario.name}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`❌ ${scenario.name} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.log('\n✅ Phase F4 load tests completed successfully');
