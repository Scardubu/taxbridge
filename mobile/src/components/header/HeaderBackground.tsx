import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Pattern, Rect, G } from 'react-native-svg';
import { colors } from '../../theme/tokens';

interface HeaderBackgroundProps {
  height?: number;
  showGrid?: boolean;
  showArc?: boolean;
}

/**
 * Living Bridge SVG Background
 * 
 * Features:
 * - Subtle grid pattern for depth
 * - Soft gradient arc (brand colors: green → blue)
 * - Accent stroke arc (logo-inspired)
 * - Optimized for performance (no heavy filters on mobile)
 */
function HeaderBackground({ 
  height = 200, 
  showGrid = true, 
  showArc = true 
}: HeaderBackgroundProps) {
  const isWeb = Platform.OS === 'web';
  
  return (
    <View style={[styles.container, { height }]} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          {/* Brand gradient for soft arc */}
          <LinearGradient id="tbGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.brandGreen400} stopOpacity="0.12" />
            <Stop offset="0.6" stopColor={colors.brandBlue500} stopOpacity="0.14" />
            <Stop offset="1" stopColor={colors.brandBlue500} stopOpacity="0.08" />
          </LinearGradient>

          {/* Grid pattern */}
          {showGrid && (
            <Pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <Path 
                d="M16 0H0V16" 
                fill="none" 
                stroke={colors.headerGridStroke} 
                strokeWidth="0.5" 
              />
            </Pattern>
          )}
        </Defs>

        {/* Subtle grid background */}
        {showGrid && (
          <Rect width="100%" height="100%" fill="url(#grid)" opacity={0.18} />
        )}

        {showArc && (
          <G>
            {/* Soft brand arc - large curved shape */}
            <Path
              d="M0,140 C78,84 156,180 233,140 300,105 356,154 400,126 L400,200 L0,200 Z"
              fill="url(#tbGrad)"
              opacity={isWeb ? 0.9 : 0.85}
            />

            {/* Accent arc stroke (Living Bridge visual) */}
            <Path
              d="M0,160 C89,111 156,154 233,140 300,126 356,140 400,118"
              stroke={colors.headerArcStroke}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
          </G>
        )}
      </Svg>
    </View>
  );
}

export default memo(HeaderBackground);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
