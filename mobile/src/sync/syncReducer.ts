/**
 * Sync State Machine
 * 
 * States:
 *  - idle: No sync activity
 *  - connecting: Checking network and auth
 *  - pushing: Sending local changes to server
 *  - pulling: Fetching server changes
 *  - resolving: Processing conflicts
 *  - error: Sync failed with error details
 *  - success: Sync completed successfully
 */

export type SyncState = 'idle' | 'connecting' | 'pushing' | 'pulling' | 'resolving' | 'error' | 'success';

export interface SyncError {
  message: string;
  retryable: boolean;
  timestamp: number;
}

export interface SyncProgress {
  current: number;
  total: number;
  phase: string;
}

export interface SyncSnapshot {
  syncState: SyncState;
  lastSyncAt: number | null;
  conflictCount: number;
  lastError: SyncError | null;
  progress: SyncProgress | null;
  pendingCount: number;
}

export type SyncEvent =
  | { type: 'SYNC_IDLE' }
  | { type: 'SYNC_CONNECTING' }
  | { type: 'SYNC_PUSHING'; payload: { total: number } }
  | { type: 'SYNC_PUSHING_PROGRESS'; payload: { current: number } }
  | { type: 'SYNC_PULLING'; payload: { total: number } }
  | { type: 'SYNC_PULLING_PROGRESS'; payload: { current: number } }
  | { type: 'SYNC_RESOLVING'; payload: { conflictCount: number } }
  | { type: 'SYNC_SUCCESS'; payload: { synced: number; conflictCount: number } }
  | { type: 'SYNC_ERROR'; payload: { message: string; retryable: boolean } }
  | { type: 'SYNC_RESET' };

export const initialSyncState: SyncSnapshot = {
  syncState: 'idle',
  lastSyncAt: null,
  conflictCount: 0,
  lastError: null,
  progress: null,
  pendingCount: 0,
};

export function syncReducer(state: SyncSnapshot, event: SyncEvent): SyncSnapshot {
  switch (event.type) {
    case 'SYNC_IDLE':
      return {
        ...state,
        syncState: 'idle',
        progress: null,
      };

    case 'SYNC_CONNECTING':
      return {
        ...state,
        syncState: 'connecting',
        lastError: null,
        progress: null,
      };

    case 'SYNC_PUSHING':
      return {
        ...state,
        syncState: 'pushing',
        progress: {
          current: 0,
          total: event.payload.total,
          phase: 'pushing',
        },
      };

    case 'SYNC_PUSHING_PROGRESS':
      return {
        ...state,
        progress: state.progress
          ? { ...state.progress, current: event.payload.current }
          : null,
      };

    case 'SYNC_PULLING':
      return {
        ...state,
        syncState: 'pulling',
        progress: {
          current: 0,
          total: event.payload.total,
          phase: 'pulling',
        },
      };

    case 'SYNC_PULLING_PROGRESS':
      return {
        ...state,
        progress: state.progress
          ? { ...state.progress, current: event.payload.current }
          : null,
      };

    case 'SYNC_RESOLVING':
      return {
        ...state,
        syncState: 'resolving',
        conflictCount: event.payload.conflictCount,
        progress: null,
      };

    case 'SYNC_SUCCESS':
      return {
        ...state,
        syncState: 'success',
        lastSyncAt: Date.now(),
        conflictCount: event.payload.conflictCount,
        lastError: null,
        progress: null,
        pendingCount: 0,
      };

    case 'SYNC_ERROR':
      return {
        ...state,
        syncState: 'error',
        lastError: {
          message: event.payload.message,
          retryable: event.payload.retryable,
          timestamp: Date.now(),
        },
        progress: null,
      };

    case 'SYNC_RESET':
      return {
        ...state,
        syncState: 'idle',
        lastError: null,
        progress: null,
      };

    default:
      return state;
  }
}
