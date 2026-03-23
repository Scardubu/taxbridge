import * as SQLite from 'expo-sqlite';

import type { InvoiceItem, InvoiceStatus, LocalInvoiceRow } from '../types/invoice';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  try {
    // Use openDatabaseAsync without options object (Constraint #9)
    db = await SQLite.openDatabaseAsync('taxbridge_v13.db');
    
    // Initialize database with performance optimizations
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA cache_size = -8000;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
    `);

    // Run migrations
    await runMigrations(db);
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

// Migration system
interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_business_profiles_and_offline_operations',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS business_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          business_name TEXT NOT NULL,
          business_type TEXT NOT NULL,
          tin TEXT,
          cac_number TEXT,
          email TEXT,
          phone TEXT,
          address TEXT,
          tax_office TEXT,
          registration_date TEXT,
          is_verified INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS offline_operations (
          client_id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_offline_operations_status 
          ON offline_operations(status);
        CREATE INDEX IF NOT EXISTS idx_offline_operations_entity 
          ON offline_operations(entity_type, entity_id);
      `);
    }
  },
  {
    version: 2,
    name: 'create_tax_records_and_compliance_events',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tax_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          tax_year TEXT NOT NULL,
          amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          due_date TEXT,
          paid_date TEXT,
          reference TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS compliance_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          event_data TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          synced INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_tax_records_type_year 
          ON tax_records(type, tax_year);
        CREATE INDEX IF NOT EXISTS idx_compliance_events_type 
          ON compliance_events(event_type);
      `);
    }
  },
  {
    version: 3,
    name: 'create_invoices_and_tax_payments',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          customer_name TEXT NOT NULL,
          customer_email TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          items TEXT NOT NULL,
          subtotal REAL NOT NULL,
          vat_amount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          due_date TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          nrs_compliant INTEGER DEFAULT 0,
          firs_irn TEXT,
          firs_csid TEXT,
          qr_code TEXT,
          notes TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tax_payments (
          id TEXT PRIMARY KEY,
          tax_type TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_date TEXT NOT NULL,
          payment_method TEXT,
          reference TEXT UNIQUE,
          remita_rrr TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          gateway_response TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_invoices_status 
          ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoices_due_date 
          ON invoices(due_date);
        CREATE INDEX IF NOT EXISTS idx_tax_payments_status 
          ON tax_payments(status);
        CREATE INDEX IF NOT EXISTS idx_tax_payments_reference 
          ON tax_payments(reference);
      `);
    }
  },
  {
    version: 4,
    name: 'legacy_invoice_compatibility_and_settings',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      const invoiceColumns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(invoices)"
      );
      const existingColumns = new Set(invoiceColumns.map((column) => column.name));

      const missingColumnStatements = [
        !existingColumns.has('server_id')
          ? 'ALTER TABLE invoices ADD COLUMN server_id TEXT;'
          : '',
        !existingColumns.has('customer_tin')
          ? 'ALTER TABLE invoices ADD COLUMN customer_tin TEXT;'
          : '',
        !existingColumns.has('customer_endpoint_id')
          ? 'ALTER TABLE invoices ADD COLUMN customer_endpoint_id TEXT;'
          : '',
        !existingColumns.has('attempts')
          ? 'ALTER TABLE invoices ADD COLUMN attempts INTEGER DEFAULT 0;'
          : '',
        !existingColumns.has('next_retry')
          ? 'ALTER TABLE invoices ADD COLUMN next_retry TEXT;'
          : '',
      ].filter(Boolean);

      for (const statement of missingColumnStatements) {
        await db.execAsync(statement);
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_invoices_created_at
          ON invoices(created_at);
        CREATE INDEX IF NOT EXISTS idx_invoices_synced
          ON invoices(synced);
      `);
    }
  }
];

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Create migrations table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      ran_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get current migration version
  const result = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM migrations'
  );
  const currentVersion = result?.version ?? 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      
      await db.withExclusiveTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          'INSERT INTO migrations (version, name) VALUES (?, ?)',
          [migration.version, migration.name]
        );
      });
      
      console.log(`Migration ${migration.version} completed`);
    }
  }
}

// Database helper functions
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM business_profiles;
      DELETE FROM offline_operations;
      DELETE FROM tax_records;
      DELETE FROM compliance_events;
      DELETE FROM invoices;
      DELETE FROM tax_payments;
    `);
  });
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

