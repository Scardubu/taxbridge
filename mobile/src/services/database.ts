import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InvoiceStatus, InvoiceItem, LocalInvoiceRow } from '../types/invoice';

// Use SQLite on native platforms; for web provide a lightweight localStorage-backed fallback
const STORAGE_INVOICES_KEY = 'taxbridge:invoices:v1';
const STORAGE_SETTINGS_KEY = 'taxbridge:settings:v1';

let nativeExec: any = null;
let nativeDb: any = null;

if (Platform.OS !== 'web') {
  try {
    // lazy require to avoid web resolution errors
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SQLite = require('expo-sqlite');
    nativeDb = SQLite.openDatabase('taxbridge.db');
    nativeExec = (sql: string, params: (string | number | null)[] = []) =>
      new Promise((resolve, reject) => {
        nativeDb.transaction(
          (tx: any) => {
            tx.executeSql(
              sql,
              params,
              (_tx: any, res: any) => resolve(res),
              (_tx: any, err: any) => {
                reject(err);
                return true;
              }
            );
          },
          (err?: any) => reject(err)
        );
      });
  } catch (e) {
    // If expo-sqlite isn't available, fall through to web-like storage.
    nativeExec = null;
    nativeDb = null;
  }
}

async function readStoredInvoices(): Promise<LocalInvoiceRow[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_INVOICES_KEY);
    return raw ? (JSON.parse(raw) as LocalInvoiceRow[]) : [];
  } catch (e) {
    return [];
  }
}

async function pruneOldSyncedInvoices(rows: LocalInvoiceRow[]): Promise<LocalInvoiceRow[]> {
  // First, remove all synced invoices older than 30 days to free space
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const pruned = rows.filter((r) => {
    // Keep: pending invoices OR recent synced invoices
    return r.synced === 0 || r.createdAt >= thirtyDaysAgo;
  });
  
  // If still too many, keep only the 150 most recent entries (ensure pending invoices stay)
  if (pruned.length > 150) {
    const pending = pruned.filter((r) => r.synced === 0);
    const synced = pruned.filter((r) => r.synced === 1);
    const recentSynced = synced.slice(0, Math.max(0, 150 - pending.length));
    return [...pending, ...recentSynced];
  }
  
  return pruned;
}

async function writeStoredInvoices(rows: LocalInvoiceRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(rows));
    return;
  } catch (err) {
    console.warn('writeStoredInvoices: failed to write storage, attempting cleanup...', err);
    // Try aggressive pruning to free space
    try {
      const pruned = await pruneOldSyncedInvoices(rows);
      console.log(`Pruned from ${rows.length} to ${pruned.length} invoices`);
      await AsyncStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(pruned));
      return;
    } catch (err2) {
      console.error('writeStoredInvoices: pruning failed, attempting emergency cleanup...', err2);
      // Emergency: keep only pending invoices and the 50 most recent synced
      try {
        const pending = rows.filter((r) => r.synced === 0);
        const synced = rows.filter((r) => r.synced === 1).slice(0, 50);
        const emergency = [...pending, ...synced];
        console.log(`Emergency cleanup: keeping ${emergency.length} invoices`);
        await AsyncStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(emergency));
        return;
      } catch (err3) {
        console.error('writeStoredInvoices: emergency cleanup failed', err3);
        throw new Error('Storage quota exceeded. Please clear app cache and retry.');
      }
    }
  }
}

export async function initDB(): Promise<void> {
  if (nativeExec) {
    await nativeExec(
      `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      customer_name TEXT,
      status TEXT,
      subtotal REAL,
      vat REAL,
      total REAL,
      items TEXT,
      created_at TEXT,
      synced INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      next_retry TEXT
    );`
    );

    await nativeExec(
      `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );`
    );
    // Helpful indexes for queries (ordering and pending lookups)
    await nativeExec('CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);');
    await nativeExec('CREATE INDEX IF NOT EXISTS idx_invoices_synced ON invoices(synced);');
    // Clean up old synced invoices to prevent storage quota issues
    await nativeExec(
      `DELETE FROM invoices WHERE synced = 1 AND created_at < datetime('now', '-30 days');`
    );
  } else {
    // ensure storage keys exist for web or fallback
    const existing = await readStoredInvoices();
    if (!existing) {
      await writeStoredInvoices([]);
    }
    const settings = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!settings) {
      await AsyncStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({}));
    }
    // Clean up old synced invoices in fallback storage
    try {
      const rows = await readStoredInvoices();
      const cleaned = await pruneOldSyncedInvoices(rows);
      if (cleaned.length < rows.length) {
        await writeStoredInvoices(cleaned);
      }
    } catch (e) {
      console.warn('initDB: cleanup failed', e);
    }
  }
}

