export const colors = {
  // Brand
  primary: '#0B5FFF',
  primaryDark: '#0952CC',
  primaryDeep: '#052B52',
  primaryLight: '#EBF4FF',
  primaryBorder: '#93C5FD',

  // Surfaces
  surface: '#FFFFFF',
  surfaceMuted: '#F8F9FA',
  surfaceSecondary: '#F2F4F7',
  surfaceSlate: '#F8FAFC',

  // Borders
  border: '#D0D5DD',
  borderSubtle: '#E4E7EC',
  borderTransparent: 'rgba(0, 0, 0, 0.05)',

  // Text
  textPrimary: '#101828',
  textSecondary: '#344054',
  textMuted: '#667085',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryMuted: 'rgba(255, 255, 255, 0.85)',
  textOnPrimarySubtle: 'rgba(255, 255, 255, 0.8)',

  // Status: Success
  success: '#10B981',
  successDark: '#065F46',
  successBg: '#D1FAE5',
  successBorder: '#6EE7B7',

  // Status: Warning
  warning: '#FBBF24',
  warningDark: '#92400E',
  warningBg: '#FEF3C7',
  warningBgLight: '#FEF3C7',
  warningBorder: '#FDE68A',

  // Status: Error
  error: '#DC2626',
  errorDark: '#991B1B',
  errorBg: '#FEE2E2',
  errorBgSubtle: '#FEF2F2',
  errorBorder: '#FCA5A5',

  // Status: Info (processing)
  info: '#3B82F6',
  infoDark: '#1E40AF',
  infoBg: '#DBEAFE',
  infoBorder: '#93C5FD',
  infoText: '#1E40AF',

  // Disabled/Muted
  disabled: '#98A2B7',

  // Status: Neutral
  neutralDark: '#6B7280',
  neutralBg: '#F3F4F6',

  // Tip colors
  tipBg: '#FFFBEB',
  tipBorder: '#FDE68A',
  tipText: '#92400E',

  // Action colors (Quick Actions)
  actionGreen: '#059669',
  actionGreenBg: '#ECFDF5',
  actionPurple: '#7C3AED',
  actionPurpleBg: '#F5F3FF',
  actionOrange: '#EA580C',
  actionOrangeBg: '#FFF7ED',

  // Overlays
  overlaySuccess: 'rgba(16, 185, 129, 0.2)',
  overlayWarning: 'rgba(251, 191, 36, 0.2)',
  overlayLight: 'rgba(255, 255, 255, 0.15)',
  overlayLightBorder: 'rgba(255, 255, 255, 0.3)',
  overlayLightStrong: 'rgba(255, 255, 255, 0.2)',
  overlayLightSubtle: 'rgba(255, 255, 255, 0.1)',

  // Shadows
  shadowPrimary: '#0B5FFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 26,
    xxxl: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

// Elevation/shadow presets
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  primary: {
    shadowColor: '#0B5FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};
