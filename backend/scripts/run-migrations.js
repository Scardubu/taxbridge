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

const { execSync } = require('child_process');
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

const isWindows = process.platform === 'win32';
const prismaBin = isWindows ? 'node_modules\\.bin\\prisma.cmd' : 'node_modules/.bin/prisma';

try {
  if (isDryRun) {
    console.log('🔍 Dry run mode - checking migration status...\n');
    
    // Show migration status
    execSync(`${prismaBin} migrate status`, {
      cwd: backendDir,
      stdio: 'inherit',
      env: prismaEnv
    });
  } else {
    console.log('📦 Applying migrations...\n');
    
    // Apply migrations
    execSync(`${prismaBin} migrate deploy`, {
      cwd: backendDir,
      stdio: 'inherit',
      env: prismaEnv
    });

    console.log('\n✅ Migrations applied successfully');
    
    // Generate Prisma client
    console.log('\n🔧 Regenerating Prisma Client...\n');
    execSync(`${prismaBin} generate`, {
      cwd: backendDir,
      stdio: 'inherit',
      env: prismaEnv
    });

    console.log('\n✅ Database migration complete\n');
  }
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
