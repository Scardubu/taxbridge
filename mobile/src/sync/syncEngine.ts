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

import { restoreDeviceState } from './device';
import { resumePendingSyncJobs } from './queue';
import { getNetworkState } from '../contexts/NetworkContext';

export async function warmUpSyncEngine(): Promise<void> {
  try {
    await restoreDeviceState();

    const isOnline = getNetworkState();
    if (isOnline) {
      await resumePendingSyncJobs();
    }
  } catch (err) {
    console.warn('[SyncEngine] Warm-up failed:', err);
  }
}
