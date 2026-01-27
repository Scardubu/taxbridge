const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL in .env');
    process.exitCode = 1;
    return;
  }

  const sqlPath = path.resolve(__dirname, 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const parsedUrl = new URL(databaseUrl);
  const sslMode = parsedUrl.searchParams.get('sslmode');
  const sslEnabled = process.env.DATABASE_SSL === 'true' || sslMode === 'require' || parsedUrl.searchParams.get('ssl') === 'true';
  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied successfully:', sqlPath);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