export async function initDB(): Promise<void> {
  await getDatabase();
}

type SaveInvoiceInput = {
  id: string;
  customerName?: string;
  customerTIN?: string;
  customerEndpointId?: string;
  status: InvoiceStatus;
  subtotal: number;
  vat: number;
  total: number;
  items: InvoiceItem[];
  createdAt: string;
  synced?: 0 | 1;
  attempts?: number;
  nextRetry?: string | null;
};

function mapInvoiceRow(row: Record<string, unknown>): LocalInvoiceRow {
  return {
    id: String(row.id),
    serverId: row.server_id ? String(row.server_id) : null,
    customerName: row.customer_name ? String(row.customer_name) : null,
    customerTIN: row.customer_tin ? String(row.customer_tin) : null,
    customerEndpointId: row.customer_endpoint_id ? String(row.customer_endpoint_id) : null,
    status: (row.status as InvoiceStatus | undefined) ?? 'queued',
    subtotal: Number(row.subtotal ?? 0),
    vat: Number(row.vat_amount ?? 0),
    total: Number(row.total ?? 0),
    items: typeof row.items === 'string' ? row.items : JSON.stringify(row.items ?? []),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    synced: Number(row.synced ?? 0) === 1 ? 1 : 0,
    attempts: Number(row.attempts ?? 0),
    nextRetry: row.next_retry ? String(row.next_retry) : null,
  };
}

export async function saveInvoice(input: SaveInvoiceInput): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO invoices (
      id,
      invoice_number,
      customer_name,
      customer_tin,
      customer_endpoint_id,
      items,
      subtotal,
      vat_amount,
      total,
      status,
      synced,
      created_at,
      updated_at,
      attempts,
      next_retry,
      server_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`,
    [
      input.id,
      input.id,
      input.customerName ?? 'Walk-in Customer',
      input.customerTIN ?? null,
      input.customerEndpointId ?? null,
      JSON.stringify(input.items),
      input.subtotal,
      input.vat,
      input.total,
      input.status,
      input.synced ?? 0,
      input.createdAt,
      input.attempts ?? 0,
      input.nextRetry ?? null,
      null,
    ]
  );
}

export async function getInvoices(): Promise<LocalInvoiceRow[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM invoices ORDER BY created_at DESC'
  );
  return rows.map(mapInvoiceRow);
}

export async function getPendingInvoices(): Promise<LocalInvoiceRow[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM invoices
     WHERE synced = 0 AND (next_retry IS NULL OR next_retry <= datetime('now'))
     ORDER BY created_at ASC`
  );
  return rows.map(mapInvoiceRow);
}

export async function getInvoiceStats(): Promise<{ total: number; synced: number; pending: number }> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number; synced: number }>(
    'SELECT COUNT(*) as total, SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced FROM invoices'
  );
  const total = Number(row?.total ?? 0);
  const synced = Number(row?.synced ?? 0);
  return {
    total,
    synced,
    pending: Math.max(0, total - synced),
  };
}

export async function markInvoiceSynced(input: { id: string; serverId: string; status: InvoiceStatus }): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE invoices
     SET synced = 1, server_id = ?, status = ?, attempts = 0, next_retry = NULL, updated_at = datetime('now')
     WHERE id = ?`,
    [input.serverId, input.status, input.id]
  );
}

export async function setInvoiceRetryMetadata(id: string, attempts: number, nextRetry: string | null): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE invoices
     SET attempts = ?, next_retry = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [attempts, nextRetry, id]
  );
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE invoices
     SET status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [status, id]
  );
}

export async function clearSyncedLocalInvoices(olderThanDays = 7): Promise<number> {
  const database = await getDatabase();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM invoices WHERE synced = 1 AND created_at < ?',
    [cutoff]
  );
  await database.runAsync(
    'DELETE FROM invoices WHERE synced = 1 AND created_at < ?',
    [cutoff]
  );
  return Number(row?.count ?? 0);
}

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// Get database info for debugging
export async function getDatabaseInfo(): Promise<{
  version: number;
  tables: string[];
  size?: number;
}> {
  const db = await getDatabase();
  
  const versionResult = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM migrations'
  );
  
  const tablesResult = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  
  return {
    version: versionResult?.version ?? 0,
    tables: tablesResult.map(t => t.name),
  };
}
