import React from 'react';
import Animated from 'react-native-reanimated';

interface Props {
  isActive: boolean;
  children: React.ReactNode;
}

export function StepContainer({ isActive, children }: Props) {
  const animatedStyle = {
    flex: 1,
    opacity: isActive ? 1 : 0,
    transform: [{ translateX: isActive ? 0 : 20 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 220,
    transitionTimingFunction: 'ease-out',
  } as any;

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}

export function OnboardingProgressBar({ percent }: { percent: number }) {
  const color = percent === 100 ? '#00C853' : '#006B3F';
  const progressStyle = {
    height: '100%',
    width: `${percent}%`,
    backgroundColor: color,
    borderRadius: 2,
    transitionProperty: ['width', 'background-color'],
    transitionDuration: 400,
    transitionTimingFunction: 'ease-in-out',
  } as any;

  return (
    <Animated.View style={{ height: 4, backgroundColor: '#E8EDF2', borderRadius: 2, marginHorizontal: 20 }}>
      <Animated.View style={progressStyle} />
    </Animated.View>
  );
}
