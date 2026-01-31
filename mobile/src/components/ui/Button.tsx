import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing, typography, shadows, sizes } from '../../theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  loadingLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  accessibilityLabel,
  accessibilityHint,
  loadingLabel,
}: ButtonProps) {
  const { t } = useTranslation();
  const resolvedLabel = loading ? loadingLabel ?? t('common.loading') : label;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'secondary' || variant === 'danger'
            ? colors.textOnPrimary
            : colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            variant="body"
            weight="semibold"
            color={stylesTextColor[variant]}
            style={styles.text}
          >
            {resolvedLabel}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </PressableScale>
  );
}

const stylesTextColor: Record<ButtonVariant, string> = {
  primary: colors.textOnPrimary,
  secondary: colors.textOnPrimary,
  outline: colors.primary,
  ghost: colors.primary,
  danger: colors.textOnPrimary,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: sizes.button.md,
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  secondary: {
    backgroundColor: colors.actionOrange,
    borderWidth: 1,
    borderColor: colors.actionOrange,
    ...shadows.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.error,
    ...shadows.sm,
  },
  sm: {
    minHeight: sizes.button.sm,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: sizes.button.md,
    paddingHorizontal: spacing.xl,
  },
  lg: {
    minHeight: sizes.button.lg,
    paddingHorizontal: spacing.xxl,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  text: {
    fontSize: typography.size.md,
  },
});
