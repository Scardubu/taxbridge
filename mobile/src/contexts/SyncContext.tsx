import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork } from './NetworkContext';
import { syncPendingInvoices } from '../services/sync';
import { getAccessToken } from '../services/authTokens';

type SyncResult = { synced: number; failed: number; deferred: number };

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
    let lastResult: SyncResult = { synced: 0, failed: 0, deferred: 0 };

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
        const res = await syncPendingInvoices();
        lastResult = res;
        // If we synced or failed any, break and return results (we surface failures to user)
        if (res.synced > 0 || res.failed > 0) {
          return res;
        }
        // If nothing to do, just return
        return res;
      } catch (err) {
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
      return { synced: 0, failed: 0, deferred: 0 };
    }

    if (!(await hasAuthToken())) {
      Alert.alert(t('sync.signInRequiredTitle'), t('sync.signInRequiredBody'));
      return { synced: 0, failed: 0, deferred: 0 };
    }

    if (syncInProgress.current) return { synced: 0, failed: 0, deferred: 0 };

    setIsSyncing(true);
    syncInProgress.current = true;
    try {
      const res = await doSyncWithBackoff();
      setLastSyncAt(Date.now());
      if (res.synced > 0) {
        Alert.alert(
          t('sync.syncCompleteTitle'),
          t('sync.syncCompleteBody', { count: res.synced, suffix: res.synced > 1 ? 's' : '' })
        );
      }
      if (res.deferred > 0 && res.synced === 0 && res.failed === 0) {
        Alert.alert(
          t('sync.syncScheduledTitle'),
          t('sync.syncScheduledBody', { count: res.deferred, suffix: res.deferred > 1 ? 's' : '' })
        );
      }
      if (res.failed > 0) {
        Alert.alert(
          t('sync.syncErrorTitle'),
          t('sync.syncErrorBody', { count: res.failed, suffix: res.failed > 1 ? 's' : '' })
        );
      }
      return res;
    } catch (err) {
      Alert.alert(t('sync.syncFailedTitle'), t('sync.syncFailedBody'));
      return { synced: 0, failed: 0, deferred: 0 };
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
          }
          if (res.failed > 0) {
            // surface important failures
            Alert.alert(
              t('sync.syncErrorTitle'),
              t('sync.syncFailedAfterReconnectBody', { count: res.failed, suffix: res.failed > 1 ? 's' : '' })
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
