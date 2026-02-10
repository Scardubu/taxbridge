/**
 * Compatibility tokens for Phase 9 screens.
 *
 * The canonical design system lives in ../theme/tokens. This module provides
 * a `tokens` object whose shape matches the imports used by the Payroll,
 * Compliance, Crypto, and Reconciliation screens (tokens.colors.neutral[N],
 * tokens.colors.white, tokens.colors.danger, tokens.radius.*, etc.).
 */

import {
  colors as themeColors,
  spacing,
  radii,
  shadows,
} from '../theme/tokens';

// Re-export everything from the canonical module so barrel imports still work.
export * from '../theme/tokens';

const neutral: Record<number, string> = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
};

export const tokens = {
  colors: {
    ...themeColors,
    neutral,
    white: '#FFFFFF',
    black: '#000000',
    danger: '#DC2626',
    primary: themeColors.primary,
    success: themeColors.success,
    warning: themeColors.warning,
    secondary: '#0EA5E9',
  },
  spacing,
  radius: {
    sm: radii.sm,
    md: radii.md,
    lg: radii.lg,
    xl: radii.xl,
    full: radii.full,
  },
  shadows,
};
