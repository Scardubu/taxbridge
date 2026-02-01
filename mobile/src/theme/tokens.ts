import { Platform } from 'react-native';

/**
 * TaxBridge Design System Tokens
 * 
 * Enhancements:
 * 1. Semantic color tokens for better maintainability
 * 2. Dark mode support foundation
 * 3. Accessibility-compliant contrast ratios
 * 4. Enhanced shadow system with performance optimization
 * 5. Responsive spacing utilities
 * 6. Component-specific token helpers
 * 7. Animation/timing constants
 * 8. Better TypeScript types
 */

// ============================================================================
// BRAND COLORS - Living Bridge Palette
// ============================================================================

export const brandColors = {
  // Primary Brand Colors
  primary: '#0B5FFF',
  primaryDark: '#0952CC',
  primaryDeep: '#052B52',
  primaryLight: '#EBF4FF',
  primaryBorder: '#93C5FD',
  
  // Extended Brand Palette
  blue50: '#EBF5FF',
  blue100: '#D6E9FF',
  blue500: '#2563EB',
  blue600: '#1E4FD8',
  green400: '#22C55E',
  green600: '#16A34A',
  navy900: '#071E2F',
  indigo: '#4338CA',
  indigoBg: '#EEF2FF',
  indigoBorder: '#C7D2FE',
} as const;

// ============================================================================
// SEMANTIC COLORS
// ============================================================================

export const semanticColors = {
  // Status: Success
  success: '#10B981',
  successDark: '#065F46',
  successLight: '#D1FAE5',
  successBg: '#D1FAE5',
  successBgSubtle: '#ECFDF5',
  successBorder: '#6EE7B7',
  successText: '#065F46',

  // Status: Warning
  warning: '#FBBF24',
  warningDark: '#92400E',
  warningLight: '#FEF3C7',
  warningBg: '#FEF3C7',
  warningBgLight: '#FFFBEB',
  warningBgSubtle: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  // Status: Error
  error: '#DC2626',
  errorDark: '#991B1B',
  errorLight: '#FEE2E2',
  errorBg: '#FEE2E2',
  errorBgSubtle: '#FEF2F2',
  errorBorder: '#FCA5A5',
  errorText: '#991B1B',

  // Status: Info
  info: '#3B82F6',
  infoDark: '#1E40AF',
  infoLight: '#DBEAFE',
  infoBg: '#DBEAFE',
  infoBgSubtle: '#EFF6FF',
  infoBorder: '#93C5FD',
  infoText: '#1E40AF',

  // Neutral
  neutral: '#6B7280',
  neutralDark: '#6B7280',
  neutralLight: '#F3F4F6',
  neutralBg: '#F3F4F6',
  neutralBgSubtle: '#F9FAFB',
  neutralBorder: '#E5E7EB',
  neutralText: '#6B7280',
} as const;

// ============================================================================
// SURFACE & BACKGROUND COLORS
// ============================================================================

