/**
 * Sync Engine Warm-Up
 *
 * Purpose:
 *  - Restore device identity
 *  - Resume pending jobs
 *  - Prime network + storage state
 *
 * This MUST be safe to call multiple times.
 */

import { getDeviceId } from '../services/deviceSync';
import { syncPendingInvoices } from '../services/sync';
import { isOnline } from '../services/connectivity';

export async function warmUpSyncEngine(): Promise<void> {
  try {
    await getDeviceId();

    if (isOnline()) {
      void resumePendingSyncJobs();
    }
  } catch (err) {
    console.warn('[SyncEngine] Warm-up failed:', err);
  }
}

async function resumePendingSyncJobs(): Promise<void> {
  try {
    await syncPendingInvoices();
  } catch (err) {
    console.warn('[SyncEngine] Resume pending jobs failed:', err);
  }
}
