import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { OperationResultSchema } from '@taxbridge/contracts';
import type { OperationResult } from '@taxbridge/contracts';
import { createExpenseOperationEnvelope, createInvoiceOperationEnvelope, createReceiptAttachOperationEnvelope } from './operationEnvelope';
import { getDatabase } from './database';
import { ApiError, apiRequest } from './api';

export type OpType = 'EXPENSE_CREATE' | 'INVOICE_CREATE' | 'RECEIPT_ATTACH';

const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;
const SERVER_STATUS_POLL_MS = 5_000;

function isSupportedOfflineType(type: string): type is OpType {
  return type === 'EXPENSE_CREATE' || type === 'INVOICE_CREATE' || type === 'RECEIPT_ATTACH';
}

function retryDelayMs(attempt: number): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.min(attempt, 12)));
  return exponential + Math.floor(Math.random() * Math.max(1, exponential * 0.2));
}

function asIsoUtc(sqliteDate: string): string {
  const normalized = sqliteDate.includes('T') ? sqliteDate : sqliteDate.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : normalized + 'Z';
  return new Date(withZone).toISOString();
}

async function persistServerOperationResult(
  db: Awaited<ReturnType<typeof getDatabase>>,
  localId: number,
  result: OperationResult,
): Promise<void> {
  if (result.status === 'acknowledged' || result.status === 'resolved') {
    await db.runAsync(
      "UPDATE offline_operations SET status='done', server_accepted=0, synced_at=datetime('now'), next_attempt_at=NULL, error_msg=NULL WHERE id=?",
      [localId],
    );
    return;
  }

  if (result.status === 'dead_letter') {
    await db.runAsync(
      "UPDATE offline_operations SET status='dead', server_accepted=0, next_attempt_at=NULL, error_msg=? WHERE id=?",
      [result.errorCode ?? 'OPERATION_DEAD_LETTERED', localId],
    );
    return;
  }

  const nextAttemptAt = result.retryAt ?? new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString();
  await db.runAsync(
    "UPDATE offline_operations SET status='pending', server_accepted=1, next_attempt_at=?, error_msg=? WHERE id=?",
    [nextAttemptAt, result.errorCode, localId],
  );
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    const details = error.details as { retryable?: unknown } | undefined;
    if (typeof details?.retryable === 'boolean') return details.retryable;
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return true;
}

export class OfflineQueue {
  private static instance: OfflineQueue | null = null;
  private flushing = false;
  private unsubscribe: (() => void) | null = null;
  private ready = false;
  private constructor() {}