export async function saveInvoice(input: {
  id: string;
  customerName?: string;
  status: InvoiceStatus;
  subtotal: number;
  vat: number;
  total: number;
  items: InvoiceItem[];
  createdAt: string;
  synced?: 0 | 1;
  attempts?: number;
  nextRetry?: string | null;
}): Promise<void> {
  if (nativeExec) {
    await nativeExec(
      `INSERT INTO invoices (
      id, server_id, customer_name, status, subtotal, vat, total, items, created_at, synced
      , attempts, next_retry
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        input.id,
        null,
        input.customerName ?? null,
        input.status,
        input.subtotal,
        input.vat,
        input.total,
        JSON.stringify(input.items),
        input.createdAt,
        input.synced ?? 0,
        input.attempts ?? 0,
        input.nextRetry ?? null,
      ]
    );
  } else {
    const rows = await readStoredInvoices();
    rows.unshift({
      id: input.id,
      serverId: null,
      customerName: input.customerName ?? null,
      status: input.status,
      subtotal: input.subtotal,
      vat: input.vat,
      total: input.total,
      items: JSON.stringify(input.items),
      createdAt: input.createdAt,
      synced: input.synced ?? 0,
      attempts: input.attempts ?? 0,
      nextRetry: input.nextRetry ?? null,
    } as unknown as LocalInvoiceRow);
    await writeStoredInvoices(rows);
  }
}

export async function getInvoices(): Promise<LocalInvoiceRow[]> {
  if (nativeExec) {
    const res = await nativeExec('SELECT * FROM invoices ORDER BY created_at DESC');
    const arr: any[] = (res.rows as any)?._array ?? [];
    return arr.map((r) => ({
      id: r.id,
      serverId: r.server_id ?? r.serverId ?? null,
      customerName: r.customer_name ?? r.customerName ?? null,
      status: r.status,
      subtotal: r.subtotal,
      vat: r.vat,
      total: r.total,
      items: typeof r.items === 'string' ? r.items : JSON.stringify(r.items ?? []),
      createdAt: r.created_at ?? r.createdAt,
      synced: Number(r.synced) as 0 | 1,
      attempts: Number(r.attempts) || 0,
      nextRetry: r.next_retry ?? r.nextRetry ?? null,
    } as LocalInvoiceRow));
  }
  const rows = await readStoredInvoices();
  // copy to avoid mutation; sort by createdAt (fallback storage uses camelCase)
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPendingInvoices(): Promise<LocalInvoiceRow[]> {
  if (nativeExec) {
    const res = await nativeExec(
      "SELECT * FROM invoices WHERE synced = 0 AND (next_retry IS NULL OR next_retry <= datetime('now')) ORDER BY created_at ASC"
    );
    const arr: any[] = (res.rows as any)?._array ?? [];
    return arr.map((r) => ({
      id: r.id,
      serverId: r.server_id ?? r.serverId ?? null,
      customerName: r.customer_name ?? r.customerName ?? null,
      status: r.status,
      subtotal: r.subtotal,
      vat: r.vat,
      total: r.total,
      items: typeof r.items === 'string' ? r.items : JSON.stringify(r.items ?? []),
      createdAt: r.created_at ?? r.createdAt,
      synced: Number(r.synced) as 0 | 1,
      attempts: Number(r.attempts) || 0,
      nextRetry: r.next_retry ?? r.nextRetry ?? null,
    } as LocalInvoiceRow));
  }
  const rows = await readStoredInvoices();
  const now = new Date().toISOString();
  return rows
    .filter((r) => r.synced === 0 && (!r.nextRetry || r.nextRetry <= now))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export async function markInvoiceSynced(input: { id: string; serverId: string; status: InvoiceStatus }): Promise<void> {
  if (nativeExec) {
    await nativeExec('UPDATE invoices SET synced = 1, server_id = ?, status = ?, attempts = 0, next_retry = NULL WHERE id = ?', [
      input.serverId,
      input.status,
      input.id,
    ]);
    return;
  }
  const rows = await readStoredInvoices();
  const idx = rows.findIndex((r) => r.id === input.id);
  if (idx >= 0) {
    rows[idx].synced = 1 as any;
    rows[idx].serverId = input.serverId as any;
    rows[idx].status = input.status as any;
    rows[idx].attempts = 0;
    rows[idx].nextRetry = null;
    await writeStoredInvoices(rows);
  }
}

export async function setInvoiceRetryMetadata(id: string, attempts: number, nextRetry: string | null): Promise<void> {
  if (nativeExec) {
    await nativeExec('UPDATE invoices SET attempts = ?, next_retry = ? WHERE id = ?', [attempts, nextRetry, id]);
    return;
  }
  const rows = await readStoredInvoices();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) {
    rows[idx].attempts = attempts;
    rows[idx].nextRetry = nextRetry;
    await writeStoredInvoices(rows);
  }
}

export async function clearSyncedLocalInvoices(olderThanDays = 7): Promise<number> {
  if (nativeExec) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const res = await nativeExec('DELETE FROM invoices WHERE synced = 1 AND created_at < ?', [cutoff]);
    // sqlite executeSql doesn't return affected rows reliably across platforms; return 0 for now
    return 0;
  }
  const rows = await readStoredInvoices();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const before = rows.length;
  const kept = rows.filter((r) => !(r.synced === 1 && r.createdAt < cutoff));
  await writeStoredInvoices(kept);
  return before - kept.length;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  if (nativeExec) {
    await nativeExec('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
    return;
  }
  const rows = await readStoredInvoices();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) {
    rows[idx].status = status as any;
    await writeStoredInvoices(rows);
  }
}

export async function getSetting(key: string): Promise<string | null> {
  if (nativeExec) {
    const res = await nativeExec('SELECT value FROM settings WHERE key = ?', [key]);
    const row = (res.rows as any)._array?.[0] as { value: string } | undefined;
    return row?.value ?? null;
  }
  const raw = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
  const obj = raw ? JSON.parse(raw) : {};
  return obj?.[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (nativeExec) {
    await nativeExec(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
    return;
  }
  const raw = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
  const obj = raw ? JSON.parse(raw) : {};
  obj[key] = value;
  await AsyncStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(obj));
}

const API_BASE_URL_KEY = 'api:baseUrl';
const DEFAULT_API_URL = 'http://localhost:3000';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const url = await getSetting(API_BASE_URL_KEY);
    return url || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export async function setApiBaseUrl(url: string): Promise<void> {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }
  await setSetting(API_BASE_URL_KEY, url);
}
