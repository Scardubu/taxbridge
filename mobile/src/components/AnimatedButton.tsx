import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: AnimatedButtonProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(pressed.value ? 0.95 : 1, {
            damping: 15,
            stiffness: 300,
          }),
        },
      ],
      backgroundColor: interpolateColor(
        pressed.value,
        [0, 1],
        [
          variant === 'primary' ? '#0B5FFF' : '#FFFFFF',
          variant === 'primary' ? '#0952CC' : '#F8F9FA',
        ]
      ),
    };
  });

  const textStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        pressed.value,
        [0, 1],
        [
          variant === 'primary' ? '#FFFFFF' : '#344054',
          variant === 'primary' ? '#FFFFFF' : '#101828',
        ]
      ),
    };
  });

  return (
    <Pressable
      onPressIn={() => {
        if (!disabled && !loading) {
          pressed.value = 1;
        }
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[animatedStyle, styles.button, style]}
      testID={testID}
    >
      <Animated.Text style={[textStyle, styles.text]}>
        {loading ? 'Loading...' : title}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    minHeight: 48,
    elevation: 2,
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
