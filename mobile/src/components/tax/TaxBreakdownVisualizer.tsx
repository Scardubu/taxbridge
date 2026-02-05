import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface TaxBreakdownVisualizerProps {
  subtotal: number;
  vat: number;
  wht?: number;
  total: number;
}

const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const TaxBreakdownVisualizer = memo<TaxBreakdownVisualizerProps>(({
  subtotal,
  vat,
  wht = 0,
  total,
}) => {
  const { t } = useTranslation();

  const { subtotalPct, taxPct } = useMemo(() => {
    const taxTotal = Math.max(0, vat + wht);
    const base = Math.max(1, subtotal + taxTotal);
    return {
      subtotalPct: (subtotal / base) * 100,
      taxPct: (taxTotal / base) * 100,
    };
  }, [subtotal, vat, wht]);

  return (
    <Animated.View style={styles.container} entering={FadeIn.duration(200)}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tax.visualizerTitle')}</Text>
        <Text style={styles.subtitle}>{t('tax.visualizerSubtitle')}</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barSegment, styles.subtotalSegment, { flex: subtotalPct }]} />
        <View style={[styles.barSegment, styles.taxSegment, { flex: taxPct }]} />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendLabel}>{t('tax.visualizerSubtotal')}</Text>
          <Text style={styles.legendValue}>{formatPercent(subtotalPct)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendLabel}>{t('tax.visualizerTax')}</Text>
          <Text style={styles.legendValue}>{formatPercent(taxPct)}</Text>
        </View>
      </View>

      <Text style={styles.totalNote}>{t('tax.visualizerTotal', { total: total.toFixed(2) })}</Text>
    </Animated.View>
  );
});

TaxBreakdownVisualizer.displayName = 'TaxBreakdownVisualizer';

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  barSegment: {
    height: '100%',
  },
  subtotalSegment: {
    backgroundColor: colors.primary,
  },
  taxSegment: {
    backgroundColor: colors.warning,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  legendValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  totalNote: {
    marginTop: spacing.sm,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
});
