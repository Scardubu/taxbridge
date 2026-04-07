import { Platform } from 'react-native';

export const Colors = {
  brand: {
    primary: '#1D9E75',
    primaryDark: '#0F6E56',
    primaryDim: '#0D2B22',
    border: '#085041',
    accent: '#34D399',
    badge: '#6EE7B7',
    badgeBg: '#064E3B',
  },
  status: {
    dangerBg: '#1C0A0A',
    dangerBorder: '#7C2D12',
    dangerText: '#FCA5A5',
    warningBg: '#1C1000',
    warningBorder: '#78350F',
    warningText: '#FCD34D',
    successBg: '#0D2B22',
    successBorder: '#065F46',
    successText: '#D1FAE5',
    neutralBg: '#1C1C1C',
    neutralText: '#9CA3AF',
  },
  ui: {
    bg: '#0A0A0A',
    surface: '#1C1C1C',
    surfaceAlt: '#161616',
    border: '#2A2A2A',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    textDim: '#6B7280',
    white: '#FFFFFF',
  },
  shield: {
    score100: '#1D9E75',
    score50: '#D97706',
    score20: '#DC2626',
    score0: '#374151',
  },
  receipt: {
    vatCredit: '#059669',
    vatCreditBg: '#022C22',
    unverified: '#B45309',
    unverifiedBg: '#1C1000',
    duplicate: '#9333EA',
    duplicateBg: '#1A0533',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const Typography = {
  headline: { fontSize: 38, fontWeight: '800' as const, lineHeight: 42 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  section: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  micro: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.8 },
  mono: { fontSize: 15, fontFamily: 'SpaceMono' as const, fontWeight: '400' as const },
  monoSm: { fontSize: 13, fontFamily: 'SpaceMono' as const, fontWeight: '400' as const },
} as const;

export const palette = {
  nrsGreen: Colors.brand.primary,
  nrsGreenDim: Colors.brand.primaryDim,
  nrsGreenLight: Colors.brand.accent,
  nrsGold: Colors.status.warningText,
  nrsRed: Colors.status.dangerText,
  shield: Colors.shield.score100,
  warning: Colors.shield.score50,
  danger: Colors.shield.score20,
  pending: Colors.shield.score0,
  white: Colors.ui.white,
  gray50: Colors.ui.surfaceAlt,
  gray100: Colors.ui.border,
  gray200: Colors.ui.border,
  gray400: Colors.ui.textMuted,
  gray600: Colors.ui.textDim,
  gray900: Colors.ui.text,
  dark900: Colors.ui.bg,
  dark800: Colors.ui.surface,
  dark700: Colors.ui.surfaceAlt,
  dark600: Colors.ui.border,
  blue50: Colors.brand.primaryDim,
  blue600: Colors.brand.primary,
  amber50: Colors.status.warningBg,
  amber600: Colors.status.warningText,
  red50: Colors.status.dangerBg,
} as const;

export const spacing = {
  xs: Spacing.xs,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
  xxl: Spacing.xxl,
} as const;

export const typography = {
  display: Typography.headline,
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: Typography.body,
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: Typography.caption,
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  naira: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  mono: Typography.mono,
  monoSm: Typography.monoSm,
} as const;

export const radius = {
  sm: Radii.sm,
  md: Radii.md,
  lg: Radii.lg,
  xl: Radii.xl,
  full: Radii.pill,
} as const;

export function useTokens() {
  return {
    bg: Colors.ui.bg,
    bgCard: Colors.ui.surface,
    bgInput: Colors.ui.surfaceAlt,
    textPrimary: Colors.ui.text,
    textSecondary: Colors.ui.textMuted,
    textMuted: Colors.ui.textDim,
    border: Colors.ui.border,
    brandPrimary: Colors.brand.primary,
    complianceShield: Colors.shield.score100,
    complianceWarning: Colors.shield.score50,
    complianceDanger: Colors.shield.score20,
  };
}

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: Colors.ui.bg,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: { elevation: 2 },
  }),
  md: Platform.select({
    ios: {
      shadowColor: Colors.ui.bg,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.24,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  shield: Platform.select({
    ios: {
      shadowColor: Colors.brand.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: { elevation: 8 },
  }),
} as const;

export const minTouchTarget = 48;
