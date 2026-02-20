/**
 * useTheme — TaxBridge V3.0 Dark Mode Hook
 *
 * Returns the correct color palette, space, and radii tokens for the
 * current system colour scheme (light / dark). Drop-in replacement
 * for direct `colors` imports in screen components.
 *
 * Usage:
 *   const { colors, isDark } = useTheme();
 *   <View style={{ backgroundColor: colors.surface }} />
 *
 * Background:
 *   Wraps React Native's built-in `useColorScheme()`.  The result is
 *   memoized so re-renders only occur when the scheme actually changes.
 */

import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { colors as lightColors, spacing, radii } from '../theme/tokens';
import { darkColors } from '../theme/darkTokens';
import type { ColorTokens } from '../theme/darkTokens';

// Re-export so consumers can type-check against the canonical token set
export type { ColorTokens };

export interface ThemeContext {
  /** Active color tokens — automatically switches between light and dark */
  colors:  ColorTokens;
  /** True when the device is in dark mode */
  isDark:  boolean;
  /** Current scheme string */
  scheme:  'light' | 'dark';
  /** Spacing scale (same in both modes) */
  spacing: typeof spacing;
  /** Border radius scale (same in both modes) */
  radii:   typeof radii;
}

/**
 * Returns the theme context for the current colour scheme.
 * Memoised — reference-stable until the scheme changes.
 */
export function useTheme(): ThemeContext {
  const scheme = useColorScheme() ?? 'light';

  return useMemo<ThemeContext>(() => {
    const isDark = scheme === 'dark';
    return {
      colors:  isDark ? darkColors : lightColors,
      isDark,
      scheme,
      spacing,
      radii,
    };
  }, [scheme]);
}

/**
 * Convenience hook — returns just the active colors.
 * Saves a destructure when you only need colors.
 */
export function useColors(): ColorTokens {
  return useTheme().colors;
}
