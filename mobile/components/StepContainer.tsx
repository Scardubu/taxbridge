import React from 'react';
import { View, Text } from 'react-native';
import { palette, radius, spacing, typography } from './design-system/tokens';

interface Props {
  isActive: boolean;
  children: React.ReactNode;
}

// C-02 fix: CSS Transitions only — no withSpring/withTiming for step UI.
// React Native New Architecture (Fabric) supports transitionProperty inline styles.
export function StepContainer({ isActive, children }: Props) {
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

export function OnboardingProgressBar({ percent, stepName }: { percent: number; stepName?: string }) {
  const color = percent === 100 ? palette.shield : palette.nrsGreen;
  const progressStyle = {
    height: '100%',
    width: `${percent}%`,
    backgroundColor: color,
    borderRadius: 4,
    transitionProperty: ['width', 'backgroundColor'],
    transitionDuration: 400,
    transitionTimingFunction: 'ease-in-out',
  } as any;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ height: 6, backgroundColor: palette.gray100, borderRadius: 4 }}>
        <View style={progressStyle} />
      </View>
      {stepName ? (
        <Text style={{ ...typography.caption, color: palette.gray400, textAlign: 'center' }}>
          {stepName}
        </Text>
      ) : null}
    </View>
  );
}
