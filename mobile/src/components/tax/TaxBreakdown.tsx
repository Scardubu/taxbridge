import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from '../../utils/safeHaptics';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { DURATION, STAGGER } from '../../design-system/animation';
import { PITCalculation, TaxOptimization, formatNaira, formatPercentage } from '../../services/tax/engine';

interface TaxBreakdownProps {
  calculation: PITCalculation;
  optimization?: TaxOptimization;
  onOptimizationPress?: () => void;
}

/**
 * Tax Breakdown Component
 * 
 * Displays detailed PIT calculation with:
 * - Per-bracket breakdown
 * - Effective tax rate
 * - Take-home calculation
 * - Optimization suggestions
 */
export function TaxBreakdown({ calculation, optimization, onOptimizationPress }: TaxBreakdownProps) {
  const { t } = useTranslation();

  const handleOptimizationPress = () => {
    if (onOptimizationPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onOptimizationPress();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <Animated.View entering={FadeInDown.duration(DURATION.transition)} style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>{t('tax.grossIncome')}</Text>
            <Text style={styles.headerValue}>{formatNaira(calculation.income)}</Text>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>{t('tax.totalTax')}</Text>
            <Text style={[styles.headerValue, styles.headerValueTax]}>
              {formatNaira(calculation.totalTax)}
            </Text>
          </View>
        </View>

        <View style={styles.takeHomeRow}>
          <Text style={styles.takeHomeLabel}>{t('tax.takeHome')}</Text>
          <Text style={styles.takeHomeValue}>{formatNaira(calculation.takeHome)}</Text>
        </View>

        <View style={styles.rateRow}>
          <View style={styles.rateBadge}>
            <Text style={styles.rateLabel}>{t('tax.effectiveRate')}</Text>
            <Text style={styles.rateValue}>{formatPercentage(calculation.effectiveRate)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Relief Deductions Card (NTA 2025 — Pension + NHF + RRA) */}
      <Animated.View entering={FadeInDown.duration(DURATION.transition).delay(100)} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🛡️</Text>
          <Text style={styles.cardTitle}>{t('tax.craTitle')}</Text>
        </View>
        <Text style={styles.infoText}>{t('tax.craDescription')}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>{t('tax.craAmount')}</Text>
          <Text style={styles.amountValue}>{formatNaira(calculation.cra)}</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>{t('tax.taxableIncome')}</Text>
          <Text style={styles.amountValue}>{formatNaira(calculation.taxableIncome)}</Text>
        </View>
      </Animated.View>

      {/* Bracket Breakdown */}
      <Animated.View entering={FadeInDown.duration(DURATION.transition).delay(200)} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>{t('tax.bracketBreakdown')}</Text>
        </View>

        {calculation.breakdown.length === 0 ? (
          <View style={styles.exemptBadge}>
            <Text style={styles.exemptIcon}>✓</Text>
            <Text style={styles.exemptText}>{t('tax.belowMinimumWage')}</Text>
          </View>
        ) : (
          calculation.breakdown.map((bracket, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.duration(200).delay(300 + index * 50)}
              style={styles.bracketRow}
            >
              <View style={styles.bracketInfo}>
                <Text style={styles.bracketLabel}>{bracket.bracket}</Text>
                <Text style={styles.bracketAmount}>
                  {formatNaira(bracket.amount, false)} @ {formatPercentage(bracket.rate)}
                </Text>
              </View>
              <Text style={styles.bracketTax}>{formatNaira(bracket.tax)}</Text>
            </Animated.View>
          ))
        )}
      </Animated.View>

      {/* Optimization Card */}
      {optimization && optimization.potentialSavings > 0 && (
        <Animated.View entering={FadeInDown.duration(DURATION.transition).delay(400)} style={styles.optimizationCard}>
          <View style={styles.optimizationHeader}>
            <View style={styles.optimizationTitleRow}>
              <Text style={styles.optimizationIcon}>💡</Text>
              <View>
                <Text style={styles.optimizationTitle}>{t('tax.saveTaxes')}</Text>
                <Text style={styles.optimizationSubtitle}>
                  {t('tax.potentialSavings')}: {formatNaira(optimization.potentialSavings)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.recommendationsPreview}>
            <Text style={styles.recommendationCount}>
              {optimization.recommendations.length} {t('tax.recommendations')}
            </Text>
            
            {/* Show first 2 recommendations */}
            {optimization.recommendations.slice(0, 2).map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <View style={[
                  styles.priorityBadge,
                  rec.priority === 'high' && styles.priorityHigh,
                  rec.priority === 'medium' && styles.priorityMedium,
                ]}>
                  <Text style={styles.priorityText}>
                    {rec.priority === 'high' ? '⚡' : '💼'}
                  </Text>
                </View>
                <View style={styles.recommendationText}>
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  <Text style={styles.recommendationSavings}>
                    Save up to {formatNaira(rec.savingsEstimate, false)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {onOptimizationPress && (
            <Pressable style={styles.optimizationButton} onPress={handleOptimizationPress}>
              <Text style={styles.optimizationButtonText}>
                {t('tax.viewAllRecommendations')} →
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* Compliance Notice */}
      <Animated.View entering={FadeInDown.duration(DURATION.transition).delay(500)} style={styles.complianceNotice}>
        <Text style={styles.complianceIcon}>🏛️</Text>
        <Text style={styles.complianceText}>
          {t('tax.complianceNotice')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },

  // Header Card
  headerCard: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  headerDivider: {
    width: 1,
    backgroundColor: colors.overlayLightStrong,
    marginHorizontal: spacing.md,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: typography.size.xs,
    color: colors.textOnPrimarySubtle,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  headerValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.textOnPrimary,
  },
  headerValueTax: {
    color: colors.warning,
  },
  takeHomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLightStrong,
    marginBottom: spacing.md,
  },
  takeHomeLabel: {
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
  },
  takeHomeValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.success,
  },
  rateRow: {
    alignItems: 'center',
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlayLightStrong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
  },
  rateLabel: {
    fontSize: typography.size.xs,
    color: colors.textOnPrimarySubtle,
    fontWeight: typography.weight.semibold,
  },
  rateValue: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
  },

  // Generic Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  cardIcon: {
    fontSize: typography.size.xl,
  },
  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },

  // Info Text
  infoText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    lineHeight: spacing.lg,
    marginBottom: spacing.md,
  },

  // Amount Rows
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  amountLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
  },
  amountValue: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
  },

  // Exempt Badge
  exemptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  exemptIcon: {
    fontSize: typography.size.lg,
    color: colors.success,
  },
  exemptText: {
    fontSize: typography.size.sm,
    color: colors.successDark,
    fontWeight: typography.weight.semibold,
    flex: 1,
  },

  // Bracket Rows
  bracketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  bracketInfo: {
    flex: 1,
  },
  bracketLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing.xxs,
  },
  bracketAmount: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold,
  },
  bracketTax: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },

  // Optimization Card
  optimizationCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  optimizationHeader: {
    marginBottom: spacing.md,
  },
  optimizationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  optimizationIcon: {
    fontSize: typography.size.xxl,
  },
  optimizationTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.warningDark,
    marginBottom: spacing.xxs,
  },
  optimizationSubtitle: {
    fontSize: typography.size.sm,
    color: colors.warningDark,
    fontWeight: typography.weight.semibold,
  },
  recommendationsPreview: {
    gap: spacing.sm,
  },
  recommendationCount: {
    fontSize: typography.size.xs,
    color: colors.warningDark,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  priorityBadge: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radii.sm,
    backgroundColor: colors.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityHigh: {
    backgroundColor: colors.error,
  },
  priorityMedium: {
    backgroundColor: colors.warning,
  },
  priorityText: {
    fontSize: typography.size.sm,
  },
  recommendationText: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  recommendationSavings: {
    fontSize: typography.size.xs,
    color: colors.success,
    fontWeight: typography.weight.bold,
  },
  optimizationButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  optimizationButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },

  // Compliance Notice
  complianceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoBg,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  complianceIcon: {
    fontSize: typography.size.lg,
  },
  complianceText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.infoText,
    lineHeight: spacing.lg,
  },
});
