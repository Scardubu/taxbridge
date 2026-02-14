/**
 * Sync Queue Service
 *
 * Provides CRUD operations for the local sync_queue table.
 * Supports both SQLite (native) and AsyncStorage (web) backends,
 * mirroring the dual-storage pattern used by database.ts.
 *
 * Feature-gated behind EXPO_PUBLIC_FEATURE_DEVICE_SYNC.
 *
 * @module services/syncQueue
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';
import type { SyncQueueRow, EnqueueSyncInput } from '../types/sync';

const log = createLogger('sync-queue');

const STORAGE_SYNC_QUEUE_KEY = 'taxbridge:syncQueue:v1';

// ── SQLite handle (mirrors database.ts pattern) ──────────────────────
let nativeExec: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SQLite = require('expo-sqlite');
    const db = SQLite.openDatabaseSync('taxbridge.db');
    nativeExec = async (sql: string, params: (string | number | null)[] = []) => {
      const isSelect = sql.trimStart().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        const rows = db.getAllSync(sql, ...params);
        return { rows: { _array: rows, length: rows.length } };
      }
      const result = db.runSync(sql, ...params);
      return {
        rows: { _array: [], length: 0 },
        insertId: result.lastInsertRowId,
        rowsAffected: result.changes,
      };
    };
  } catch {
    nativeExec = null;
  }
}

// ── AsyncStorage helpers (web fallback) ──────────────────────────────

async function readStoredQueue(): Promise<SyncQueueRow[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueRow[]) : [];
  } catch {
    return [];
  }
}

async function writeStoredQueue(rows: SyncQueueRow[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_SYNC_QUEUE_KEY, JSON.stringify(rows));
}

// ── UUID helper ──────────────────────────────────────────────────────

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Enqueue a new sync item.
 * Generates an id and timestamps automatically.
 */
export async function enqueueSyncQueueItem(input: EnqueueSyncInput): Promise<string> {
  const id = generateUuid();
  const now = new Date().toISOString();

  if (nativeExec) {
    await nativeExec(
      `INSERT INTO sync_queue
        (id, device_id, entity, action, client_version, payload, created_at, attempts, last_error, next_retry)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
      [
        id,
        input.deviceId ?? null,
        input.entity,
        input.action,
        input.clientVersion ?? 0,
        JSON.stringify(input.payload),
        now,
      ]
    );
    log.debug('Enqueued sync item (SQLite)', { id, entity: input.entity, action: input.action });
    return id;
  }

  const rows = await readStoredQueue();
  rows.push({
    id,
    deviceId: input.deviceId ?? null,
    entity: input.entity,
    action: input.action,
    clientVersion: input.clientVersion ?? 0,
    payload: input.payload,
    createdAt: now,
    attempts: 0,
    lastError: null,
    nextRetry: null,
  });
  await writeStoredQueue(rows);
  log.debug('Enqueued sync item (AsyncStorage)', { id, entity: input.entity, action: input.action });
  return id;
}

/**
 * Retrieve pending queue items eligible for processing.
 * Items with a future `next_retry` are excluded.
 */
export async function getPendingSyncQueueItems(limit = 50): Promise<SyncQueueRow[]> {
  const nowIso = new Date().toISOString();

  if (nativeExec) {
    const res = await nativeExec(
      `SELECT * FROM sync_queue
       WHERE next_retry IS NULL OR next_retry <= ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [nowIso, limit]
    );
    const arr: any[] = (res.rows as any)?._array ?? [];
    return arr.map(mapSqliteRow);
  }

  const rows = await readStoredQueue();
  return rows
    .filter((r) => !r.nextRetry || r.nextRetry <= nowIso)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .slice(0, limit);
}

/**
 * Update retry metadata on a queue item after a failed attempt.
 */
export async function updateSyncQueueItem(
  id: string,
  data: Partial<Pick<SyncQueueRow, 'attempts' | 'lastError' | 'nextRetry'>>
): Promise<void> {
  if (nativeExec) {
    await nativeExec(
      'UPDATE sync_queue SET attempts = ?, last_error = ?, next_retry = ? WHERE id = ?',
      [data.attempts ?? 0, data.lastError ?? null, data.nextRetry ?? null, id]
    );
    return;
  }

  const rows = await readStoredQueue();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) {
    rows[idx] = {
      ...rows[idx],
      attempts: data.attempts ?? rows[idx].attempts,
      lastError: data.lastError ?? rows[idx].lastError,
      nextRetry: data.nextRetry ?? rows[idx].nextRetry,
    };
    await writeStoredQueue(rows);
  }
}

/**
 * Remove successfully synced items from the queue.
 */
export async function removeSyncQueueItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  if (nativeExec) {
    const placeholders = ids.map(() => '?').join(',');
    await nativeExec(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
    log.debug('Removed sync queue items (SQLite)', { count: ids.length });
    return;
  }

  const rows = await readStoredQueue();
  const filtered = rows.filter((r) => !ids.includes(r.id));
  await writeStoredQueue(filtered);
  log.debug('Removed sync queue items (AsyncStorage)', { count: ids.length });
}

/**
 * Get the total count of pending items (for badge / UI display).
 */
export async function getSyncQueueCount(): Promise<number> {
  if (nativeExec) {
    const res = await nativeExec('SELECT COUNT(*) as cnt FROM sync_queue');
    return Number((res.rows as any)?._array?.[0]?.cnt ?? 0);
  }

  const rows = await readStoredQueue();
  return rows.length;
}

/**
 * Clear all sync queue items (used on logout or device reset).
 */
export async function clearSyncQueue(): Promise<void> {
  if (nativeExec) {
    await nativeExec('DELETE FROM sync_queue');
    log.info('Sync queue cleared (SQLite)');
    return;
  }

  await writeStoredQueue([]);
  log.info('Sync queue cleared (AsyncStorage)');
}

// ── Internal helpers ─────────────────────────────────────────────────

function mapSqliteRow(r: any): SyncQueueRow {
  return {
    id: r.id,
    deviceId: r.device_id ?? r.deviceId ?? null,
    entity: r.entity,
    action: r.action,
    clientVersion: Number(r.client_version ?? r.clientVersion ?? 0),
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    createdAt: r.created_at ?? r.createdAt,
    attempts: Number(r.attempts ?? 0),
    lastError: r.last_error ?? r.lastError ?? null,
    nextRetry: r.next_retry ?? r.nextRetry ?? null,
  };
}
