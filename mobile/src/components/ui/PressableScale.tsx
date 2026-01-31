import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  scaleValue?: number;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  children,
  scaleValue = 0.96,
  style,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    scale.value = withSpring(scaleValue, { damping: 15, stiffness: 400 });
    props.onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    props.onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
