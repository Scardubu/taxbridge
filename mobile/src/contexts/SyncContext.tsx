import React, { createContext, useContext, useEffect, useRef, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { useNetwork } from './NetworkContext';
import { useDevice } from './DeviceContext';
import { syncPendingInvoices } from '../services/sync';
import { performFullSync, listConflicts, collectLocalChanges } from '../services/deviceSync';
import { processQueueSync, getSyncQueueCount } from '../services/syncQueueAdapter';
import { getAccessToken } from '../services/authTokens';
import { createLogger } from '../utils/logger';
import { trackSync } from '../services/analytics';
import { showToast } from '../components/ui/Toast';
import { DURATION } from '../design-system/animation';
import { 
  syncReducer, 
  initialSyncState, 
  type SyncState,
  type SyncError,
  type SyncProgress
} from '../sync/syncReducer';

/**
 * Sync Context
 * 
 * Phase 4: Device + Sync State Machine Formalization
 * 
 * Provides access to sync state machine.
 * 
 * Rules:
 *  - All state transitions via reducer dispatch (syncReducer)
 *  - NO direct state mutations from components
 *  - manualSync() and retrySync() are action dispatchers (emit events)
 *  - State snapshot is read-only
 * 
 * Integration:
 *  - Uses DeviceContext to check if device can sync
 *  - Dispatches DEVICE_SYNC_SUCCESS to device reducer on successful sync
 */

const log = createLogger('sync-context');

type SyncResult = { synced: number; failed: number; deferred: number; conflicts?: number };

interface SyncContextType {
  // Read-only state snapshot
  syncState: SyncState;
  lastSyncAt: number | null;
  conflictCount: number;
  lastError: SyncError | null;
  progress: SyncProgress | null;
  
  // Action dispatchers (emit events to reducer)
  manualSync: () => Promise<SyncResult>;
  retrySync: () => Promise<void>;
  
  // Legacy compatibility
  isSyncing: boolean;
}

export const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within a SyncProvider');
  return ctx;
}

// Backward-compatible alias used by UI components
export function useSync() {
  return useSyncContext();
}

