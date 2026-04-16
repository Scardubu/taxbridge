import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { palette, spacing, typography } from './design-system/tokens';

interface Props {
  isActive: boolean;
  children: React.ReactNode;
}

// C-02 fix: CSS Transitions only — no withSpring/withTiming for step UI.
// React Native New Architecture (Fabric) supports transitionProperty inline styles.
export function StepContainer({ isActive, children }: Readonly<Props>) {
  const stepStyle = {
    flex: 1,
    opacity: isActive ? 1 : 0,
    transform: [{ translateX: isActive ? 0 : 20 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 220,
    transitionTimingFunction: 'ease-out',
  } as any;

  return (
    <View style={stepStyle}>
      {children}
    </View>
  );
}

export function OnboardingProgressBar({ percent, stepName }: Readonly<{ percent: number; stepName?: string }>) {
  const color = percent === 100 ? palette.shield : palette.nrsGreen;
  const widthPct = useSharedValue(percent);

  useEffect(() => {
    widthPct.value = withTiming(percent, { duration: 400 });
  }, [percent, widthPct]);

  const trackStyle = useAnimatedStyle(() => ({
    // Worklet runs on UI thread — no JS-thread frame drops during onboarding API calls.
    width: `${widthPct.value}%`,
  }));

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ height: 6, backgroundColor: palette.gray100, borderRadius: 4, overflow: 'hidden' }}>
        <Animated.View
          style={[
            { height: '100%', borderRadius: 4, backgroundColor: color },
            trackStyle,
          ]}
        />
      </View>
      {stepName ? (
        <Text style={{ ...typography.caption, color: palette.gray400, textAlign: 'center' }}>
          {stepName}
        </Text>
      ) : null}
    </View>
  );
}
