#!/usr/bin/env node

/**
 * Database Connection Diagnostic Tool
 * Tests Supabase PostgreSQL connectivity
 */

const { Pool } = require('pg');
const dns = require('dns').promises;
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const poolUrl = process.env.DATABASE_POOL_URL;

if (!databaseUrl && !migrationUrl && !poolUrl) {
  console.error('❌ DATABASE_URL environment variable not found');
  process.exit(1);
}

function maskUrl(url) {
  return url.replace(/:[^:@]+@/, ':****@');
}

function pickUrl() {
  // Prefer the most "migration-like" URL when present
  return migrationUrl || databaseUrl || poolUrl;
}

async function printDnsHints(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }

  try {
    const [a, aaaa] = await Promise.all([
      dns.resolve4(host).catch(() => []),
      dns.resolve6(host).catch(() => [])
    ]);

    console.log('\n🌐 DNS Resolution:');
    console.log(`   Host: ${host}`);
    console.log(`   A (IPv4): ${a.length ? a.join(', ') : '—'}`);
    console.log(`   AAAA (IPv6): ${aaaa.length ? aaaa.join(', ') : '—'}`);

    if (!a.length && aaaa.length) {
      console.log('\n⚠️  This host resolves to IPv6 only. If your network has no IPv6 route, use Render shell for migrations or a pooler/session endpoint with IPv4.');
    }
  } catch {
    // best-effort only
  }
}

console.log('🔍 Testing Supabase Database Connection...\n');
const selectedUrl = pickUrl();
console.log(`📍 Database URL: ${maskUrl(selectedUrl)}`);

// Print DNS hints to quickly diagnose IPv6-only direct hosts
printDnsHints(selectedUrl).then(() => {}).catch(() => {});

const pool = new Pool({
  connectionString: selectedUrl,
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL
  },
  connectionTimeoutMillis: 10000
});

async function testConnection() {
  let client;
  try {
    console.log('\n⏳ Connecting to database...');
    client = await pool.connect();
    console.log('✅ Successfully connected to database!');

    // Test query
    console.log('\n⏳ Running test query...');
    const result = await client.query('SELECT version(), current_database(), current_schema()');
    console.log('✅ Query successful!\n');
    
    console.log('📊 Database Info:');
    console.log(`   Version: ${result.rows[0].version.split(',')[0]}`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Schema: ${result.rows[0].current_schema}`);

    // Check if migrations table exists
    console.log('\n⏳ Checking migrations table...');
    const migrationsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      );
    `);
    
    if (migrationsCheck.rows[0].exists) {
      console.log('✅ _prisma_migrations table exists');
      
      const migrationsCount = await client.query('SELECT COUNT(*) FROM "_prisma_migrations"');
      console.log(`   Applied migrations: ${migrationsCount.rows[0].count}`);
    } else {
      console.log('⚠️  _prisma_migrations table does not exist (database is new)');
    }

    console.log('\n✅ All connection tests passed!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check if the Supabase project is active');
      console.error('   - Verify the database URL is correct');
      console.error('   - Check your internet connection');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   - The database might be paused (Supabase free tier)');
      console.error('   - Check firewall settings');
      console.error('   - Try accessing the Supabase dashboard');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Verify the database password is correct');
      console.error('   - Check if password has special characters that need URL encoding');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testConnection();
