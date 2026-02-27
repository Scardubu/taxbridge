/**
 * TaxBridge Dark Mode Color Tokens — V3.0
 *
 * Every key matches the light `colors` object exported from `tokens.ts`.
 * Type is inferred as `typeof import('./tokens').colors` so any missing
 * key will surface as a compile error.
 */

import { colors as light } from './tokens';

// A writable string-valued mirror of the light token keys.
// Using `{ [K in keyof typeof light]: string }` lets dark values differ
// from the literal hex strings that `as const` produces on the light object.
export type ColorTokens = { [K in keyof typeof light]: string };

/**
 * Dark-mode overrides.  Every key present in `light` must appear here.
 * Keys that are identical in both modes still need to be listed so the
 * object satisfies `ColorTokens`.
 */
export const darkColors: ColorTokens = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary:             '#3B82F6',   // brighter blue on dark canvas
  primaryDark:         '#2563EB',
  primaryDeep:         '#1E3A5F',
  primaryLight:        '#1E3A5F',
  primaryBorder:       '#1D4ED8',
  primaryBgSubtle:     '#1E2D4A',

  // Brand Extended
  brandBlue50:         '#1E2D4A',
  brandBlue100:        '#1E3153',
  brandBlue500:        '#3B82F6',
  brandBlue600:        '#2563EB',
  brandGreen400:       '#4ADE80',
  brandGreen600:       '#22C55E',
  brandNavy900:        '#071E2F',
  brandIndigo:         '#818CF8',
  brandIndigoBg:       '#1E1B4B',
  brandIndigoBorder:   '#312E81',

  // ── Surfaces ───────────────────────────────────────────────────────────
  surface:             '#121212',
  surfaceMuted:        '#1C1C1E',
  surfaceSecondary:    '#2C2C2E',
  surfaceSlate:        '#1A1A2E',
  surfaceDark:         '#000000',
  surfaceOverlay:      'rgba(0, 0, 0, 0.7)',

  // ── Borders ────────────────────────────────────────────────────────────
  border:              '#374151',
  borderSubtle:        '#1F2937',
  borderTransparent:   'rgba(255, 255, 255, 0.06)',
  borderStrong:        '#6B7280',

  // ── Text ───────────────────────────────────────────────────────────────
  textPrimary:         '#F9FAFB',
  textSecondary:       '#E5E7EB',
  textTertiary:        '#D1D5DB',
  textMuted:           '#9CA3AF',
  textDisabled:        '#6B7280',
  textOnPrimary:       '#FFFFFF',
  textOnPrimaryStrong: 'rgba(255, 255, 255, 0.97)',
  textOnPrimaryMuted:  'rgba(255, 255, 255, 0.85)',
  textOnPrimarySubtle: 'rgba(255, 255, 255, 0.75)',

  // ── Status: Success ────────────────────────────────────────────────────
  success:             '#34D399',
  successDark:         '#065F46',
  successBg:           '#064E3B',
  successBgSubtle:     '#022C22',
  successBorder:       '#065F46',

  // ── Status: Warning ────────────────────────────────────────────────────
  warning:             '#FCD34D',
  warningDark:         '#92400E',
  warningBg:           '#451A03',
  warningBgLight:      '#3B1800',
  warningBgSubtle:     '#3B1800',
  warningBorder:       '#78350F',

  // ── Status: Error ──────────────────────────────────────────────────────
  error:               '#F87171',
  errorDark:           '#991B1B',
  errorLight:          '#450A0A',
  errorBg:             '#450A0A',
  errorBgSubtle:       '#3B0808',
  errorBorder:         '#7F1D1D',

  // ── Status: Info ───────────────────────────────────────────────────────
  info:                '#60A5FA',
  infoDark:            '#1E3A8A',
  infoBg:              '#1E3A8A',
  infoBgSubtle:        '#172554',
  infoBorder:          '#1E40AF',
  infoText:            '#93C5FD',

  // ── Disabled / Muted ───────────────────────────────────────────────────
  disabled:            '#4B5563',

  // ── Neutral ────────────────────────────────────────────────────────────
  neutral:             '#4B5563',
  neutralDark:         '#9CA3AF',
  neutralBg:           '#1F2937',
  neutralBgSubtle:     '#1F2937',
  neutralLight:        '#374151',
  neutralBorder:       '#374151',
  neutralText:         '#9CA3AF',

  // ── Tip ────────────────────────────────────────────────────────────────
  tipBg:               '#3B1F00',
  tipBorder:           '#78350F',
  tipText:             '#FDE68A',

  // ── NTA Colors ─────────────────────────────────────────────────────────
  ntaExemption:        '#34D399',
  ntaExemptionLight:   '#064E3B',
  ntaStandard:         '#60A5FA',
  ntaStandardLight:    '#1E3A8A',
  ntaAlert:            '#FCD34D',
  ntaAlertLight:       '#451A03',
  ntaSurcharge:        '#F87171',
  ntaSurchargeLight:   '#450A0A',
  ntaCompliance:       '#22D3EE',
  ntaComplianceLight:  '#0E7490',
  ntaSuccess:          '#4ADE80',
  ntaSuccessLight:     '#14532D',

  // ── Action Colors ──────────────────────────────────────────────────────
  actionGreen:         '#34D399',
  actionGreenBg:       '#064E3B',
  actionPurple:        '#A78BFA',
  actionPurpleBg:      '#2E1065',
  actionPurpleBorder:  '#4C1D95',
  actionOrange:        '#FB923C',
  actionOrangeBg:      '#431407',
  actionOrangeAccent:  '#F97316',
  actionOrangeBorder:  '#7C2D12',

  // ── Overlays ───────────────────────────────────────────────────────────
  overlaySuccess:      'rgba(52, 211, 153, 0.2)',
  overlayWarning:      'rgba(252, 211, 77, 0.2)',
  overlayLight:        'rgba(255, 255, 255, 0.08)',
  overlayLightBorder:  'rgba(255, 255, 255, 0.15)',
  overlayLightStrong:  'rgba(255, 255, 255, 0.12)',
  overlayLightSubtle:  'rgba(255, 255, 255, 0.06)',
  overlayDark:         'rgba(0, 0, 0, 0.85)',
  overlayDarkStrong:   'rgba(0, 0, 0, 0.90)',
  overlayMedium:       'rgba(0, 0, 0, 0.55)',

  // ── Header Gradients ───────────────────────────────────────────────────
  headerGradientStart: 'rgba(52, 211, 153, 0.12)',
  headerGradientMid:   'rgba(59, 130, 246, 0.16)',
  headerGradientEnd:   'rgba(59, 130, 246, 0.08)',
  headerArcStroke:     '#1E40AF',
  headerGridStroke:    '#1F2937',

  // ── Indigo Aliases ─────────────────────────────────────────────────────
  indigo:              '#818CF8',
  indigoBg:            '#1E1B4B',
  indigoBorder:        '#312E81',

  // ── Shadows (semi-transparent, scheme-agnostic) ───────────────────────
  shadowPrimary:       '#3B82F6',
  shadowHeader:        'rgba(0, 0, 0, 0.25)',
  shadowChip:          'rgba(0, 0, 0, 0.20)',
} as const satisfies ColorTokens;