// Feature flag check
function isDeviceSyncEnabled(): boolean {
  return String(process.env.EXPO_PUBLIC_FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, forceCheck } = useNetwork();
  const device = useDevice();
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
  const isOnlinePrev = useRef<boolean | null>(null);
  const syncInProgress = useRef(false);

  async function hasAuthToken(): Promise<boolean> {
    const token = await getAccessToken();
    return Boolean(token);
  }
  
  /**
   * Check if device is allowed to sync
   * Phase 4: Checks device state (REGISTERED or ACTIVE)
   */
  function canDeviceSync(): boolean {
    if (!device.canSync) {
      log.warn('Device cannot sync', { 
        deviceState: device.deviceState,
        reason: device.suspensionReason 
      });
      return false;
    }
    return true;
  }

  async function doSyncWithBackoff(maxAttempts = 3): Promise<SyncResult> {
    let attempt = 0;
    let lastResult: SyncResult = { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

    dispatch({ type: 'SYNC_CONNECTING' });

    while (attempt < maxAttempts) {
      attempt += 1;
      // ensure network is actually reachable before trying
      // eslint-disable-next-line no-await-in-loop
      const reachable = await (forceCheck ? forceCheck() : Promise.resolve(isOnline));
      if (!reachable) {
        // if not reachable, wait and retry
        const waitNoNet = Math.min(30000, 1000 * Math.pow(2, attempt));
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, waitNoNet));
        continue;
      }
      try {
        if (isDeviceSyncEnabled()) {
          // ── Queue-based device sync (primary path) ─────────────
          log.info('Using queue-based device sync');

          const queueCount = await getSyncQueueCount();
          dispatch({ type: 'SYNC_PUSHING', payload: { total: queueCount } });

          const queueResult = await processQueueSync();

          dispatch({ type: 'SYNC_PULLING', payload: { total: 0 } });

          // Check for conflicts from the backend
          const conflictsResponse = await listConflicts();
          const conflictCount = conflictsResponse.conflicts.length;

          if (conflictCount > 0) {
            dispatch({
              type: 'SYNC_RESOLVING',
              payload: { conflictCount },
            });
          }

          lastResult = {
            synced: queueResult.synced,
            failed: queueResult.failed,
            deferred: queueResult.deferred,
            conflicts: conflictCount + queueResult.conflicts,
          };

          dispatch({
            type: 'SYNC_SUCCESS',
            payload: {
              synced: lastResult.synced,
              conflictCount: lastResult.conflicts || 0,
            },
          });

          return lastResult;
        } else {
          // ── Legacy invoice sync (feature flag off) ─────────────
          log.info('Using legacy invoice sync');
          const res = await syncPendingInvoices();
          lastResult = { ...res, conflicts: 0 };
          
          dispatch({ 
            type: 'SYNC_SUCCESS', 
            payload: { synced: res.synced, conflictCount: 0 } 
          });
          
          // If we synced or failed any, break and return results
          if (res.synced > 0 || res.failed > 0) {
            return lastResult;
          }
          // If nothing to do, just return
          return lastResult;
        }
      } catch (err) {
        log.error('Sync attempt failed', { attempt, error: err });
        
        const isLastAttempt = attempt >= maxAttempts;
        if (isLastAttempt) {
          dispatch({ 
            type: 'SYNC_ERROR', 
            payload: { 
              message: err instanceof Error ? err.message : 'Unknown sync error',
              retryable: true 
            } 
          });
        }
        
        // wait exponential backoff with jitter before retrying
        const base = Math.min(30000, Math.pow(2, attempt) * 1000);
        const jitter = Math.round(Math.random() * 1000);
        const delay = base + jitter;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return lastResult;
  }

  async function manualSync() {
    // Phase 4: Check device state first
    if (!canDeviceSync()) {
      if (device.isSuspended) {
        showToast({
          type: 'warning',
          message: t('sync.deviceSuspendedBody', { reason: device.suspensionReason }),
          haptic: 'warning',
          duration: DURATION.notice
        });
      } else {
        showToast({
          type: 'warning',
          message: t('sync.deviceNotRegisteredBody'),
          haptic: 'warning',
          duration: DURATION.notice
        });
      }
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    }
    
    if (!isOnline) {
      showToast({
        type: 'warning',
        message: t('sync.offlineBody'),
        haptic: 'warning'
      });
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    }

    if (!(await hasAuthToken())) {
      showToast({
        type: 'warning',
        message: t('sync.signInRequiredBody'),
        haptic: 'warning'
      });
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    }

    if (syncInProgress.current) return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

    syncInProgress.current = true;
    try {
      const res = await doSyncWithBackoff();
      const resultType = res.failed > 0 ? (res.synced > 0 ? 'partial' : 'failed') : 'success';
      void trackSync('manual', resultType, res.synced);
      
      if (res.synced > 0) {
        showToast({
          type: 'success',
          message: t('sync.syncCompleteBody', { count: res.synced }),
          haptic: 'success'
        });
      }
      if (res.deferred > 0 && res.synced === 0 && res.failed === 0) {
        showToast({
          type: 'info',
          message: t('sync.syncScheduledBody', { count: res.deferred })
        });
      }
      if (res.failed > 0) {
        showToast({
          type: 'error',
          message: t('sync.syncErrorBody', { count: res.failed }),
          haptic: 'error',
          duration: DURATION.notice
        });
      }
      if (res.conflicts && res.conflicts > 0) {
        showToast({
          type: 'warning',
          message: t('sync.conflictsBody', { count: res.conflicts }),
          haptic: 'warning',
          duration: DURATION.notice
        });
      }
      return res;
    } catch (err) {
      log.error('Manual sync failed', { error: err });
      void trackSync('manual', 'failed', 0);
      dispatch({ 
        type: 'SYNC_ERROR', 
        payload: { 
          message: err instanceof Error ? err.message : 'Unknown error',
          retryable: true 
        } 
      });
      showToast({
        type: 'error',
        message: t('sync.syncFailedBody'),
        haptic: 'error',
        duration: DURATION.notice
      });
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    } finally {
      syncInProgress.current = false;
    }
  }

  async function retrySync() {
    if (state.lastError && state.lastError.retryable) {
      dispatch({ type: 'SYNC_RESET' });
      await manualSync();
    }
  }

  // auto-sync on reconnect
  useEffect(() => {
    if (isOnline && isOnlinePrev.current === false) {
      // became online
      // run background sync but don't block UI; show a small alert only if something synced/failed
      (async () => {
        // If the user is not signed in, don't auto-sync.
        if (!(await hasAuthToken())) return;
        
        syncInProgress.current = true;
        try {
          const res = await doSyncWithBackoff();
          
          if (res.synced > 0) {
            // soft signal only; avoid noisy logging in production
            log.info('Auto-sync completed', { synced: res.synced });
          }
          if (res.failed > 0) {
            // surface important failures
            showToast({
              type: 'error',
              message: t('sync.syncFailedAfterReconnectBody', { count: res.failed }),
              haptic: 'error',
              duration: DURATION.notice
            });
          }
        } finally {
          syncInProgress.current = false;
        }
      })();
    }
    isOnlinePrev.current = isOnline;
  }, [isOnline]);

  const contextValue: SyncContextType = {
    syncState: state.syncState,
    lastSyncAt: state.lastSyncAt,
    conflictCount: state.conflictCount,
    lastError: state.lastError,
    progress: state.progress,
    manualSync,
    retrySync,
    // Legacy compatibility
    isSyncing: state.syncState !== 'idle' && state.syncState !== 'error' && state.syncState !== 'success',
  };

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
}
