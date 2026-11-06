import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './database';
import { apiRequest } from './api';
import { buildMobileOperationEnvelope } from './operationEnvelope';
import { classifyQueueFailure } from './offlineQueuePolicy';

// The durable server operation pipeline has no approved business handlers yet.
// Keep queued writes local until the shared contract and server worker are enabled.
const SYNC_PIPELINE_ENABLED = process.env.EXPO_PUBLIC_SYNC_PIPELINE_ENABLED === 'true';

export type OpType =
  | 'TIN_VERIFY'
  | 'VAT_REGISTER'
  | 'EINVOICE_SUBMIT'
  | 'INVOICE_SUBMIT'
  | 'RECEIPT_SUBMIT'
  | 'VAT_RETURN'
  | 'PROFILE_SYNC'
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
    if (!SYNC_PIPELINE_ENABLED) return;

    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === true && state.isInternetReachable === true && !this.flushing) {
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
    // Operation IDs must be UUIDs to satisfy the shared API contract.
    const clientId = Crypto.randomUUID();

    await db.runAsync(
      'INSERT OR IGNORE INTO offline_operations (client_id, type, payload) VALUES (?,?,?)',
      [clientId, type, JSON.stringify({ ...payload, clientId })]
    );
  }

  async flush(): Promise<void> {
    if (!SYNC_PIPELINE_ENABLED || this.flushing) return;
    this.flushing = true;

    try {
      // Require confirmed internet reachability, not merely an active network
      // interface (which may be a captive portal or disconnected upstream).
      const network = await NetInfo.fetch();
      if (network.isConnected !== true || network.isInternetReachable !== true) return;

      const db = await getDatabase();
      await db.runAsync("UPDATE offline_operations SET status='pending' WHERE status='syncing'");

      const operations = await db.getAllAsync<{
        id: number;
        client_id: string;
        type: string;
        payload: string;
        retry_count: number;
        max_retries: number;
      }>(
        `SELECT id, client_id, type, payload, retry_count, max_retries
         FROM offline_operations
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT 20`
      );

      for (const operation of operations) {
        await db.runAsync("UPDATE offline_operations SET status='syncing' WHERE id=?", [operation.id]);

        let requestStarted = false;
        try {
          const localPayload = JSON.parse(operation.payload) as Record<string, unknown>;
          const operationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation.client_id)
            ? operation.client_id
            : Crypto.randomUUID();
          const envelope = buildMobileOperationEnvelope({
            operationId,
            idempotencyKey: operation.client_id,
            clientOperationType: operation.type,
            payload: localPayload,
            createdAt: new Date().toISOString(),
          });

          requestStarted = true;
          await apiRequest('/api/v1/sync/operations', {
            method: 'POST',
            headers: { 'Idempotency-Key': operation.client_id },
            body: JSON.stringify(envelope),
          });

          await db.runAsync(
            "UPDATE offline_operations SET status='done', synced_at=datetime('now'), error_msg=NULL WHERE id=?",
            [operation.id]
          );
        } catch (error) {
          // Malformed local payload/envelope data cannot be fixed by retrying.
          if (!requestStarted) {
            await db.runAsync(
              "UPDATE offline_operations SET status='dead', error_msg=? WHERE id=?",
              [String(error), operation.id]
            );
            continue;
          }

          const disposition = classifyQueueFailure(error);
          if (disposition === 'pause') {
            // Preserve the operation and its idempotency key until the user
            // restores a valid authenticated session.
            await db.runAsync(
              "UPDATE offline_operations SET status='pending', error_msg=? WHERE id=?",
              [String(error), operation.id]
            );
            break;
          }

          if (disposition === 'terminal') {
            await db.runAsync(
              "UPDATE offline_operations SET status='dead', error_msg=? WHERE id=?",
              [String(error), operation.id]
            );
            continue;
          }

          const retryCount = operation.retry_count + 1;
          await db.runAsync(
            'UPDATE offline_operations SET status=?, retry_count=?, error_msg=? WHERE id=?',
            [retryCount >= operation.max_retries ? 'dead' : 'pending', retryCount, String(error), operation.id]
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

  /** Returns the number of operations that exhausted all retries and are in the dead-letter state. */
  async getDeadLetterCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM offline_operations WHERE status = 'dead'"
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
