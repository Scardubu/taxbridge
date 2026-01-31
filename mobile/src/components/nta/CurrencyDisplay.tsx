import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatNaira } from '../../services/tax/engine';
import { Text } from '../ui/Text';

interface CurrencyDisplayProps {
  amount: number;
  label?: string;
  variant?: 'default' | 'large' | 'compact';
  showSign?: boolean;
  animated?: boolean;
  color?: string;
}

export function CurrencyDisplay({
  amount,
  label,
  variant = 'default',
  showSign = false,
  animated = false,
  color = colors.textPrimary,
}: CurrencyDisplayProps) {
  const formatted = showSign && amount !== 0
    ? `${amount > 0 ? '+' : '-'}${formatNaira(Math.abs(amount))}`
    : formatNaira(amount);

  const Container = animated ? Animated.View : View;
  const animationProps = animated ? { entering: FadeIn.duration(300).delay(100) } : {};

  return (
    <Container style={styles[variant]} {...animationProps}>
      {label && (
        <Text variant="caption" color={colors.textMuted} style={styles.label}>
          {label}
        </Text>
      )}
      <Animated.View entering={animated ? SlideInRight.duration(400).springify() : undefined}>
        <Text variant="currency" color={color} style={styles[`amount_${variant}`]}>
          {formatted}
        </Text>
      </Animated.View>
    </Container>
  );
}

const styles = StyleSheet.create({
  default: {
    gap: spacing.xs,
  },
  large: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  amount_default: {
    fontSize: typography.size.xxxl,
  },
  amount_large: {
    fontSize: typography.size.xxxxxl,
  },
  amount_compact: {
    fontSize: typography.size.lg,
  },
});
