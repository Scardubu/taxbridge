#!/usr/bin/env node
/**
 * Database Connection & Phase 6 Tables Verification
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('\n🔍 Verifying Database Connection & Phase 6 Tables...\n');

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection: SUCCESS');

    // Check Phase 6 tables
    const phase6Tables = ['Payroll', 'PayrollItem', 'ComplianceReminder', 'CryptoTransaction'];
    
    for (const tableName of phase6Tables) {
      try {
        const query = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const result = await prisma.$queryRawUnsafe(query);
        console.log(`✅ Table "${tableName}": EXISTS (${result[0].count} records)`);
      } catch (error) {
        console.log(`❌ Table "${tableName}": NOT FOUND`);
      }
    }

    // Check all tables
    const allTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log(`\n📊 Total tables in database: ${allTables.length}`);
    console.log('\nAll tables:');
    allTables.forEach(t => console.log(`  - ${t.table_name}`));

    await prisma.$disconnect();
    
    console.log('\n✅ Database verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database verification failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyDatabase();
