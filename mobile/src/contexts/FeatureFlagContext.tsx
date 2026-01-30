import React, { createContext, useContext } from 'react';
import { getFeatureFlags, FeatureFlags } from '../services/featureFlag';

const FeatureFlagContext = createContext<FeatureFlags | null>(null);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <FeatureFlagContext.Provider value={getFeatureFlags()}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export function useFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  const flags = useContext(FeatureFlagContext);
  if (!flags) {
    throw new Error('useFeatureFlag must be used inside FeatureFlagProvider');
  }
  return flags[key];
}
