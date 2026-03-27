import React from 'react';
import { View } from 'react-native';

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

export function OnboardingProgressBar({ percent }: { percent: number }) {
  const color = percent === 100 ? '#00C853' : '#006B3F';
  const progressStyle = {
    height: '100%',
    width: `${percent}%`,
    backgroundColor: color,
    borderRadius: 2,
    transitionProperty: ['width', 'backgroundColor'],
    transitionDuration: 400,
    transitionTimingFunction: 'ease-in-out',
  } as any;

  return (
    <View style={{ height: 4, backgroundColor: '#E8EDF2', borderRadius: 2, marginHorizontal: 20 }}>
      <View style={progressStyle} />
    </View>
  );
}
