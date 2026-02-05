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

  const { safeSubtotal, taxTotal, subtotalPct, taxPct } = useMemo(() => {
    const s = Math.max(0, subtotal);
    const v = Math.max(0, vat);
    const w = Math.max(0, wht);
    const tax = v + w;
    const base = Math.max(1, s + tax);
    const subPct = Math.round((s / base) * 100);
    const txPct = 100 - subPct; // ensure total = 100
    return { safeSubtotal: s, taxTotal: tax, subtotalPct: subPct, taxPct: txPct };
  }, [subtotal, vat, wht]);

  return (
    <Animated.View style={styles.container} entering={FadeIn.duration(200)}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tax.visualizerTitle', { defaultValue: 'Tax Breakdown' })}</Text>
        <Text style={styles.subtitle}>{t('tax.visualizerSubtitle', { defaultValue: 'Proportion of subtotal vs taxes' })}</Text>
      </View>

      <View
        style={styles.barTrack}
        accessibilityRole="progressbar"
        accessibilityLabel={t('tax.visualizerTitle', { defaultValue: 'Tax Breakdown' })}
        accessibilityHint={t('tax.visualizerSubtitle', { defaultValue: 'Proportion of subtotal vs taxes' })}
        accessibilityValue={{ now: subtotalPct, min: 0, max: 100 }}
      >
        <View
          style={[styles.barSegment, styles.subtotalSegment, { flex: safeSubtotal ? safeSubtotal : 0 }]}
          accessibilityLabel={`${t('tax.visualizerSubtotal', { defaultValue: 'Subtotal' })} ${formatPercent(subtotalPct)}`}
        />
        <View
          style={[styles.barSegment, styles.taxSegment, { flex: taxTotal ? taxTotal : 0 }]}
          accessibilityLabel={`${t('tax.visualizerTax', { defaultValue: 'Taxes' })} ${formatPercent(taxPct)}`}
        />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.primary }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text style={[styles.legendLabel, styles.legendLabelSpacing]}>{t('tax.visualizerSubtotal', { defaultValue: 'Subtotal' })}</Text>
          <Text style={styles.legendValue}>{formatPercent(subtotalPct)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.info }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text style={[styles.legendLabel, styles.legendLabelSpacing]}>{t('tax.visualizerTax', { defaultValue: 'Taxes' })}</Text>
          <Text style={styles.legendValue}>{formatPercent(taxPct)}</Text>
        </View>
      </View>

      <Text style={styles.totalNote}>{t('tax.visualizerTotal', { defaultValue: 'Total: {{total}}', total: total.toFixed(2) })}</Text>
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
    backgroundColor: colors.info,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  legendLabelSpacing: {
    marginRight: spacing.xs,
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
