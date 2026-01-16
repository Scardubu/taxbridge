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

console.log('\n🔄 TaxBridge Database Migration\n');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database: ${process.env.DATABASE_URL ? 'configured' : '❌ not configured'}\n`);

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set\n');
  process.exit(1);
}

try {
  if (isDryRun) {
    console.log('🔍 Dry run mode - checking migration status...\n');
    
    // Show migration status
    execSync('npx prisma migrate status', {
      cwd: backendDir,
      stdio: 'inherit'
    });
  } else {
    console.log('📦 Applying migrations...\n');
    
    // Apply migrations
    execSync('npx prisma migrate deploy', {
      cwd: backendDir,
      stdio: 'inherit'
    });

    console.log('\n✅ Migrations applied successfully');
    
    // Generate Prisma client
    console.log('\n🔧 Regenerating Prisma Client...\n');
    execSync('npx prisma generate', {
      cwd: backendDir,
      stdio: 'inherit'
    });

    console.log('\n✅ Database migration complete\n');
  }
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