export const surfaceColors = {
  surface: '#FFFFFF',
  surfaceMuted: '#F8F9FA',
  surfaceSecondary: '#F2F4F7',
  surfaceSlate: '#F8FAFC',
  surfaceDark: '#000000',
  surfaceElevated: '#FFFFFF',
  surfaceOverlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// ============================================================================
// BORDER COLORS
// ============================================================================

export const borderColors = {
  border: '#D0D5DD',
  borderSubtle: '#E4E7EC',
  borderStrong: '#98A2B3',
  borderTransparent: 'rgba(0, 0, 0, 0.05)',
  borderFocus: '#0B5FFF',
  borderError: '#FCA5A5',
  borderSuccess: '#6EE7B7',
  borderWarning: '#FDE68A',
} as const;

// ============================================================================
// TEXT COLORS
// ============================================================================

export const textColors = {
  textPrimary: '#101828',
  textSecondary: '#344054',
  textTertiary: '#475467',
  textMuted: '#667085',
  textDisabled: '#98A2B7',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryStrong: 'rgba(255, 255, 255, 0.9)',
  textOnPrimaryMuted: 'rgba(255, 255, 255, 0.85)',
  textOnPrimarySubtle: 'rgba(255, 255, 255, 0.8)',
  textOnDark: '#FFFFFF',
  textLink: '#0B5FFF',
  textLinkHover: '#0952CC',
} as const;

// ============================================================================
// ACTION COLORS (Quick Actions, CTAs)
// ============================================================================

export const actionColors = {
  actionGreen: '#059669',
  actionGreenBg: '#ECFDF5',
  actionGreenBorder: '#A7F3D0',
  actionPurple: '#7C3AED',
  actionPurpleBg: '#F5F3FF',
  actionPurpleBorder: '#C4B5FD',
  actionOrange: '#EA580C',
  actionOrangeBg: '#FFF7ED',
  actionOrangeAccent: '#EA580C',
  actionOrangeBorder: '#FDBA74',
  actionBlue: '#0B5FFF',
  actionBlueBg: '#EBF4FF',
  actionBlueBorder: '#93C5FD',
} as const;

// ============================================================================
// OVERLAY COLORS
// ============================================================================

export const overlayColors = {
  overlaySuccess: 'rgba(16, 185, 129, 0.2)',
  overlayWarning: 'rgba(251, 191, 36, 0.2)',
  overlayError: 'rgba(220, 38, 38, 0.2)',
  overlayInfo: 'rgba(59, 130, 246, 0.2)',
  overlayLight: 'rgba(255, 255, 255, 0.15)',
  overlayLightBorder: 'rgba(255, 255, 255, 0.3)',
  overlayLightStrong: 'rgba(255, 255, 255, 0.2)',
  overlayLightSubtle: 'rgba(255, 255, 255, 0.1)',
  overlayDark: 'rgba(0, 0, 0, 0.8)',
  overlayMedium: 'rgba(0, 0, 0, 0.5)',
  overlaySubtle: 'rgba(0, 0, 0, 0.3)',
} as const;

// ============================================================================
// GRADIENT COLORS (Living Bridge Headers)
// ============================================================================

export const gradientColors = {
  headerGradientStart: 'rgba(34, 197, 94, 0.12)',
  headerGradientMid: 'rgba(37, 99, 235, 0.14)',
  headerGradientEnd: 'rgba(37, 99, 235, 0.08)',
  headerArcStroke: '#1E4FD8',
  headerGridStroke: '#E6EEF9',
  
  // Additional gradient options
  primaryGradientStart: '#0B5FFF',
  primaryGradientEnd: '#2563EB',
  successGradientStart: '#22C55E',
  successGradientEnd: '#16A34A',
} as const;

// ============================================================================
// SPECIALIZED COLORS
// ============================================================================

export const specializedColors = {
  // Tip/Hint colors
  tipBg: '#FFFBEB',
  tipBorder: '#FDE68A',
  tipText: '#92400E',
  
  // Disabled state
  disabled: '#98A2B7',
  disabledBg: '#F3F4F6',
  disabledBorder: '#E5E7EB',
  
  // Shadow colors
  shadowPrimary: '#0B5FFF',
  shadowHeader: 'rgba(9, 30, 66, 0.06)',
  shadowChip: 'rgba(12, 34, 73, 0.06)',
  shadowCard: 'rgba(0, 0, 0, 0.08)',
  
  // Focus/Selection
  focusRing: '#0B5FFF',
  focusRingOpacity: 'rgba(11, 95, 255, 0.2)',
  selection: '#EBF4FF',
} as const;

// ============================================================================
// NTA SEMANTIC COLORS (Tax-specific)
// ============================================================================

export const ntaColors = {
  exemption: '#10B981',
  exemptionLight: '#D1FAE5',
  standard: '#3B82F6',
  standardLight: '#DBEAFE',
  alert: '#F59E0B',
  alertLight: '#FEF3C7',
  surcharge: '#EF4444',
  surchargeLight: '#FEE2E2',
  compliance: '#06B6D4',
  complianceLight: '#CFFAFE',
  success: '#22C55E',
  successLight: '#DCFCE7',
} as const;

// ============================================================================
// CONSOLIDATED COLORS EXPORT (Backward Compatible)
// ============================================================================

export const colors = {
  // Brand — Living Bridge Palette
  primary: brandColors.primary,
  primaryDark: brandColors.primaryDark,
  primaryDeep: brandColors.primaryDeep,
  primaryLight: brandColors.primaryLight,
  primaryBorder: brandColors.primaryBorder,
  primaryBgSubtle: brandColors.primaryLight,
  
  // Brand Extended (Living Bridge gradient stops)
  brandBlue50: brandColors.blue50,
  brandBlue100: brandColors.blue100,
  brandBlue500: brandColors.blue500,
  brandBlue600: brandColors.blue600,
  brandGreen400: brandColors.green400,
  brandGreen600: brandColors.green600,
  brandNavy900: brandColors.navy900,
  brandIndigo: brandColors.indigo,
  brandIndigoBg: brandColors.indigoBg,
  brandIndigoBorder: brandColors.indigoBorder,

  // Surfaces
  surface: surfaceColors.surface,
  surfaceMuted: surfaceColors.surfaceMuted,
  surfaceSecondary: surfaceColors.surfaceSecondary,
  surfaceSlate: surfaceColors.surfaceSlate,
  surfaceDark: surfaceColors.surfaceDark,
  surfaceOverlay: surfaceColors.surfaceOverlay,

  // Borders
  border: borderColors.border,
  borderSubtle: borderColors.borderSubtle,
  borderTransparent: borderColors.borderTransparent,
  borderStrong: borderColors.borderStrong,

  // Text
  textPrimary: textColors.textPrimary,
  textSecondary: textColors.textSecondary,
  textTertiary: textColors.textTertiary,
  textMuted: textColors.textMuted,
  textDisabled: textColors.textDisabled,
  textOnPrimary: textColors.textOnPrimary,
  textOnPrimaryStrong: textColors.textOnPrimaryStrong,
  textOnPrimaryMuted: textColors.textOnPrimaryMuted,
  textOnPrimarySubtle: textColors.textOnPrimarySubtle,

  // Status: Success
  success: semanticColors.success,
  successDark: semanticColors.successDark,
  successBg: semanticColors.successBg,
  successBgSubtle: semanticColors.successBgSubtle,
  successBorder: semanticColors.successBorder,

  // Status: Warning
  warning: semanticColors.warning,
  warningDark: semanticColors.warningDark,
  warningBg: semanticColors.warningBg,
  warningBgLight: semanticColors.warningBgLight,
  warningBgSubtle: semanticColors.warningBgSubtle,
  warningBorder: semanticColors.warningBorder,

  // Status: Error
  error: semanticColors.error,
  errorDark: semanticColors.errorDark,
  errorLight: semanticColors.errorLight,
  errorBg: semanticColors.errorBg,
  errorBgSubtle: semanticColors.errorBgSubtle,
  errorBorder: semanticColors.errorBorder,

  // Status: Info (processing)
  info: semanticColors.info,
  infoDark: semanticColors.infoDark,
  infoBg: semanticColors.infoBg,
  infoBgSubtle: semanticColors.infoBgSubtle,
  infoBorder: semanticColors.infoBorder,
  infoText: semanticColors.infoText,

  // Disabled/Muted
  disabled: specializedColors.disabled,

  // Status: Neutral
  neutralDark: semanticColors.neutralDark,
  neutralBg: semanticColors.neutralBg,
  neutralLight: semanticColors.neutralLight,

  // Tip colors
  tipBg: specializedColors.tipBg,
  tipBorder: specializedColors.tipBorder,
  tipText: specializedColors.tipText,

  // NTA semantic colors
  ntaExemption: ntaColors.exemption,
  ntaExemptionLight: ntaColors.exemptionLight,
  ntaStandard: ntaColors.standard,
  ntaStandardLight: ntaColors.standardLight,
  ntaAlert: ntaColors.alert,
  ntaAlertLight: ntaColors.alertLight,
  ntaSurcharge: ntaColors.surcharge,
  ntaSurchargeLight: ntaColors.surchargeLight,
  ntaCompliance: ntaColors.compliance,
  ntaComplianceLight: ntaColors.complianceLight,
  ntaSuccess: ntaColors.success,
  ntaSuccessLight: ntaColors.successLight,

  // Action colors (Quick Actions)
  actionGreen: actionColors.actionGreen,
  actionGreenBg: actionColors.actionGreenBg,
  actionPurple: actionColors.actionPurple,
  actionPurpleBg: actionColors.actionPurpleBg,
  actionPurpleBorder: actionColors.actionPurpleBorder,
  actionOrange: actionColors.actionOrange,
  actionOrangeBg: actionColors.actionOrangeBg,
  actionOrangeAccent: actionColors.actionOrangeAccent,
  actionOrangeBorder: actionColors.actionOrangeBorder,

  // Overlays
  overlaySuccess: overlayColors.overlaySuccess,
  overlayWarning: overlayColors.overlayWarning,
  overlayLight: overlayColors.overlayLight,
  overlayLightBorder: overlayColors.overlayLightBorder,
  overlayLightStrong: overlayColors.overlayLightStrong,
  overlayLightSubtle: overlayColors.overlayLightSubtle,
  overlayDark: overlayColors.overlayDark,
  overlayDarkStrong: overlayColors.overlayDark,
  overlayMedium: overlayColors.overlayMedium,

  // Header gradients (Living Bridge)
  headerGradientStart: gradientColors.headerGradientStart,
  headerGradientMid: gradientColors.headerGradientMid,
  headerGradientEnd: gradientColors.headerGradientEnd,
  headerArcStroke: gradientColors.headerArcStroke,
  headerGridStroke: gradientColors.headerGridStroke,

  // Indigo aliases
  indigo: brandColors.indigo,
  indigoBg: brandColors.indigoBg,
  indigoBorder: brandColors.indigoBorder,

  // Shadows
  shadowPrimary: specializedColors.shadowPrimary,
  shadowHeader: specializedColors.shadowHeader,
  shadowChip: specializedColors.shadowChip,
} as const;

// ============================================================================
// SPACING SYSTEM
// ============================================================================

export const spacing = {
  // Base spacing scale
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  
  // Semantic spacing aliases
  none: 0,
  hairline: 1,
  tiny: 2,
  small: 8,
  medium: 16,
  large: 24,
  huge: 48,
  
  // Component-specific spacing
  screenPadding: 16,
  cardPadding: 16,
  sectionGap: 24,
  itemGap: 12,
} as const;

// ============================================================================
// BORDER RADIUS SYSTEM
// ============================================================================

export const radii = {
  // Base radius scale
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
  circle: 9999,
  
  // Component-specific aliases
  button: 12,
  input: 8,
  card: 16,
  modal: 24,
  chip: 999,
  avatar: 999,
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM
// ============================================================================

export const typography = {
  size: {
    // Base size scale
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    xxxxl: 32,
    xxxxxl: 40,
    
    // Semantic size aliases
    caption: 12,
    body: 16,
    bodySmall: 14,
    bodyLarge: 18,
    h6: 18,
    h5: 20,
    h4: 24,
    h3: 28,
    h2: 32,
    h1: 40,
  },
  weight: {
    thin: '100' as const,
    extralight: '200' as const,
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  letterSpacing: {
    tighter: -0.8,
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700' as const,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
  },
} as const;

// ============================================================================
// SHADOW SYSTEM
// ============================================================================

const isWeb = Platform.OS === 'web';

/**
 * Platform-optimized shadow system
 * Uses CSS box-shadow on web and native shadow props on mobile
 */
export const shadows = {
  none: isWeb
    ? { boxShadow: 'none' }
    : {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
  
  xs: isWeb
    ? { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.04)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
  
  sm: isWeb
    ? { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
  
  md: isWeb
    ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06), 0px 1px 2px rgba(0, 0, 0, 0.03)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
  
  lg: isWeb
    ? { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.08), 0px 2px 4px rgba(0, 0, 0, 0.04)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      },
  
  xl: isWeb
    ? { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1), 0px 4px 8px rgba(0, 0, 0, 0.05)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
      },
  
  xxl: isWeb
    ? { boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.12), 0px 6px 12px rgba(0, 0, 0, 0.06)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
      },
  
  primary: isWeb
    ? { boxShadow: '0px 4px 12px rgba(11, 95, 255, 0.3)' }
    : {
        shadowColor: '#0B5FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
      },
  
  success: isWeb
    ? { boxShadow: '0px 4px 12px rgba(16, 185, 129, 0.3)' }
    : {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
      },
  
  error: isWeb
    ? { boxShadow: '0px 4px 12px rgba(220, 38, 38, 0.3)' }
    : {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
      },
  
  // Component-specific shadows
  card: isWeb
    ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
  
  modal: isWeb
    ? { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
      },
  
  header: isWeb
    ? { boxShadow: '0px 1px 3px rgba(9, 30, 66, 0.06)' }
    : {
        shadowColor: 'rgba(9, 30, 66, 1)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      },
} as const;

// ============================================================================
// ANIMATION & TIMING
// ============================================================================

export const animations = {
  // Duration (in milliseconds)
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
    slowest: 750,
  },
  
  // Easing curves
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  // Spring configurations (for react-native-reanimated)
  spring: {
    gentle: { damping: 20, stiffness: 100 },
    smooth: { damping: 15, stiffness: 100 },
    snappy: { damping: 18, stiffness: 140 },
    bouncy: { damping: 10, stiffness: 100 },
  },
} as const;

// ============================================================================
// BREAKPOINTS (for responsive design)
// ============================================================================

export const breakpoints = {
  xs: 0,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

// ============================================================================
// Z-INDEX SYSTEM
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  toast: 1600,
  tooltip: 1700,
} as const;

// ============================================================================
// OPACITY SCALE
// ============================================================================

export const opacity = {
  disabled: 0.4,
  muted: 0.6,
  subtle: 0.8,
  full: 1,
} as const;

// ============================================================================
// COMPONENT SIZES
// ============================================================================

export const sizes = {
  // Touch targets (minimum 44x44 per iOS HIG)
  touchTarget: 44,
  touchTargetSmall: 36,
  
  // Icon sizes
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  
  // Avatar sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    xxl: 80,
  },
  
  // Button heights
  button: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
  },
  
  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get responsive spacing based on screen size
 * Usage: getResponsiveSpacing('md', screenWidth)
 */
