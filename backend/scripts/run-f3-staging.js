#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');
const stagingUrl = process.argv[2];

if (!stagingUrl) {
  console.error('❌ Missing staging URL. Usage: node backend/scripts/run-f3-staging.js <staging-url>');
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'staging',
};

const run = (command, args, label) => {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: backendDir, stdio: 'inherit', env });
  if (result.error) {
    console.error(`❌ ${label} failed:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`❌ ${label} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
};

console.log('✅ Starting Phase F3 staging validation');

run('node', ['scripts/validate-deployment.js', 'staging'], 'Validate staging environment variables');
run('node', ['scripts/run-migrations.js'], 'Run database migrations');
run('node', ['scripts/validate-health.js', stagingUrl], 'Validate staging health endpoints');

console.log('\n✅ Phase F3 staging validation completed successfully');
