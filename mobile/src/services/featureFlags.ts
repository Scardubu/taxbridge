/**
 * Feature Flag Hydration (alias module)
 *
 * Phase 3: Feature Flag System
 * Centralized exports for feature flag access.
 * 
 * Production exports:
 *  - getFeatureFlags(): Get all flags (sync)
 *  - hydrateFeatureFlags(): Load flags at boot (async)
 *  - FeatureFlags type
 * 
 * Development exports:
 *  - setFeatureFlagOverride(): Override individual flags
 *  - clearFeatureFlagOverrides(): Reset to defaults
 */

export { 
  getFeatureFlags, 
  hydrateFeatureFlags, 
  setFeatureFlagOverride,
  clearFeatureFlagOverrides,
  type FeatureFlags 
} from './featureFlag';

