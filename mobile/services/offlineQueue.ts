import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './database';
import { apiRequest } from './api';

export type OpType =
  | 'TIN_VERIFY'
  | 'VAT_REGISTER'
  | 'EINVOICE_SUBMIT'
  | 'INVOICE_SUBMIT'
  | 'RECEIPT_SUBMIT'
  | 'VAT_RETURN'
  | 'PROFILE_SYNC'
  | 'PAYMENT_INITIATE'
  | 'COMPLIANCE_EVENT';

export class OfflineQueue {
  private static instance: OfflineQueue | null = null;
  private flushing = false;
  private unsubscribe: (() => void) | null = null;
  private ready = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /** Call once after the database has been initialised */
  start(): void {
    if (this.ready) return;
    this.ready = true;
    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.flushing) {
        this.flush().catch(() => undefined);
      }
    });
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  async enqueue(type: OpType, payload: Record<string, unknown>): Promise<void> {
    const db = await getDatabase();
    const clientId = typeof Crypto.randomUUID === 'function'
      ? Crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await db.runAsync(
      'INSERT OR IGNORE INTO offline_operations (client_id, type, payload) VALUES (?,?,?)',
      [clientId, type, JSON.stringify({ ...payload, clientId })]
    );
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    const db = await getDatabase();

    try {
      await db.runAsync("UPDATE offline_operations SET status='pending' WHERE status='syncing'");

      const operations = await db.getAllAsync<{
        id: number;
        client_id: string;
        type: string;
        payload: string;
        retry_count: number;
      }>(
        `SELECT id, client_id, type, payload, retry_count
         FROM offline_operations
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT 20`
      );

      for (const operation of operations) {
        await db.runAsync("UPDATE offline_operations SET status='syncing' WHERE id=?", [operation.id]);

        try {
          await apiRequest('/api/v1/sync/operations', {
            method: 'POST',
            body: JSON.stringify({
              clientId: operation.client_id,
              type: operation.type,
              payload: JSON.parse(operation.payload),
            }),
          });

          await db.runAsync(
            "UPDATE offline_operations SET status='done', synced_at=datetime('now') WHERE id=?",
            [operation.id]
          );
        } catch (error) {
          const retryCount = operation.retry_count + 1;
          await db.runAsync(
            'UPDATE offline_operations SET status=?, retry_count=?, error_msg=? WHERE id=?',
            [retryCount >= 5 ? 'dead' : 'pending', retryCount, String(error), operation.id]
          );
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async getPendingCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM offline_operations WHERE status IN ('pending', 'syncing')"
      );
      return result?.count ?? 0;
    } catch {
      return 0;
    }
  }

  destroy() {
    this.unsubscribe?.();
    OfflineQueue.instance = null;
  }
}

export const offlineQueue = OfflineQueue.getInstance();
