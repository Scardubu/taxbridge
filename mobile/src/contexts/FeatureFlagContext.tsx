/**
 * Feature Flag Context
 * 
 * Phase 3: Feature Flag System
 * 
 * Provides access to feature flags throughout the app.
 * Flags are hydrated once at boot (SplashScreen) and remain static.
 * 
 * Usage:
 *   const isEnabled = useFeatureFlag('receiptsScanner');
 *   if (isEnabled) { ... }
 * 
 * Rules:
 *   - NO network calls in components
 *   - Access ONLY via useFeatureFlag hook
 *   - Flags are read-only after hydration
 */

import React, { createContext, useContext } from 'react';
import { getFeatureFlags, FeatureFlags } from '../services/featureFlags';

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isEnabled: (key: keyof FeatureFlags) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const flags = getFeatureFlags();
  
  const contextValue: FeatureFlagContextValue = {
    flags,
    isEnabled: (key: keyof FeatureFlags) => flags[key],
  };
  
  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

/**
 * Primary hook for accessing individual feature flags
 * 
 * @param key - Feature flag key
 * @returns boolean - Flag state
 * 
 * @example
 * const receiptsScannerEnabled = useFeatureFlag('receiptsScanner');
 * if (receiptsScannerEnabled) {
 *   return <ReceiptScannerButton />;
 * }
 */
export function useFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlag must be used inside FeatureFlagProvider');
  }
  return context.flags[key];
}

/**
 * Advanced hook for accessing all flags at once
 * Use sparingly - prefer useFeatureFlag for single flags
 * 
 * @returns All feature flags
 * 
 * @example
 * const { receiptsScanner, taxEngineV2 } = useAllFeatureFlags();
 */
export function useAllFeatureFlags(): FeatureFlags {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useAllFeatureFlags must be used inside FeatureFlagProvider');
  }
  return context.flags;
}

/**
 * Development-only hook for checking if flag is enabled
 * Same as useFeatureFlag but with semantic naming
 */
export function useIsFeatureEnabled(key: keyof FeatureFlags): boolean {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useIsFeatureEnabled must be used inside FeatureFlagProvider');
  }
  return context.isEnabled(key);
}
