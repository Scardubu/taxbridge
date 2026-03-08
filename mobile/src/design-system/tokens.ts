/**
 * TaxBridge Design System — Token Foundation
 * Production-grade Nigerian fintech design tokens
 * Surpasses Taxumo/QuickBooks in visual clarity and trust
 */

import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color System ─────────────────────────────────────────────────────────────
// Nigerian-validated palette: trust (green), warmth (amber), urgency (red)

export const colors = {
  // Brand — Nigerian flag green family
  primary: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',  // Core brand — Naira green
    600: '#059669',  // Nigerian flag accent (darker)
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Accent — Nigerian sunset amber
  accent: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',  // Core accent
    600: '#D97706',
    700: '#B45309',
  },

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // Error family
  red: {
    50:  '#FEF2F2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  // Neutral — Gray scale
  gray: {
    0:   '#FFFFFF',
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },

  // Trust indicators — financial-grade visual signals
  trust: {
    verified:  '#059669',  // NRS stamp green
    pending:   '#F59E0B',  // Amber — awaiting
    failed:    '#EF4444',  // Red — action needed
    encrypted: '#3B82F6',  // Blue — secure
  },

  // Surface
  surface:       '#FFFFFF',
  surfaceAlt:    '#F9FAFB',
  surfaceRaised: '#FFFFFF',
  border:        '#E5E7EB',
  borderStrong:  '#D1D5DB',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#374151',
  textMuted:     '#6B7280',
  textDisabled:  '#9CA3AF',
  textInverse:   '#FFFFFF',
  textLink:      '#059669',

  // Dark mode surfaces
  dark: {
    background:  '#0F172A',
    surface:     '#1E293B',
    surfaceAlt:  '#0F172A',
    surfaceCard: '#1E293B',
    border:      '#334155',
    borderStrong:'#475569',
    textPrimary: '#F8FAFC',
    textSecondary:'#CBD5E1',
    textMuted:   '#94A3B8',
  },

  // Nigerian context
  naira:       '#059669',  // ₦ symbol color
  nrsStamp:    '#059669',  // E-invoice stamp
  overdue:     '#DC2626',
  deadline:    '#D97706',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
// Optimised for Inter + Nigerian Pidgin readability on low-cost Android

export const typography = {
  // Font families
  families: {
    sans:  Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
    mono:  Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    // For amounts — monospace ensures digit alignment (critical for financial UI)
    amount: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
  },

  // Scale — Major Third (1.25) modular scale
  sizes: {
    xs:   11,
    sm:   13,
    base: 15,  // Slightly larger than 14 — better for low-DPI Android screens
    md:   16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
    '5xl': 42,
    display: 52,
  },

  // Weights
  weights: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  lineHeights: {
    none:     1,
    tight:    1.2,
    snug:     1.375,
    normal:   1.5,
    relaxed:  1.625,
    loose:    2,
  },

  // Letter spacing
  letterSpacing: {
    tighter: -0.5,
    tight:   -0.25,
    normal:  0,
    wide:    0.25,
    wider:   0.5,
    widest:  1,
    caps:    1.5,  // For labels, status badges
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// 4px base grid — every value is a multiple of 4

export const spacing = {
  0:    0,
  px:   1,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
  28:   112,
  32:   128,

  // Named aliases for readability
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  '2xl': 48,
  '3xl': 64,

  // Screen-responsive
  screenPadding:       16,
  screenPaddingLarge:  24,
  cardPadding:         16,
  sectionSpacing:      24,
  listItemSpacing:     12,
  inputHeight:         52,  // Touch-friendly: larger than 44px WCAG minimum
  buttonHeight:        52,
  tabBarHeight:        Platform.select({ ios: 82, android: 64, default: 64 }),
  headerHeight:        Platform.select({ ios: 96, android: 64, default: 64 }),
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radii = {
  none:   0,
  xs:     4,
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  '2xl':  24,
  '3xl':  32,
  full:   9999,

  // Component-specific
  button:  12,
  card:    16,
  input:   12,
  badge:   20,
  chip:    8,
  modal:   20,
  sheet:   20,
  avatar:  9999,
  image:   12,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
// Uses both iOS shadow + Android elevation + React Native Web boxShadow

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  // Trust card — green tint for compliance/verified states
  trust: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  // Error card — red tint for warnings
  danger: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const animation = {
  // Durations (ms)
  duration: {
    instant:   50,
    fast:      150,
    normal:    250,
    slow:      400,
    slower:    600,
    skeleton:  1000,
  },

  // Spring configs for Reanimated 4
  spring: {
    button: { damping: 15, stiffness: 300, mass: 0.8 },
    card:   { damping: 20, stiffness: 200, mass: 1 },
    modal:  { damping: 25, stiffness: 150, mass: 1.2 },
    bounce: { damping: 10, stiffness: 300, mass: 0.6 },
  },

  // Timing configs
  easing: {
    standard:   'easeInOut',
    enter:      'easeOut',
    exit:       'easeIn',
    spring:     'spring',
  },
} as const;

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export const breakpoints = {
  phone:  0,
  tablet: 768,
} as const;

export const isTablet = SCREEN_WIDTH >= breakpoints.tablet;

// ─── Z-Index ──────────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  dropdown:20,
  sticky:  30,
  overlay: 40,
  modal:   50,
  toast:   60,
  tooltip: 70,
} as const;

// ─── Opacity ──────────────────────────────────────────────────────────────────

export const opacity = {
  disabled:  0.4,
  muted:     0.6,
  overlay:   0.5,
  scrim:     0.8,
} as const;

// ─── Compound Theme ───────────────────────────────────────────────────────────

export const theme = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  animation,
  breakpoints,
  zIndex,
  opacity,
} as const;

export type Theme = typeof theme;
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;

// ─── Uppercase Aliases (backward compatibility) ──────────────────────────────
export const COLORS = colors;
export const TYPOGRAPHY = typography;
export const SPACING = spacing;
export const RADIUS = radii;

// ─── Dark Mode Theme ──────────────────────────────────────────────────────────

export const darkTheme: Partial<Theme> = {
  colors: {
    ...colors,
    surface:       colors.dark.surface,
    surfaceAlt:    colors.dark.surfaceAlt,
    surfaceRaised: colors.dark.surfaceCard,
    border:        colors.dark.border,
    borderStrong:  colors.dark.borderStrong,
    textPrimary:   colors.dark.textPrimary,
    textSecondary: colors.dark.textSecondary,
    textMuted:     colors.dark.textMuted,
  } as unknown as typeof colors,
};
