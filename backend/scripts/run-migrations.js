#!/usr/bin/env node

/**
 * TaxBridge - Database Migration Runner
 * 
 * Safely applies all pending Prisma migrations to the database.
 * This script should be run after deploying new code to production.
 * 
 * Usage:
 *   node backend/scripts/run-migrations.js [--dry-run]
 * 
 * Options:
 *   --dry-run: Show what would be migrated without applying changes
 */

const { spawnSync } = require('child_process');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');
const backendDir = path.resolve(__dirname, '..');

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

console.log('\n🔄 TaxBridge Database Migration\n');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database: ${migrationDatabaseUrl ? 'configured' : '❌ not configured'}\n`);

if (!migrationDatabaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not set (or provide MIGRATION_DATABASE_URL)\n');
  process.exit(1);
}

const prismaEnv = {
  ...process.env,
  DATABASE_URL: migrationDatabaseUrl
};

const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

function runYarn(args, label) {
  if (label) console.log(label);
  const result = spawnSync(yarnCmd, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: prismaEnv
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Command failed: ${yarnCmd} ${args.join(' ')} (exit ${result.status})`);
  }
}

try {
  if (isDryRun) {
    console.log('🔍 Dry run mode - checking migration status...\n');
    
    // Show migration status
    runYarn(['prisma', 'migrate', 'status'], undefined);
  } else {
    console.log('📦 Applying migrations...\n');
    
    // Apply migrations
    runYarn(['prisma:migrate:deploy'], undefined);

    console.log('\n✅ Migrations applied successfully');
    
    // Generate Prisma client
    console.log('\n🔧 Regenerating Prisma Client...\n');
    runYarn(['prisma:generate'], undefined);

    console.log('\n✅ Database migration complete\n');
  }
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
