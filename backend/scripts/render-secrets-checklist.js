#!/usr/bin/env node

/**
 * TaxBridge - Required Secrets Checklist
 * 
 * Displays all secrets that MUST be manually set in Render Dashboard
 * before deployment will succeed.
 * 
 * Usage:
 *   node backend/scripts/render-secrets-checklist.js
 */

const fs = require('fs');
const path = require('path');

console.log(`
┌────────────────────────────────────────────────────────────────────┐
│           TaxBridge Render Secrets Checklist                       │
│                                                                    │
│  These variables have "sync: false" in the blueprint and MUST     │
│  be manually set in Render Dashboard → Environment.               │
└────────────────────────────────────────────────────────────────────┘
`);

const requiredSecrets = [
  {
    key: 'DATABASE_URL',
    description: 'Supabase PostgreSQL connection string',
    example: 'postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
    required: true,
  },
  {
    key: 'JWT_SECRET',
    description: 'JWT access token signing secret',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'JWT_REFRESH_SECRET',
    description: 'JWT refresh token signing secret',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'ENCRYPTION_KEY',
    description: 'Field-level encryption key (TIN, NIN)',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'SESSION_SECRET',
    description: 'Session cookie signing secret',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'WEBHOOK_SECRET',
    description: 'Webhook signature verification',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'REMITA_WEBHOOK_SECRET',
    description: 'Remita payment webhook verification',
    example: '64-character hex string',
    required: true,
  },
  {
    key: 'SENTRY_DSN',
    description: 'Sentry error tracking (optional)',
    example: 'https://xxx@sentry.io/xxx',
    required: false,
  },
];

// Check RENDER_SECRETS.txt
const secretsFilePath = path.resolve(__dirname, '../../RENDER_SECRETS.txt');
let secretsFileContent = '';
try {
  secretsFileContent = fs.readFileSync(secretsFilePath, 'utf8');
} catch (err) {
  console.log('⚠️  RENDER_SECRETS.txt not found. Generate secrets first:\n');
  console.log('   yarn workspace @taxbridge/backend secrets:generate\n');
}

console.log('Required Secrets:\n');

let missingCount = 0;
for (const secret of requiredSecrets) {
  const regex = new RegExp(`^${secret.key}=(.+)$`, 'm');
  const match = secretsFileContent.match(regex);
  const hasValue = match && match[1] && !match[1].startsWith('your_');

  const icon = secret.required ? (hasValue ? '✅' : '❌') : (hasValue ? '✅' : '⚪');
  const status = hasValue ? 'Found in RENDER_SECRETS.txt' : (secret.required ? 'MISSING - MUST SET IN RENDER' : 'Optional');

  console.log(`  ${icon} ${secret.key}`);
  console.log(`     ${secret.description}`);
  console.log(`     Status: ${status}`);
  if (!hasValue && secret.required) {
    missingCount++;
    console.log(`     Example: ${secret.example}`);
  }
  console.log('');
}

console.log('─────────────────────────────────────────────────────────────────────\n');

if (missingCount > 0) {
  console.log(`❌ ${missingCount} required secret(s) missing from RENDER_SECRETS.txt\n`);
  console.log('To generate missing secrets:\n');
  console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('\nThen add to RENDER_SECRETS.txt and copy to Render Dashboard.\n');
} else {
  console.log('✅ All required secrets found in RENDER_SECRETS.txt\n');
  console.log('Next steps:');
  console.log('  1. Go to Render Dashboard → Environment');
  console.log('  2. Set each secret listed above');
  console.log('  3. Click "Manual Deploy"\n');
}

console.log('Render Dashboard: https://dashboard.render.com/web/srv-d5mi4g4hg0os73d9nq60/env\n');
