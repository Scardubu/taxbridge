import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { calculateVAT } from '../../services/tax/engine';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

interface DemoItem {
  description: string;
  amount: number;
  taxable: boolean;
  isEditing?: boolean;
}

const INITIAL_DEMO_ITEMS: DemoItem[] = [
  { description: 'Professional Services', amount: 50000, taxable: true },
  { description: 'Travel Reimbursement', amount: 10000, taxable: false },
];

export default function TaxEngineDemo({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const haptics = useHapticFeedback();

  const [items, setItems] = useState<DemoItem[]>(INITIAL_DEMO_ITEMS);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showExplainer, setShowExplainer] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Calculate tax breakdown
  const calculations = useMemo(() => {
    const taxableAmount = items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);
    
    const nonTaxableAmount = items
      .filter(item => !item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);

    const subtotal = taxableAmount + nonTaxableAmount;
    const vatResult = calculateVAT(taxableAmount);
    const vatAmount = vatResult.amount;
    const total = subtotal + vatAmount;

    return {
      subtotal,
      taxableAmount,
      nonTaxableAmount,
      vat: { amount: vatAmount, rate: 7.5 },
      total,
    };
  }, [items]);

  // Handle item amount edit
  const handleAmountChange = useCallback((index: number, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const amount = parseInt(numericValue || '0', 10);
    
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], amount };
      return newItems;
    });
    
    if (!hasInteracted) {
      setHasInteracted(true);
      haptics.light();
    }
  }, [hasInteracted, haptics]);

  // Toggle taxable status
  const handleToggleTaxable = useCallback((index: number) => {
    haptics.medium();
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], taxable: !newItems[index].taxable };
      return newItems;
    });
    setHasInteracted(true);
  }, [haptics]);

  // Show explainer modal
  const handleShowExplainer = useCallback((type: string) => {
    haptics.light();
    setShowExplainer(type);
  }, [haptics]);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  // Render explainer content
  const renderExplainer = useCallback(() => {
    if (!showExplainer) return null;

    const explainerContent = {
      vat: {
        title: t('onboarding.taxExplainerVATTitle'),
        points: [
          t('onboarding.taxExplainer1'),
          'Applied to most goods and services',
          'Collected at point of sale',
        ],
      },
      wht: {
        title: t('onboarding.taxExplainerWHTTitle'),
        points: [
          t('onboarding.taxExplainer2'),
          'Deducted at source by payer',
          'Applicable to professional services, rent, etc.',
        ],
      },
      exempt: {
        title: t('onboarding.taxExplainerExemptTitle'),
        points: [
          t('onboarding.taxExplainer3'),
          'Travel reimbursements (actual expenses)',
          'Medical expenses',
          'Basic food items',
        ],
      },
    };

    const content = explainerContent[showExplainer as keyof typeof explainerContent];
    if (!content) return null;

    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.explainerOverlay}>
        <TouchableOpacity 
          style={styles.explainerBackdrop} 
          activeOpacity={1}
          onPress={() => setShowExplainer(null)}
        />
        <Animated.View entering={SlideInRight} style={styles.explainerContent}>
          <View style={styles.explainerHeader}>
            <Text style={styles.explainerTitle}>{content.title}</Text>
            <TouchableOpacity onPress={() => setShowExplainer(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.explainerBody}>
            {content.points.map((point, index) => (
              <View key={index} style={styles.explainerPoint}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.explainerPointText}>{point}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.explainerCloseButton}
            onPress={() => setShowExplainer(null)}
          >
            <Text style={styles.explainerCloseButtonText}>{t('common.gotIt')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  }, [showExplainer, t]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="calculator" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('onboarding.taxEngineTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.taxEngineSubtitle')}</Text>
        </View>

        {/* Interactive Demo */}
        <View style={styles.demoContainer}>
          <Text style={styles.sectionTitle}>{t('onboarding.tryYourOwn')}</Text>
          
          {/* Editable Items */}
          {items.map((item, index) => (
            <Animated.View 
              key={index} 
              entering={FadeIn.delay(index * 100)}
              style={styles.itemCard}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <TouchableOpacity onPress={() => handleToggleTaxable(index)}>
                  <View style={[
                    styles.taxableBadge,
                    item.taxable ? styles.taxableBadgeActive : styles.taxableBadgeInactive
                  ]}>
                    <Text style={[
                      styles.taxableBadgeText,
                      item.taxable ? styles.taxableBadgeTextActive : styles.taxableBadgeTextInactive
                    ]}>
                      {item.taxable ? t('common.taxable') : t('common.exempt')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.amountContainer}
                onPress={() => setEditingIndex(index)}
              >
                {editingIndex === index ? (
                  <TextInput
                    style={styles.amountInput}
                    value={item.amount.toString()}
                    onChangeText={(value) => handleAmountChange(index, value)}
                    onBlur={() => setEditingIndex(null)}
                    keyboardType="numeric"
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                )}
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Tax Breakdown Visualizer */}
          <Animated.View entering={FadeIn.delay(300)} style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>{t('onboarding.taxBreakdown')}</Text>
            
            {/* Subtotal Bar */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabel}>
                <Text style={styles.breakdownLabelText}>{t('tax.breakdown.subtotal')}</Text>
              </View>
              <View style={styles.breakdownBar}>
                <View style={[styles.breakdownBarFill, { 
                  width: '100%',
                  backgroundColor: colors.surfaceSecondary 
                }]} />
              </View>
              <Text style={styles.breakdownAmount}>{formatCurrency(calculations.subtotal)}</Text>
            </View>

            {/* VAT Row */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabel}>
                <Text style={styles.breakdownLabelText}>{t('tax.breakdown.vat')}</Text>
                <TouchableOpacity onPress={() => handleShowExplainer('vat')}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                </TouchableOpacity>
              </View>
              <View style={styles.breakdownBar}>
                <View style={[styles.breakdownBarFill, { 
                  width: `${(calculations.vat.amount / calculations.subtotal) * 100}%`,
                  backgroundColor: colors.info 
                }]} />
              </View>
              <View style={styles.breakdownAmountWithBadge}>
                <Text style={styles.breakdownAmount}>{formatCurrency(calculations.vat.amount)}</Text>
                <View style={styles.rateBadge}>
                  <Text style={styles.rateBadgeText}>{calculations.vat.rate}%</Text>
                </View>
              </View>
            </View>



            {/* Non-taxable Items */}
            {calculations.nonTaxableAmount > 0 && (
              <View style={styles.exemptionInfo}>
                <TouchableOpacity 
                  style={styles.exemptionButton}
                  onPress={() => handleShowExplainer('exempt')}
                >
                  <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                  <Text style={styles.exemptionText}>
                    {formatCurrency(calculations.nonTaxableAmount)} {t('common.exempt')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.success} />
                </TouchableOpacity>
              </View>
            )}

            {/* Total */}
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('tax.breakdown.total')}</Text>
              <Text style={styles.totalAmount}>{formatCurrency(calculations.total)}</Text>
            </View>
          </Animated.View>

          {/* Interaction Hint */}
          {!hasInteracted && (
            <Animated.View entering={FadeIn.delay(500)} exiting={FadeOut} style={styles.hintCard}>
              <Ionicons name="hand-left" size={24} color={colors.primary} />
              <Text style={styles.hintText}>{t('onboarding.tapToEdit')}</Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.nextButton, hasInteracted && styles.nextButtonActive]}
          onPress={onNext}
        >
          <Text style={styles.nextButtonText}>{t('common.continue')}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Explainer Modal */}
      {renderExplainer()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  demoContainer: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemDescription: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  taxableBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  taxableBadgeActive: {
    backgroundColor: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  taxableBadgeInactive: {
    backgroundColor: `${colors.success}10`,
    borderColor: colors.success,
  },
  taxableBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  taxableBadgeTextActive: {
    color: colors.primary,
  },
  taxableBadgeTextInactive: {
    color: colors.success,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  amountText: {
    ...typography.h3,
    color: colors.primary,
  },
  amountInput: {
    ...typography.h3,
    color: colors.primary,
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.xs,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.md,
  },
  breakdownTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 80,
  },
  breakdownLabelText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: radii.sm,
  },
  breakdownAmount: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    width: 100,
    textAlign: 'right',
  },
  breakdownAmountNegative: {
    color: colors.warning,
  },
  breakdownAmountWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 140,
    justifyContent: 'flex-end',
  },
  rateBadge: {
    backgroundColor: colors.info,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  rateBadgeWarning: {
    backgroundColor: colors.warning,
  },
  rateBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  exemptionInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  exemptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: `${colors.success}10`,
    borderRadius: radii.md,
  },
  exemptionText: {
    ...typography.bodySmall,
    color: colors.success,
    flex: 1,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.borderSubtle,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  totalAmount: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: `${colors.primary}10`,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  hintText: {
    ...typography.body,
    color: colors.primary,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    ...Platform.select({
      ios: {
        shadowColor: colors.surfaceDark,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutralBg,
    borderRadius: radii.md,
  },
  nextButtonActive: {
    backgroundColor: colors.primary,
  },
  nextButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  explainerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  explainerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  explainerContent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  explainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  explainerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  explainerBody: {
    flex: 1,
  },
  explainerPoint: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  explainerPointText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  explainerCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  explainerCloseButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
});
