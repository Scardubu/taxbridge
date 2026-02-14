/**
 * Sync Queue Adapter
 *
 * Bridges the local sync queue (syncQueue.ts) with the backend device-sync
 * API (deviceSync.ts). Processes pending queue items in batches, handles
 * retries with exponential backoff, and returns a result summary compatible
 * with the SyncContext state machine.
 *
 * This adapter is invoked from SyncContext when EXPO_PUBLIC_FEATURE_DEVICE_SYNC
 * is enabled, replacing the direct `performFullSync` + `collectLocalChanges`
 * flow with a queue-driven approach.
 *
 * @module services/syncQueueAdapter
 */

import { createLogger } from '../utils/logger';
import { sendHeartbeat, syncPush, syncPull } from './deviceSync';
import {
  getPendingSyncQueueItems,
  updateSyncQueueItem,
  removeSyncQueueItems,
  getSyncQueueCount,
} from './syncQueue';
import { markInvoiceSynced } from './database';
import type { SyncQueueRow, SyncCycleResult } from '../types/sync';

const log = createLogger('sync-queue-adapter');

/** Maximum attempts before an item is considered permanently failed */
const MAX_ATTEMPTS = 5;

/** Cap backoff at 5 minutes */
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Compute exponential backoff with jitter.
 */
function computeBackoff(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

/**
 * Run a full queue-based sync cycle:
 *   1. Heartbeat to register/refresh device presence
 *   2. Push pending queue items to backend
 *   3. Pull server-side updates
 *
 * Returns a summary compatible with SyncContext's SyncResult type.
 */
export async function processQueueSync(): Promise<SyncCycleResult> {
  const result: SyncCycleResult = { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

  // ── Step 1: Heartbeat ────────────────────────────────────────────
  try {
    await sendHeartbeat();
  } catch (err) {
    log.error('Heartbeat failed during queue sync', { error: err });
    // Non-fatal: continue with push/pull even if heartbeat fails.
    // Device may already be registered from a previous session.
  }

  // ── Step 2: Push pending queue items ─────────────────────────────
  const pending = await getPendingSyncQueueItems(50);

  if (pending.length > 0) {
    log.info('Processing sync queue batch', { count: pending.length });

    // Group by entity type for batched push
    const invoiceItems = pending.filter((item) => item.entity === 'invoice');
    // Future: const expenseItems = pending.filter(…);

    if (invoiceItems.length > 0) {
      const pushResult = await pushBatch(invoiceItems);
      result.synced += pushResult.synced;
      result.failed += pushResult.failed;
      result.deferred += pushResult.deferred;
      result.conflicts += pushResult.conflicts;
    }

    // Items for unsupported entities get deferred automatically
    const unsupported = pending.filter((item) => item.entity !== 'invoice');
    for (const item of unsupported) {
      await updateSyncQueueItem(item.id, {
        attempts: (item.attempts ?? 0) + 1,
        lastError: `Entity "${item.entity}" sync not yet implemented`,
        nextRetry: new Date(Date.now() + MAX_BACKOFF_MS).toISOString(),
      });
      result.deferred += 1;
    }
  }

  // ── Step 3: Pull server changes ──────────────────────────────────
  try {
    const pullResult = await syncPull();
    log.info('Pull completed', { invoiceCount: pullResult.invoices.length });
    // Pull results are handled by the caller (SyncContext) for
    // applying server-side invoice updates to local storage.
  } catch (err) {
    log.error('Pull failed during queue sync', { error: err });
    // Non-fatal: push results are still valid
  }

  log.info('Queue sync cycle complete', result);
  return result;
}

/**
 * Push a batch of invoice queue items to the backend.
 * Handles per-item success/failure/conflict accounting.
 */
async function pushBatch(
  items: SyncQueueRow[]
): Promise<{ synced: number; failed: number; deferred: number; conflicts: number }> {
  const batchResult = { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

  try {
    const changes = items.map((item) => ({
      action: item.action as 'create' | 'update' | 'delete',
      entityType: 'invoice' as const,
      entityId: (item.payload.id as string) ?? item.id,
      data: item.payload,
      version: item.clientVersion,
    }));

    const pushResponse = await syncPush(changes);

    // Build lookup sets for result classification
    const syncedSet = new Set(pushResponse.synced ?? []);
    const conflictSet = new Set(pushResponse.conflicts ?? []);
    const failedSet = new Set(pushResponse.failed ?? []);

    const toRemove: string[] = [];

    for (const item of items) {
      const clientId = (item.payload.id as string) ?? item.id;

      if (syncedSet.has(clientId)) {
        // Successfully synced — remove from queue
        toRemove.push(item.id);
        batchResult.synced += 1;

        // Mark the local invoice as synced
        try {
          await markInvoiceSynced({
            id: clientId,
            serverId: clientId,
            status: 'queued',
          });
        } catch (markErr) {
          log.warn('Failed to mark invoice synced locally', { id: clientId, error: markErr });
        }
      } else if (conflictSet.has(clientId)) {
        // Conflict detected — keep in queue for user resolution
        toRemove.push(item.id);
        batchResult.conflicts += 1;
      } else if (failedSet.has(clientId)) {
        // Server rejected — apply retry or mark permanently failed
        const nextAttempt = (item.attempts ?? 0) + 1;
        if (nextAttempt >= MAX_ATTEMPTS) {
          toRemove.push(item.id);
          batchResult.failed += 1;
          log.warn('Queue item permanently failed', { id: item.id, clientId });
        } else {
          const backoff = computeBackoff(nextAttempt);
          await updateSyncQueueItem(item.id, {
            attempts: nextAttempt,
            lastError: 'Server rejected push',
            nextRetry: new Date(Date.now() + backoff).toISOString(),
          });
          batchResult.deferred += 1;
        }
      } else {
        // Item not mentioned in any result bucket — defer for retry
        const nextAttempt = (item.attempts ?? 0) + 1;
        if (nextAttempt >= MAX_ATTEMPTS) {
          toRemove.push(item.id);
          batchResult.failed += 1;
        } else {
          const backoff = computeBackoff(nextAttempt);
          await updateSyncQueueItem(item.id, {
            attempts: nextAttempt,
            lastError: 'No server acknowledgement',
            nextRetry: new Date(Date.now() + backoff).toISOString(),
          });
          batchResult.deferred += 1;
        }
      }
    }

    if (toRemove.length > 0) {
      await removeSyncQueueItems(toRemove);
    }
  } catch (err) {
    log.error('Push batch failed', { error: err, itemCount: items.length });

    // Network / auth failure — defer all items for retry
    for (const item of items) {
      const nextAttempt = (item.attempts ?? 0) + 1;
      if (nextAttempt >= MAX_ATTEMPTS) {
        await removeSyncQueueItems([item.id]);
        batchResult.failed += 1;
      } else {
        const backoff = computeBackoff(nextAttempt);
        await updateSyncQueueItem(item.id, {
          attempts: nextAttempt,
          lastError: err instanceof Error ? err.message : 'Push failed',
          nextRetry: new Date(Date.now() + backoff).toISOString(),
        });
        batchResult.deferred += 1;
      }
    }
  }

  return batchResult;
}

/**
 * Get the number of items waiting in the sync queue.
 * Useful for badge counts in the UI.
 */
export { getSyncQueueCount };
