import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { TaxBreakdownVisualizer } from './TaxBreakdownVisualizer';

export interface TaxBreakdown {
  subtotal: number;
  vatApplied: {
    rate: number;
    amount: number;
    applicableTo?: string;
  };
  whtApplied?: {
    rate: number;
    amount: number;
    applicableTo?: string;
  };
  exemptions?: string[];
  total: number;
}

interface TaxIntelligencePanelProps {
  breakdown: TaxBreakdown;
  onLearnMore?: () => void;
}

const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * TaxIntelligencePanel Component
 * 
 * Makes tax calculations transparent and educational:
 * - Shows detailed breakdown
 * - Explains each tax component
 * - Links to tax guide for deeper understanding
 */
export const TaxIntelligencePanel = memo<TaxIntelligencePanelProps>(({
  breakdown,
  onLearnMore,
}) => {
  const { t } = useTranslation();

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeInDown.delay(100).springify()}
    >
      <View style={styles.header}>
        <Ionicons name="calculator-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>{t('tax.intelligenceTitle')}</Text>
      </View>

      {/* Subtotal */}
      <View style={styles.row}>
        <Text style={styles.label}>{t('tax.subtotal')}</Text>
        <Text style={styles.value}>{formatCurrency(breakdown.subtotal)}</Text>
      </View>

      {/* VAT Breakdown */}
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {t('tax.vat')} ({(breakdown.vatApplied.rate * 100).toFixed(1)}%)
          </Text>
          <TouchableOpacity 
            style={styles.whyButton}
            onPress={onLearnMore}
          >
            <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.value, styles.valuePositive]}>
          +{formatCurrency(breakdown.vatApplied.amount)}
        </Text>
      </View>
      
      <View style={styles.explainerContainer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <Text style={styles.explainer}>{t('tax.vatExplainer')}</Text>
      </View>

      {/* WHT if applicable */}
      {breakdown.whtApplied && breakdown.whtApplied.amount > 0 && (
        <>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>
                {t('tax.wht')} ({(breakdown.whtApplied.rate * 100).toFixed(0)}%)
              </Text>
              <TouchableOpacity 
                style={styles.whyButton}
                onPress={onLearnMore}
              >
                <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.value, styles.valueNegative]}>
              -{formatCurrency(breakdown.whtApplied.amount)}
            </Text>
          </View>
          
          <View style={styles.explainerContainer}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.explainer}>{t('tax.whtExplainer')}</Text>
          </View>
        </>
      )}

      {/* Exemptions */}
      {breakdown.exemptions && breakdown.exemptions.length > 0 && (
        <View style={styles.exemptionsContainer}>
          <Text style={styles.exemptionsTitle}>{t('tax.exemptions')}</Text>
          {breakdown.exemptions.map((exemption, index) => (
            <View key={index} style={styles.exemptionRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={styles.exemptionText}>{exemption}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Total */}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>{t('tax.total')}</Text>
        <Text style={styles.totalValue}>{formatCurrency(breakdown.total)}</Text>
      </View>

      <TaxBreakdownVisualizer
        subtotal={breakdown.subtotal}
        vat={breakdown.vatApplied.amount}
        wht={breakdown.whtApplied?.amount || 0}
        total={breakdown.total}
      />

      {/* Learn More CTA */}
      {onLearnMore && (
        <TouchableOpacity style={styles.learnMoreButton} onPress={onLearnMore}>
          <Text style={styles.learnMoreText}>{t('tax.learnMore')}</Text>
          <Ionicons name="book-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

TaxIntelligencePanel.displayName = 'TaxIntelligencePanel';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryBgSubtle,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  whyButton: {
    padding: spacing.xs,
  },
  value: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  valuePositive: {
    color: colors.success,
  },
  valueNegative: {
    color: colors.error,
  },
  explainerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSlate,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  explainer: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  exemptionsContainer: {
    backgroundColor: colors.successBgSubtle,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  exemptionsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  exemptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  exemptionText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  learnMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
});
