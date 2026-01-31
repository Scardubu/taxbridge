/**
 * Feature Flag Hydration
 *
 * Phase 3: Feature Flag System
 * 
 * Strategy:
 *  1. Load defaults from environment (EXPO_PUBLIC_FEATURE_*)
 *  2. Load cached flags instantly (offline-first)
 *  3. Refresh remotely if online (optional)
 *  4. Support testing overrides
 *  5. Fail silent, default safe
 *
 * Required Flags:
 *  - receiptsScanner: Enable receipt scanning UI
 *  - taxEngineV2: Use new tax calculation engine
 *  - offlineInvoices: Allow invoice creation without network
 *
 * Access: ONLY via useFeatureFlag(key) hook
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const STORAGE_KEY = 'feature_flags_v1';
const CACHE_EXPIRY_MS = 3600000; // 1 hour
const REMOTE_TIMEOUT_MS = 5000;

export type FeatureFlags = {
  receiptsScanner: boolean;
  taxEngineV2: boolean;
  offlineInvoices: boolean;
  ocrScanner: boolean;
};

interface CachedFlags {
  flags: Partial<FeatureFlags>;
  timestamp: number;
}

/**
 * Get default flags from environment variables
 * Supports EXPO_PUBLIC_FEATURE_RECEIPTS_SCANNER, etc.
 */
function getEnvironmentDefaults(): Partial<FeatureFlags> {
  const env = Constants.expoConfig?.extra || {};
  
  return {
    receiptsScanner: env.FEATURE_RECEIPTS_SCANNER === 'true' || env.FEATURE_RECEIPTS_SCANNER === true,
    taxEngineV2: env.FEATURE_TAX_ENGINE_V2 === 'true' || env.FEATURE_TAX_ENGINE_V2 === true,
    offlineInvoices: env.FEATURE_OFFLINE_INVOICES === 'true' || env.FEATURE_OFFLINE_INVOICES === true,
    ocrScanner: env.FEATURE_OCR_SCANNER === 'true' || env.FEATURE_OCR_SCANNER === true,
  };
}

/**
 * Safe production defaults
 * Prioritizes stability and compliance
 */
const SAFE_DEFAULTS: FeatureFlags = {
  receiptsScanner: true,
  taxEngineV2: true,
  offlineInvoices: true,
  ocrScanner: false, // Requires ML model, disabled by default
};

// Merge environment defaults with safe defaults
let flags: FeatureFlags = {
  ...SAFE_DEFAULTS,
  ...getEnvironmentDefaults(),
};

/**
 * Get current feature flags (synchronous)
 * Used by FeatureFlagContext provider
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...flags };
}

/**
 * Check if cached flags are still valid
 */
function isCacheValid(cached: CachedFlags): boolean {
  return Date.now() - cached.timestamp < CACHE_EXPIRY_MS;
}

/**
 * Fetch feature flags from backend
 * Safe to fail - returns undefined on error
 */
async function fetchRemoteFlags(): Promise<Partial<FeatureFlags> | undefined> {
  const apiUrl = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
  
  if (!apiUrl) {
    return undefined;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);

    const response = await fetch(`${apiUrl}/api/v1/feature-flags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[FeatureFlags] Remote fetch failed:', response.status);
      return undefined;
    }

    const data = await response.json();
    return data.flags as Partial<FeatureFlags>;
  } catch (err) {
    // Network errors, timeouts, aborts are all safe to ignore
    if ((err as Error).name !== 'AbortError') {
      console.warn('[FeatureFlags] Remote fetch error:', err);
    }
    return undefined;
  }
}

/**
 * Hydrate feature flags at boot (called from SplashScreen)
 * 
 * Execution order:
 * 1. Load from cache (instant)
 * 2. Try remote refresh (optional, non-blocking)
 * 3. Update cache if remote succeeded
 */
export async function hydrateFeatureFlags(): Promise<void> {
  try {
    // Step 1: Load cached flags (offline-first)
    const cachedData = await AsyncStorage.getItem(STORAGE_KEY);
    if (cachedData) {
      const cached: CachedFlags = JSON.parse(cachedData);
      if (isCacheValid(cached)) {
        flags = { ...flags, ...cached.flags };
      }
    }

    // Step 2: Try remote refresh (safe to fail)
    const remoteFlags = await fetchRemoteFlags();
    if (remoteFlags) {
      flags = { ...flags, ...remoteFlags };
      
      // Step 3: Update cache with fresh remote data
      const cacheData: CachedFlags = {
        flags: remoteFlags,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    }
  } catch (err) {
    // All failures are silent - flags default to safe values
    console.warn('[FeatureFlags] Hydration failed (non-fatal):', err);
  }
}

/**
 * Override flags for testing/debugging
 * Only available in development mode
 */
export async function setFeatureFlagOverride(
  key: keyof FeatureFlags,
  value: boolean
): Promise<void> {
  if (__DEV__) {
    flags = { ...flags, [key]: value };
    
    // Persist override to cache
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    const cacheData: CachedFlags = cached
      ? JSON.parse(cached)
      : { flags: {}, timestamp: Date.now() };
    
    cacheData.flags[key] = value;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    
    console.log(`[FeatureFlags] Override set: ${key} = ${value}`);
  } else {
    console.warn('[FeatureFlags] Overrides only available in development');
  }
}

/**
 * Clear all flag overrides (reset to defaults)
 * Only available in development mode
 */
export async function clearFeatureFlagOverrides(): Promise<void> {
  if (__DEV__) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    flags = { ...SAFE_DEFAULTS, ...getEnvironmentDefaults() };
    console.log('[FeatureFlags] Overrides cleared, reset to defaults');
  }
}