  start(): void {
    if (this.ready) return;
    this.ready = true;
    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        if (!this.flushing) void this.flush();
        void import('./receiptEvidence')
          .then(({ resumePendingReceiptEvidenceUploads }) => resumePendingReceiptEvidenceUploads())
          .catch(() => undefined);
      }
    });
    void import('./receiptEvidence')
      .then(({ resumePendingReceiptEvidenceUploads }) => resumePendingReceiptEvidenceUploads())
      .catch(() => undefined);
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) OfflineQueue.instance = new OfflineQueue();
    return OfflineQueue.instance;
  }

  async enqueue(type: OpType, payload: Record<string, unknown>): Promise<void> {
    if (!isSupportedOfflineType(type)) {
      throw new Error('OFFLINE_OPERATION_NOT_SUPPORTED');
    }
    const db = await getDatabase();
    const clientId = Crypto.randomUUID();
    await db.runAsync(
      'INSERT OR IGNORE INTO offline_operations (client_id, type, payload) VALUES (?,?,?)',
      [clientId, type, JSON.stringify(payload)],
    );
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const network = await NetInfo.fetch();
      if (!network.isConnected || network.isInternetReachable === false) return;
      const db = await getDatabase();

      // A process can restart during a request. Re-open the row without
      // losing server_accepted: accepted work must be polled, not resubmitted.
      await db.runAsync("UPDATE offline_operations SET status='pending' WHERE status='syncing'");

      const operations = await db.getAllAsync<{
        id: number;
        client_id: string;
        type: string;
        payload: string;
        retry_count: number;
        max_retries: number;
        created_at: string;
        server_accepted: number;
      }>(
        \`SELECT id, client_id, type, payload, retry_count, max_retries, created_at, server_accepted
         FROM offline_operations
         WHERE status='pending' AND retry_count < max_retries
           AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
         ORDER BY created_at ASC LIMIT 20\`,
      );

      for (const operation of operations) {
        if (!isSupportedOfflineType(operation.type)) {
          // Legacy SQLite rows remain intact for audit but cannot be replayed
          // to handlers that have not passed the operation governance gate.
          await db.runAsync(
            "UPDATE offline_operations SET status='dead', server_accepted=0, next_attempt_at=NULL, error_msg='UNSUPPORTED_OFFLINE_OPERATION' WHERE id=?",
            [operation.id],
          );
          continue;
        }

        await db.runAsync(
          "UPDATE offline_operations SET status='syncing' WHERE id=? AND status='pending'",
          [operation.id],
        );

        if (operation.server_accepted === 1) {
          try {
            const response = await apiRequest<unknown>(
              '/api/v1/sync/operations/' + encodeURIComponent(operation.client_id),
            );
            const result = OperationResultSchema.parse(response);
            await persistServerOperationResult(db, operation.id, result);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              // Only a missing record permits re-submission. The original
              // client ID/idempotency key are reused to prevent duplicate effects.
              await db.runAsync(
                "UPDATE offline_operations SET status='pending', server_accepted=0, next_attempt_at=NULL, error_msg=NULL WHERE id=?",
                [operation.id],
              );
            } else {
              // Poll failures do not consume the submission retry budget.
              await db.runAsync(
                "UPDATE offline_operations SET status='pending', server_accepted=1, next_attempt_at=?, error_msg='SERVER_STATUS_POLL_FAILED' WHERE id=?",
                [new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString(), operation.id],
              );
            }
          }
          continue;
        }

        try {
          const data = JSON.parse(operation.payload) as Record<string, unknown>;
          const createdAt = asIsoUtc(operation.created_at);
          const envelope = operation.type === 'EXPENSE_CREATE'
            ? createExpenseOperationEnvelope(operation.client_id, data, createdAt)
            : operation.type === 'INVOICE_CREATE'
              ? createInvoiceOperationEnvelope(operation.client_id, data, createdAt)
              : createReceiptAttachOperationEnvelope(
                  operation.client_id,
                  data as { receiptEvidenceId: string; expenseId: string },
                  createdAt,
                );

          const response = await apiRequest<unknown>('/api/v1/sync/operations', {
            method: 'POST',
            body: JSON.stringify(envelope),
          });
          const result = OperationResultSchema.parse(response);
          await persistServerOperationResult(db, operation.id, result);
        } catch (error) {
          const retryCount = operation.retry_count + 1;
          const terminal = !isRetryable(error) || retryCount >= operation.max_retries;
          const nextAttemptAt = terminal
            ? null
            : new Date(Date.now() + retryDelayMs(retryCount)).toISOString();
          await db.runAsync(
            'UPDATE offline_operations SET status=?, server_accepted=0, retry_count=?, next_attempt_at=?, error_msg=? WHERE id=?',
            [
              terminal ? 'dead' : 'pending',
              retryCount,
              nextAttemptAt,
              error instanceof ApiError ? error.code : 'OPERATION_CLIENT_VALIDATION_FAILED',
              operation.id,
            ],
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
        "SELECT COUNT(*) as count FROM offline_operations WHERE status IN ('pending','syncing')",
      );
      return result?.count ?? 0;
    } catch { return 0; }
  }

  async getDeadLetterCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM offline_operations WHERE status='dead'",
      );
      return result?.count ?? 0;
    } catch { return 0; }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ready = false;
    OfflineQueue.instance = null;
  }
}

export const offlineQueue = OfflineQueue.getInstance();
