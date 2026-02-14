/**
 * Sync Queue Types
 *
 * Defines the local sync queue item structure used by the mobile
 * sync queue adapter. These types mirror the backend SyncJob entity
 * contract but are scoped to client-side queue management.
 *
 * @module types/sync
 */

/** Entities supported by the sync queue */
export type SyncEntity = 'invoice' | 'expense' | 'payment';

/** Actions that can be queued for sync */
export type SyncAction = 'create' | 'update' | 'delete';

/**
 * A single row in the local sync_queue table (SQLite / AsyncStorage).
 * Each row represents one pending change that must be pushed to the backend.
 */
export interface SyncQueueRow {
  /** Client-generated UUID */
  id: string;
  /** Device ID that created the item (nullable for pre-registration queuing) */
  deviceId: string | null;
  /** Entity type being synced */
  entity: SyncEntity;
  /** Action to perform on the server */
  action: SyncAction;
  /** Monotonically increasing client version for conflict detection */
  clientVersion: number;
  /** Serialised entity payload (JSON string in SQLite, object after parse) */
  payload: Record<string, unknown>;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Number of push attempts so far */
  attempts: number;
  /** Error message from last failed attempt (null if none) */
  lastError: string | null;
  /** ISO 8601 timestamp when the item is eligible for the next retry */
  nextRetry: string | null;
}

/**
 * Input for enqueuing a new sync queue item.
 * `id`, `createdAt`, `attempts`, `lastError`, `nextRetry` are set automatically.
 */
export interface EnqueueSyncInput {
  deviceId?: string | null;
  entity: SyncEntity;
  action: SyncAction;
  clientVersion?: number;
  payload: Record<string, unknown>;
}

/**
 * Result summary returned after a queue-based sync cycle.
 */
export interface SyncCycleResult {
  /** Number of items successfully pushed */
  synced: number;
  /** Number of items that failed permanently */
  failed: number;
  /** Number of items deferred for retry */
  deferred: number;
  /** Number of conflicts detected */
  conflicts: number;
}
