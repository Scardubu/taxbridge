// mobile/services/database.ts
// C-06, C-07, SDK-05, SDK-06 fixes: version-gated migrations, no GENERATED column,
// correct openDatabaseAsync signature, withExclusiveTransactionAsync
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
  }
}