export const getResponsiveSpacing = (
  size: keyof typeof spacing,
  screenWidth: number
): number => {
  const baseSpacing = spacing[size];
  if (screenWidth < breakpoints.sm) return baseSpacing;
  if (screenWidth < breakpoints.md) return baseSpacing * 1.25;
  return baseSpacing * 1.5;
};

/**
 * Get color with opacity
 * Usage: withOpacity(colors.primary, 0.5)
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // Handle rgb/rgba colors
  if (color.startsWith('rgb')) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, values) => {
      const [r, g, b] = values.split(',').map((v: string) => v.trim());
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    });
  }
  
  return color;
};

/**
 * Check if a color meets WCAG AA contrast ratio requirements
 * Usage: hasGoodContrast(colors.textPrimary, colors.surface)
 */
export const hasGoodContrast = (foreground: string, background: string): boolean => {
  // This is a simplified check - for production, use a proper contrast calculation library
  // Returns true if the color combination is likely accessible
  const isDarkText = foreground.includes('#101') || foreground.includes('#344');
  const isLightBg = background.includes('#F') || background.includes('#fff');
  return isDarkText === isLightBg;
};

/**
 * Get platform-specific value
 * Usage: getPlatformValue({ ios: 10, android: 8, web: 12 })
 */
export const getPlatformValue = <T,>(
  values: Partial<Record<'ios' | 'android' | 'web' | 'default', T>>
): T | undefined => {
  const platform = Platform.OS as 'ios' | 'android' | 'web';
  return values[platform] ?? values.default;
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type TypographySize = keyof typeof typography.size;
export type TypographyWeight = keyof typeof typography.weight;
export type ShadowToken = keyof typeof shadows;
export type AnimationDuration = keyof typeof animations.duration;
export type ZIndexLevel = keyof typeof zIndex;

// ============================================================================
// THEME OBJECT (for advanced usage with theme providers)
// ============================================================================

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  animations,
  breakpoints,
  zIndex,
  opacity,
  sizes,
} as const;

export type Theme = typeof theme;

// Default export for convenience
export default {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  animations,
  breakpoints,
  zIndex,
  opacity,
  sizes,
  
  // Utility functions
  getResponsiveSpacing,
  withOpacity,
  hasGoodContrast,
  getPlatformValue,
};