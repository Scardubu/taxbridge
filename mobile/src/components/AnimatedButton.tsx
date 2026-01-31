import React, { memo } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing, typography } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: AnimatedButtonProps) {
  const { t } = useTranslation();
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
    <AnimatedPressable
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
      style={[styles.button, animatedStyle, disabled && styles.buttonDisabled, style]}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.Text style={[styles.text, textStyle, disabled && styles.textDisabled]}>
        {loading ? t('common.loading') : title}
      </Animated.Text>
    </AnimatedPressable>
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
    borderColor: colors.primary,
    minHeight: 52,
    backgroundColor: colors.primary,
    elevation: 2,
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 2px 4px rgba(11, 95, 255, 0.2)',
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSubtle,
    opacity: 0.6,
  },
  text: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.3,
    color: colors.textOnPrimary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
});
