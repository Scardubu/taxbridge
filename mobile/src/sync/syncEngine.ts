/**
 * Sync Engine Warm-Up
 *
 * Phase 4: Device + Sync State Machine Formalization
 * 
 * Purpose:
 *  - Initialize device identity and state
 *  - Load persisted device state
 *  - Restore sync context
 *  - Resume pending jobs if online
 *  - Prime network + storage state
 *
 * This MUST be safe to call multiple times.
 * Called from SplashScreen during boot.
 */

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { getDeviceId } from '../services/deviceSync';
import { syncPendingInvoices } from '../services/sync';
import { isOnline } from '../services/connectivity';
import { loadDeviceState } from '../services/deviceStatePersistence';
import { createLogger } from '../utils/logger';

const log = createLogger('sync-engine');

/**
 * Get device information for initialization
 */
export async function getDeviceInfo() {
  const deviceId = await getDeviceId();
  const platform = Platform.OS;
  const osVersion = Device.osVersion || null;
  const appVersion = Application.nativeApplicationVersion || '1.0.0';

  return {
    deviceId,
    platform,
    osVersion,
    appVersion,
  };
}

/**
 * Warm up sync engine at boot
 * Returns device info for context initialization
 */
export async function warmUpSyncEngine(): Promise<{
  deviceInfo: { deviceId: string; platform: string; osVersion: string | null; appVersion: string };
  persistedState: any;
}> {
  try {
    log.info('Warming up sync engine');

    // Step 1: Get device identity (with consent check)
    const deviceInfo = await getDeviceInfo();
    log.info('Device identity established', { deviceId: deviceInfo.deviceId });

    // Step 2: Load persisted device state
    const persistedState = await loadDeviceState();
    log.info('Device state loaded', { state: persistedState.state });

    // Step 3: Resume pending sync jobs if online
    if (isOnline()) {
      log.info('Device online, resuming pending sync jobs');
      void resumePendingSyncJobs();
    } else {
      log.info('Device offline, skipping sync job resume');
    }

    return {
      deviceInfo,
      persistedState,
    };
  } catch (err) {
    log.error('Sync engine warm-up failed', { error: err });
    
    // Return safe defaults on failure
    return {
      deviceInfo: {
        deviceId: 'unknown',
        platform: Platform.OS,
        osVersion: null,
        appVersion: '1.0.0',
      },
      persistedState: null,
    };
  }
}

async function resumePendingSyncJobs(): Promise<void> {
  try {
    await syncPendingInvoices();
    log.info('Pending sync jobs resumed');
  } catch (err) {
    log.warn('Resume pending jobs failed', { error: err });
  }
}
