import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { formatNaira } from '../../services/tax/engine';
import { Text } from '../ui/Text';

interface PITBracket {
  min: number;
  max: number | null;
  rate: number;
  amount: number;
  label: string;
  labelPidgin: string;
}

interface TaxBracketVisualizerProps {
  income: number;
  brackets: PITBracket[];
}

export function TaxBracketVisualizer({ income, brackets }: TaxBracketVisualizerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="h4" style={styles.title}>
        {t('tax.bracketBreakdownTitle')}
      </Text>
      <Text variant="pidgin" color={colors.textMuted} style={styles.subtitle}>
        {t('tax.bracketBreakdownSubtitle')}
      </Text>

      <View style={styles.bracketsContainer}>
        {brackets.map((bracket, index) => (
          <BracketBar key={`${bracket.min}-${index}`} bracket={bracket} income={income} delay={index * 150} />
        ))}
      </View>
    </View>
  );
}

function BracketBar({ bracket, income, delay }: { bracket: PITBracket; income: number; delay: number }) {
  const { t } = useTranslation();
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const bracketIncome = Math.min(income - bracket.min, (bracket.max ?? Infinity) - bracket.min);
    const maxBracketRange = (bracket.max ?? income) - bracket.min;
    const fillPercentage = Math.max(0, Math.min(100, (bracketIncome / maxBracketRange) * 100));

    width.value = withDelay(delay, withTiming(fillPercentage, { duration: 800 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, [income, bracket.min, bracket.max, delay, width, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  const containerAnimatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const getColorByRate = (rate: number) => {
    if (rate === 0) return colors.ntaExemption;
    if (rate <= 0.15) return colors.primary;
    if (rate <= 0.2) return colors.actionOrange;
    return colors.ntaAlert;
  };

  return (
    <Animated.View style={[styles.bracketContainer, containerAnimatedStyle]}>
      <View style={styles.bracketHeader}>
        <Text variant="body" weight="semibold">
          {bracket.label}
        </Text>
        <Text variant="caption">{formatNaira(bracket.amount)}</Text>
      </View>

      <Text variant="caption" color={colors.textMuted}>
        {bracket.labelPidgin}
      </Text>

      <View style={styles.barBackground}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: getColorByRate(bracket.rate),
            },
            animatedStyle,
          ]}
        />
      </View>

      <Text variant="caption" weight="semibold" color={getColorByRate(bracket.rate)}>
        {t('tax.rateLabel', { rate: Math.round(bracket.rate * 100) })}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xxl,
  },
  bracketsContainer: {
    gap: spacing.lg,
  },
  bracketContainer: {
    gap: spacing.sm,
  },
  bracketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barBackground: {
    height: 8,
    backgroundColor: colors.neutralBg,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.full,
  },
});
