import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { OperationEnvelopeSchema, OperationResultSchema } from '@taxbridge/contracts';
import { createExpenseOperationEnvelope, createInvoiceOperationEnvelope, createReceiptAttachOperationEnvelope } from './operationEnvelope';
import { getDatabase } from './database';
import { ApiError, apiRequest } from './api';

export type OpType = 'EXPENSE_CREATE' | 'INVOICE_CREATE' | 'RECEIPT_ATTACH' | 'TIN_VERIFY' | 'VAT_REGISTER' | 'EINVOICE_SUBMIT' | 'INVOICE_SUBMIT' | 'RECEIPT_SUBMIT' | 'VAT_RETURN' | 'PROFILE_SYNC' | 'COMPLIANCE_EVENT';

const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;
function retryDelayMs(attempt: number): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.min(attempt, 12)));
  return exponential + Math.floor(Math.random() * Math.max(1, exponential * 0.2));
}
function asIsoUtc(sqliteDate: string): string {
  const normalized = sqliteDate.includes('T') ? sqliteDate : sqliteDate.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  return new Date(withZone).toISOString();
}
function toOperationType(type: OpType): 'crud' | 'sync' | 'filing' {
  if (type === 'EXPENSE_CREATE' || type === 'INVOICE_CREATE' || type === 'RECEIPT_ATTACH') return 'crud';
  if (type === 'VAT_RETURN' || type === 'EINVOICE_SUBMIT' || type === 'INVOICE_SUBMIT') return 'filing';
  if (type === 'PROFILE_SYNC' || type === 'COMPLIANCE_EVENT') return 'sync';
  return 'crud';
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
      if (state.isConnected && state.isInternetReachable !== false && !this.flushing) void this.flush();
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
      await db.runAsync("UPDATE offline_operations SET status='pending' WHERE status='syncing'");
      const operations = await db.getAllAsync<{
        id: number; client_id: string; type: OpType; payload: string;
        retry_count: number; max_retries: number; created_at: string;
      }>(
        `SELECT id, client_id, type, payload, retry_count, max_retries, created_at
         FROM offline_operations
         WHERE status='pending' AND retry_count < max_retries
           AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
         ORDER BY created_at ASC LIMIT 20`,
      );

      for (const operation of operations) {
        await db.runAsync("UPDATE offline_operations SET status='syncing' WHERE id=? AND status='pending'", [operation.id]);
        try {
          const rawPayload = { action: operation.type, data: JSON.parse(operation.payload) as Record<string, unknown> };
          const envelope = operation.type === 'EXPENSE_CREATE'
            ? createExpenseOperationEnvelope(operation.client_id, rawPayload.data as Record<string, unknown>, asIsoUtc(operation.created_at))
            : operation.type === 'INVOICE_CREATE'
              ? createInvoiceOperationEnvelope(operation.client_id, rawPayload.data as Record<string, unknown>, asIsoUtc(operation.created_at))
              : operation.type === 'RECEIPT_ATTACH'
                ? createReceiptAttachOperationEnvelope(operation.client_id, rawPayload.data as { receiptEvidenceId: string; expenseId: string }, asIsoUtc(operation.created_at))
                : OperationEnvelopeSchema.parse({
                operationId: operation.client_id,
                idempotencyKey: operation.client_id,
                operationType: toOperationType(operation.type),
                schemaVersion: 1,
                payload: rawPayload,
                createdAt: asIsoUtc(operation.created_at),
              });
          const response = await apiRequest<unknown>('/api/v1/sync/operations', {
            method: 'POST', body: JSON.stringify(envelope),
          });
          const result = OperationResultSchema.parse(response);
          if (result.status === 'acknowledged' || result.status === 'resolved') {
            await db.runAsync("UPDATE offline_operations SET status='done', synced_at=datetime('now'), next_attempt_at=NULL, error_msg=NULL WHERE id=?", [operation.id]);
          } else if (result.status === 'dead_letter') {
            await db.runAsync("UPDATE offline_operations SET status='dead', next_attempt_at=NULL, error_msg=? WHERE id=?", [result.errorCode ?? 'OPERATION_DEAD_LETTERED', operation.id]);
          } else {
            const nextAttemptAt = result.retryAt ?? new Date(Date.now() + 5_000).toISOString();
            await db.runAsync("UPDATE offline_operations SET status='pending', next_attempt_at=?, error_msg=? WHERE id=?", [nextAttemptAt, result.errorCode, operation.id]);
          }
        } catch (error) {
          const retryCount = operation.retry_count + 1;
          const terminal = !isRetryable(error) || retryCount >= operation.max_retries;
          const nextAttemptAt = terminal ? null : new Date(Date.now() + retryDelayMs(retryCount)).toISOString();
          await db.runAsync(
            'UPDATE offline_operations SET status=?, retry_count=?, next_attempt_at=?, error_msg=? WHERE id=?',
            [terminal ? 'dead' : 'pending', retryCount, nextAttemptAt, String(error), operation.id],
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
      const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM offline_operations WHERE status IN ('pending','syncing')");
      return result?.count ?? 0;
    } catch { return 0; }
  }
  async getDeadLetterCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM offline_operations WHERE status='dead'");
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
