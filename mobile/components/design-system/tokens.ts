import { Platform, useColorScheme } from 'react-native';

export const palette = {
  nrsGreen: '#006B3F',
  nrsGreenDim: '#004D2D',
  nrsGold: '#FFD700',
  nrsRed: '#E8401C',
  shield: '#00C853',
  warning: '#FFB300',
  danger: '#D50000',
  pending: '#7C4DFF',
  white: '#FFFFFF',
  gray50: '#F5F7FA',
  gray100: '#E8EDF2',
  gray200: '#CBD5E0',
  gray400: '#8A9BB0',
  gray600: '#5A6A7A',
  gray900: '#1A1A2E',
  dark900: '#0D0D1A',
  dark800: '#1A1A2E',
  dark700: '#16213E',
  dark600: '#1E2D40',
} as const;

export function useTokens() {
  const isDark = useColorScheme() === 'dark';
  return {
    bg: isDark ? palette.dark900 : palette.white,
    bgCard: isDark ? palette.dark800 : palette.gray50,
    bgInput: isDark ? palette.dark700 : palette.gray50,
    textPrimary: isDark ? palette.white : palette.gray900,
    textSecondary: isDark ? palette.gray400 : palette.gray600,
    textMuted: isDark ? palette.gray600 : palette.gray400,
    border: isDark ? palette.dark600 : palette.gray100,
    brandPrimary: palette.nrsGreen,
    complianceShield: palette.shield,
    complianceWarning: palette.warning,
    complianceDanger: palette.danger,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  naira: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } }),
  md: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 4 } }),
  shield: Platform.select({ ios: { shadowColor: '#00C853', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16 }, android: { elevation: 8 } }),
} as const;

export const minTouchTarget = 48;
