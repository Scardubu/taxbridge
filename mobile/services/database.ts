// mobile/services/database.ts
// C-06, C-07, SDK-05, SDK-06 fixes: version-gated migrations, no GENERATED column,
// correct openDatabaseAsync signature, withExclusiveTransactionAsync
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initDatabase(): Promise<void> {
  await getDatabase();
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  // Deduplicate concurrent initialisation calls
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    // SDK-06 fix: no options object — openDatabaseAsync('name') only
    const db = await SQLite.openDatabaseAsync('taxbridge_v13.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA cache_size = -8000;
      PRAGMA synchronous = NORMAL;
    `);
    await runMigrations(db);
    _db = db;
    return db;
  })();
  _dbPromise.catch(() => { _dbPromise = null; });
  return _dbPromise;
}

/** Close the database connection. Call this on app exit to prevent locks and corruption. */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  _dbPromise = null;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;

  if (v < 1) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS business_profiles (
          id INTEGER PRIMARY KEY DEFAULT 1,
          business_name TEXT NOT NULL DEFAULT '', trading_name TEXT,
          tin TEXT, rc_number TEXT, sector TEXT, business_type TEXT,
          annual_turnover REAL, monthly_revenue REAL, total_fixed_assets REAL,
          employee_count INTEGER DEFAULT 0, is_vat_registered INTEGER NOT NULL DEFAULT 0,
          vat_number TEXT, lga TEXT, state TEXT, phone TEXT, email TEXT,
          has_valid_tin INTEGER NOT NULL DEFAULT 0,
          onboarding_complete INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS offline_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK(type IN (
            'TIN_VERIFY','VAT_REGISTER','EINVOICE_SUBMIT',
            'PROFILE_SYNC','PAYMENT_INITIATE','COMPLIANCE_EVENT')),
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','syncing','done','failed','dead')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          error_msg TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_ops
          ON offline_operations (status, created_at);
        PRAGMA user_version = 1;
      `);
    });
    v = 1;
  }

  if (v < 2) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS tax_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          period TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('VAT','CIT','PIT','WHT','STAMP_DUTY','DEV_LEVY')),
          amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN',
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','filed','paid','overdue','disputed')),
          due_date TEXT, filed_at TEXT, paid_at TEXT,
          nrs_ref TEXT, remita_rrr TEXT, receipt_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS compliance_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          event_type TEXT NOT NULL, description TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
          resolved INTEGER NOT NULL DEFAULT 0, resolved_at TEXT, action_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tax_records ON tax_records (period, type);
        CREATE INDEX IF NOT EXISTS idx_compliance ON compliance_events (severity, resolved, created_at);
        PRAGMA user_version = 2;
      `);
    });
    v = 2;
  }

  if (v < 3) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          invoice_number TEXT NOT NULL, buyer_name TEXT NOT NULL, buyer_tin TEXT,
          subtotal REAL NOT NULL, vat_amount REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'NGN', firsmbs_ref TEXT, firsmbs_qr_url TEXT,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
          issued_at TEXT, due_date TEXT, paid_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tax_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          tax_record_id INTEGER REFERENCES tax_records(id),
          provider TEXT NOT NULL CHECK(provider IN ('paystack','flutterwave','remita')),
          provider_ref TEXT, remita_rrr TEXT,
          amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN',
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','processing','successful','failed','reversed')),
          initiated_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoices ON invoices (status, issued_at);
        CREATE INDEX IF NOT EXISTS idx_payments ON tax_payments (provider, status);
        PRAGMA user_version = 3;
      `);
    });
    v = 3;
  }

  if (v < 4) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        ALTER TABLE compliance_events ADD COLUMN source TEXT NOT NULL DEFAULT 'mobile';
        ALTER TABLE compliance_events ADD COLUMN business_id TEXT;
        ALTER TABLE compliance_events ADD COLUMN metadata TEXT;
        ALTER TABLE offline_operations RENAME TO offline_operations_legacy;
        CREATE TABLE offline_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK(type IN (
            'TIN_VERIFY','VAT_REGISTER','EINVOICE_SUBMIT','INVOICE_SUBMIT',
            'PROFILE_SYNC','PAYMENT_INITIATE','COMPLIANCE_EVENT')),
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','syncing','done','failed','dead')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          error_msg TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at TEXT
        );
        INSERT INTO offline_operations (
          id, client_id, type, payload, status, retry_count, max_retries, error_msg, created_at, synced_at
        )
        SELECT
          id,
          client_id,
          CASE WHEN type = 'EINVOICE_SUBMIT' THEN 'INVOICE_SUBMIT' ELSE type END,
          payload,
          status,
          retry_count,
          max_retries,
          error_msg,
          created_at,
          synced_at
        FROM offline_operations_legacy;
        DROP TABLE offline_operations_legacy;
        CREATE INDEX IF NOT EXISTS idx_offline_ops
          ON offline_operations (status, created_at);
        CREATE INDEX IF NOT EXISTS idx_compliance_source
          ON compliance_events (source, created_at);
        PRAGMA user_version = 4;
      `);
    });
    v = 4;
  }

  if (v < 5) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        ALTER TABLE business_profiles ADD COLUMN server_business_id TEXT;
      `).catch(() => undefined);

      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          server_id TEXT,
          business_id TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          vendor_tin TEXT,
          amount_ngn REAL NOT NULL,
          vat_amount_ngn REAL NOT NULL DEFAULT 0,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          image_hash TEXT,
          raw_ocr_text TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','synced','duplicate','flagged')),
          vat_credit_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_receipts_business_period
          ON receipts (business_id, date, status);
        CREATE INDEX IF NOT EXISTS idx_receipts_image_hash
          ON receipts (image_hash);

        CREATE TABLE IF NOT EXISTS vat_credits (
          id TEXT PRIMARY KEY,
          receipt_id TEXT NOT NULL REFERENCES receipts(id),
          business_id TEXT NOT NULL,
          amount_ngn REAL NOT NULL,
          period_month INTEGER NOT NULL,
          period_year INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'unverified'
            CHECK(status IN ('unverified','verified','applied')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_vat_credits_period
          ON vat_credits (business_id, period_year, period_month, status);

        CREATE TABLE IF NOT EXISTS vat_returns (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          period_month INTEGER NOT NULL,
          period_year INTEGER NOT NULL,
          output_vat_ngn REAL NOT NULL,
          input_credits_ngn REAL NOT NULL,
          net_payable_ngn REAL NOT NULL,
          firs_ref TEXT,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','submitted','accepted')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_vat_returns_period
          ON vat_returns (business_id, period_year, period_month, status);

        ALTER TABLE offline_operations RENAME TO offline_operations_v4;
        CREATE TABLE offline_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK(type IN (
            'TIN_VERIFY','VAT_REGISTER','EINVOICE_SUBMIT','INVOICE_SUBMIT',
            'PROFILE_SYNC','PAYMENT_INITIATE','COMPLIANCE_EVENT',
            'RECEIPT_SUBMIT','VAT_RETURN')),
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','syncing','done','failed','dead')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          error_msg TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at TEXT
        );
        INSERT INTO offline_operations (
          id, client_id, type, payload, status, retry_count, max_retries, error_msg, created_at, synced_at
        )
        SELECT id, client_id, type, payload, status, retry_count, max_retries, error_msg, created_at, synced_at
        FROM offline_operations_v4;
        DROP TABLE offline_operations_v4;
        CREATE INDEX IF NOT EXISTS idx_offline_ops
          ON offline_operations (status, created_at);
        PRAGMA user_version = 5;
      `);
    });
  }
}
