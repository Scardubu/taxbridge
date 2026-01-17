import React, { memo } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function AnimatedButton({
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
          variant === 'primary' ? colors.primary : colors.surface,
          variant === 'primary' ? colors.primaryDark : colors.surfaceMuted,
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
          variant === 'primary' ? colors.surface : colors.textSecondary,
          variant === 'primary' ? colors.surface : colors.textPrimary,
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

export default memo(AnimatedButton);

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl + 4,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    elevation: 2,
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  },
  text: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
});
