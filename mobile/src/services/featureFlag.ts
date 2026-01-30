/**
 * Feature Flag Hydration
 *
 * Strategy:
 *  - Load cached flags instantly
 *  - Refresh remotely if online
 *  - Fail silent, default safe
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'feature_flags_v1';

export type FeatureFlags = {
  receiptsScanner: boolean;
  taxEngineV2: boolean;
  offlineInvoices: boolean;
};

let flags: FeatureFlags = {
  receiptsScanner: false,
  taxEngineV2: false,
  offlineInvoices: true,
};

export function getFeatureFlags(): FeatureFlags {
  return flags;
}

export async function hydrateFeatureFlags(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      flags = { ...flags, ...JSON.parse(cached) };
    }

    // Optional remote refresh
    // (safe to skip if offline or unauthenticated)
    // const remoteFlags = await fetchRemoteFlags();
    // flags = { ...flags, ...remoteFlags };
    // await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch (err) {
    console.warn('[FeatureFlags] Hydration failed:', err);
  }
}
