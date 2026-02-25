/**
 * TaxBridge — ThemeContext
 * Makes dark mode tokens (defined in tokens.ts) actually functional (CF-04 fix)
 *
 * Constraint: All screens must use useTheme() — never import colors directly
 * Pattern: const { colors, isDark } = useTheme();
 *
 * Wrap in app/_layout.tsx BEFORE QueryClientProvider and i18n init
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

// Import base tokens — this file is the only place direct import is allowed
import { colors as baseColors, shadows } from '../design-system/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorSet = typeof baseColors;

export interface ThemeContextValue {
  isDark:  boolean;
  colors:  ColorSet;
  theme:   'light' | 'dark';
  shadows: typeof shadows;
  /** Force override — for user preference setting in ProfileScreen */
  setThemeOverride: (override: 'light' | 'dark' | 'system') => void;
  themeOverride:    'light' | 'dark' | 'system';
}

// ─── Defaults (light mode) ────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  isDark:           false,
  colors:           baseColors,
  theme:            'light',
  shadows,
  setThemeOverride: () => {},
  themeOverride:    'system',
});

// ─── Build active color set from system scheme ─────────────────────────────

function buildColors(isDark: boolean): ColorSet {
  if (!isDark) return baseColors;

  // Overlay dark values on top of base tokens
  // Only override surface/background/text — brand colors stay the same
  return {
    ...baseColors,

    // Surfaces
    surface:     baseColors.dark.surface,       // '#1E293B'
    surfaceAlt:  baseColors.dark.surfaceAlt,    // '#0F172A'
    surfaceCard: baseColors.dark.surfaceCard,   // '#1E293B'

    // Borders
    border:       baseColors.dark.border,       // '#334155'
    borderStrong: baseColors.dark.borderStrong, // '#475569'

    // Text
    textPrimary:   baseColors.dark.textPrimary,   // '#F8FAFC'
    textSecondary: baseColors.dark.textSecondary, // '#CBD5E1'
    textMuted:     baseColors.dark.textMuted,     // '#94A3B8'

    // Gray scale — remap 50 (page background) to dark background
    gray: {
      ...baseColors.gray,
      0:   baseColors.dark.surface,      // card surface
      50:  baseColors.dark.background,   // page background '#0F172A'
      100: '#1E293B',
      200: '#334155',
      300: '#475569',
    },
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeOverride, setThemeOverrideState] = useState<'light' | 'dark' | 'system'>('system');

  const setThemeOverride = useCallback((override: 'light' | 'dark' | 'system') => {
    setThemeOverrideState(override);
    // Optionally persist to SecureStore for next session:
    // SecureStore.setItemAsync('themeOverride', override).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (themeOverride === 'light') return false;
    if (themeOverride === 'dark')  return true;
    return systemScheme === 'dark';
  }, [themeOverride, systemScheme]);

  const activeColors = useMemo(() => buildColors(isDark), [isDark]);

  const value: ThemeContextValue = useMemo(() => ({
    isDark,
    colors:           activeColors,
    theme:            isDark ? 'dark' : 'light',
    shadows,
    setThemeOverride,
    themeOverride,
  }), [isDark, activeColors, setThemeOverride, themeOverride]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Primary hook — use in every screen and component */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Convenience hook — returns only isDark for StatusBar decisions */
export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark;
}

/** Convenience hook — returns only colors for inline styles */
export function useColors(): ColorSet {
  return useContext(ThemeContext).colors;
}

/*
 * Usage in app root layout (e.g. App.tsx or navigation root):
 *
 *   import { ThemeProvider } from './src/contexts/ThemeContext';
 *
 *   export default function App() {
 *     return (
 *       <ThemeProvider>
 *         <QueryClientProvider client={queryClient}>
 *           <I18nextProvider i18n={i18n}>
 *             <NavigationContainer>
 *               ...
 *             </NavigationContainer>
 *           </I18nextProvider>
 *         </QueryClientProvider>
 *       </ThemeProvider>
 *     );
 *   }
 */
