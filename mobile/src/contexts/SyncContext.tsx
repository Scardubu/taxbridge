import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork } from './NetworkContext';
import { syncPendingInvoices } from '../services/sync';
import { performFullSync, listConflicts, collectLocalChanges } from '../services/deviceSync';
import { getAccessToken } from '../services/authTokens';
import { createLogger } from '../utils/logger';

const log = createLogger('sync-context');

type SyncResult = { synced: number; failed: number; deferred: number; conflicts?: number };

interface SyncContextType {
  isSyncing: boolean;
  lastSyncAt: number | null;
  manualSync: () => Promise<SyncResult>;
}

export const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within a SyncProvider');
  return ctx;
}

// Feature flag check
function isDeviceSyncEnabled(): boolean {
  return String(process.env.EXPO_PUBLIC_FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, forceCheck } = useNetwork();
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const isOnlinePrev = useRef<boolean | null>(null);
  const syncInProgress = useRef(false);

  async function hasAuthToken(): Promise<boolean> {
    const token = await getAccessToken();
    return Boolean(token);
  }

  async function doSyncWithBackoff(maxAttempts = 3): Promise<SyncResult> {
    let attempt = 0;
    let lastResult: SyncResult = { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

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
        // Try device sync first if enabled, fallback to legacy sync
        if (isDeviceSyncEnabled()) {
          log.info('Using device sync');
          const localChanges = await collectLocalChanges();
          log.info('Collected local changes for sync', { count: localChanges.length });
          const result = await performFullSync(localChanges);
          
          // Check for conflicts
          const conflictsResponse = await listConflicts();
          
          lastResult = {
            synced: result.pulled.invoices.length,
            failed: 0,
            deferred: result.pushed ? 1 : 0,
            conflicts: conflictsResponse.conflicts.length
          };
          return lastResult;
        } else {
          log.info('Using legacy invoice sync');
          const res = await syncPendingInvoices();
          lastResult = { ...res, conflicts: 0 };
          // If we synced or failed any, break and return results
          if (res.synced > 0 || res.failed > 0) {
            return lastResult;
          }
          // If nothing to do, just return
          return lastResult;
        }
      } catch (err) {
        log.error('Sync attempt failed', { attempt, error: err });
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
    if (!isOnline) {
      Alert.alert(t('sync.offlineTitle'), t('sync.offlineBody'));
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    }

    if (!(await hasAuthToken())) {
      Alert.alert(t('sync.signInRequiredTitle'), t('sync.signInRequiredBody'));
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    }

    if (syncInProgress.current) return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };

    setIsSyncing(true);
    syncInProgress.current = true;
    try {
      const res = await doSyncWithBackoff();
      setLastSyncAt(Date.now());
      if (res.synced > 0) {
        Alert.alert(
          t('sync.syncCompleteTitle'),
          t('sync.syncCompleteBody', { count: res.synced }) // i18next handles pluralization
        );
      }
      if (res.deferred > 0 && res.synced === 0 && res.failed === 0) {
        Alert.alert(
          t('sync.syncScheduledTitle'),
          t('sync.syncScheduledBody', { count: res.deferred })
        );
      }
      if (res.failed > 0) {
        Alert.alert(
          t('sync.syncErrorTitle'),
          t('sync.syncErrorBody', { count: res.failed })
        );
      }
      if (res.conflicts && res.conflicts > 0) {
        Alert.alert(
          t('sync.conflictsTitle'),
          t('sync.conflictsBody', { count: res.conflicts })
        );
      }
      return res;
    } catch (err) {
      log.error('Manual sync failed', { error: err });
      Alert.alert(t('sync.syncFailedTitle'), t('sync.syncFailedBody'));
      return { synced: 0, failed: 0, deferred: 0, conflicts: 0 };
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
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
        setIsSyncing(true);
        syncInProgress.current = true;
        try {
          const res = await doSyncWithBackoff();
          setLastSyncAt(Date.now());
          if (res.synced > 0) {
            // soft signal only; avoid noisy logging in production
            log.info('Auto-sync completed', { synced: res.synced });
          }
          if (res.failed > 0) {
            // surface important failures
            Alert.alert(
              t('sync.syncErrorTitle'),
              t('sync.syncFailedAfterReconnectBody', { count: res.failed })
            );
          }
        } finally {
          syncInProgress.current = false;
          setIsSyncing(false);
        }
      })();
    }
    isOnlinePrev.current = isOnline;
  }, [isOnline]);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSyncAt, manualSync }}>{children}</SyncContext.Provider>
  );
}
