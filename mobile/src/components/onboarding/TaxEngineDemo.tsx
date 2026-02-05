import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';

const TAX_ENGINE_ANIMATION = require('../../../assets/animations/tax-engine.json');

interface TaxEngineDemoProps {
  onNext: () => void;
  onSkip?: () => void;
}

interface InvoiceItem {
  description: string;
  amount: number;
  taxable: boolean;
  whtApplicable?: boolean;
}

/**
 * TaxEngineDemo Component
 * 
 * Interactive tax calculation demo showing Nigerian tax intelligence:
 * - VAT (7.5%) on taxable items
 * - Withholding Tax (5% on professional services)
 * - Clear breakdown with explainers
 * - Try-your-own functionality
 */
export default function TaxEngineDemo({ onNext, onSkip }: TaxEngineDemoProps) {
  const { t } = useTranslation();
  const sampleItems = useMemo<InvoiceItem[]>(() => (
    [
      {
        description: t('onboarding.taxEngine.sampleItem1'),
        amount: 50000,
        taxable: true,
        whtApplicable: true,
      },
      {
        description: t('onboarding.taxEngine.sampleItem2'),
        amount: 10000,
        taxable: false,
        whtApplicable: false,
      },
    ]
  ), [t]);

  const [items, setItems] = useState<InvoiceItem[]>(sampleItems);
  const [editMode, setEditMode] = useState(false);
  const [customAmount, setCustomAmount] = useState('50000');
  const [customDescription, setCustomDescription] = useState(t('onboarding.taxEngine.customItemDefault'));
  const [isTaxable, setIsTaxable] = useState(true);
  const [isService, setIsService] = useState(true);

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);
    
    const vat = taxableAmount * 0.075; // 7.5% VAT
    const wht = items
      .filter(item => item.taxable && item.whtApplicable)
      .reduce((sum, item) => sum + item.amount * 0.05, 0); // 5% WHT on services
    
    const total = subtotal + vat - wht;

    return {
      subtotal,
      taxableAmount,
      vat,
      wht,
      total,
      vatRate: 0.075,
      whtRate: 0.05,
    };
  }, [items]);

  const handleAddCustomItem = useCallback(() => {
    const amount = parseFloat(customAmount.replace(/,/g, '')) || 0;
    if (amount > 0 && customDescription.trim()) {
      setItems(prev => [
        ...prev,
        {
          description: customDescription.trim(),
          amount,
          taxable: isTaxable,
          whtApplicable: isTaxable && isService,
        },
      ]);
      setCustomAmount('');
      setCustomDescription(t('onboarding.taxEngine.customItemDefault'));
      setEditMode(false);
    }
  }, [customAmount, customDescription, isService, isTaxable, t]);

  const handleReset = useCallback(() => {
    setItems(sampleItems);
    setEditMode(false);
  }, [sampleItems]);

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Animated Header */}
      <View style={styles.header}>
        <LottieView
          source={TAX_ENGINE_ANIMATION}
          autoPlay
          loop={true}
          style={styles.headerAnimation}
          speed={0.9}
        />
        <Text style={styles.title}>{t('onboarding.taxEngine.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.taxEngine.subtitle')}</Text>
      </View>

      {/* Sample Invoice Items */}
      <View style={styles.itemsCard}>
        <Text style={styles.sectionLabel}>{t('onboarding.taxEngine.items')}</Text>
        
        {items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                <View style={[
                  styles.taxBadge,
                  item.taxable ? styles.taxBadgeTaxable : styles.taxBadgeExempt
                ]}>
                  <Text style={[
                    styles.taxBadgeText,
                    item.taxable ? styles.taxBadgeTextTaxable : styles.taxBadgeTextExempt
                  ]}>
                    {item.taxable ? t('onboarding.taxEngine.taxable') : t('onboarding.taxEngine.exempt')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Tax Breakdown with Animation */}
      <Animated.View 
        style={styles.breakdownCard}
        entering={FadeIn.delay(200)}
      >
        <Text style={styles.breakdownTitle}>{t('onboarding.taxEngine.breakdown')}</Text>
        
        {/* Subtotal */}
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('onboarding.taxEngine.subtotal')}</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(calculations.subtotal)}</Text>
        </View>

        {/* VAT Explainer */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLabelContainer}>
            <Text style={styles.breakdownLabel}>
              {t('onboarding.taxEngine.vat')} ({(calculations.vatRate * 100).toFixed(1)}%)
            </Text>
            <Text style={styles.breakdownExplainer}>
              {t('onboarding.taxEngine.vatExplainer')}
            </Text>
          </View>
          <Text style={[styles.breakdownValue, styles.breakdownValuePositive]}>
            +{formatCurrency(calculations.vat)}
          </Text>
        </View>

        {/* WHT Explainer */}
        {calculations.wht > 0 && (
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelContainer}>
              <Text style={styles.breakdownLabel}>
                {t('onboarding.taxEngine.wht')} ({(calculations.whtRate * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.breakdownExplainer}>
                {t('onboarding.taxEngine.whtExplainer')}
              </Text>
            </View>
            <Text style={[styles.breakdownValue, styles.breakdownValueNegative]}>
              -{formatCurrency(calculations.wht)}
            </Text>
          </View>
        )}

        {/* Total */}
        <View style={[styles.breakdownRow, styles.breakdownTotal]}>
          <Text style={styles.totalLabel}>{t('onboarding.taxEngine.total')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(calculations.total)}</Text>
        </View>

        {/* Learn More Link */}
        <Text style={styles.learnMore}>
          {t('onboarding.taxEngine.autoApply')}
        </Text>
      </Animated.View>

      {/* Try Your Own Section */}
      {!editMode ? (
        <TouchableOpacity
          style={styles.tryButton}
          onPress={() => setEditMode(true)}
        >
          <Text style={styles.tryButtonText}>{t('onboarding.taxEngine.tryYourOwn')}</Text>
        </TouchableOpacity>
      ) : (
        <Animated.View 
          style={styles.editCard}
          entering={FadeIn}
          exiting={FadeOut}
        >
          <Text style={styles.editTitle}>{t('onboarding.taxEngine.addItem')}</Text>
          
          <TextInput
            style={styles.input}
            placeholder={t('onboarding.taxEngine.descriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={customDescription}
            onChangeText={setCustomDescription}
          />

          <View style={styles.inputRow}>
            <View style={styles.currencyInputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={text => {
                  const num = text.replace(/[^0-9]/g, '');
                  setCustomAmount(num ? parseInt(num, 10).toLocaleString('en-NG') : '');
                }}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.taxToggle,
                isTaxable && styles.taxToggleActive
              ]}
              onPress={() => setIsTaxable(!isTaxable)}
            >
              <Text style={[
                styles.taxToggleText,
                isTaxable && styles.taxToggleTextActive
              ]}>
                {isTaxable ? t('onboarding.taxEngine.taxable') : t('onboarding.taxEngine.exempt')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.taxToggle,
                isService && styles.taxToggleActive
              ]}
              onPress={() => setIsService(!isService)}
            >
              <Text style={[
                styles.taxToggleText,
                isService && styles.taxToggleTextActive
              ]}>
                {isService ? t('onboarding.taxEngine.service') : t('onboarding.taxEngine.goods')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.editActionButton}
              onPress={handleReset}
            >
              <Text style={styles.editActionText}>{t('common.reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionButton, styles.editActionButtonPrimary]}
              onPress={handleAddCustomItem}
            >
              <Text style={[styles.editActionText, styles.editActionTextPrimary]}>
                {t('common.add')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Navigation Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onNext}
        >
          <Text style={styles.continueButtonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
          >
            <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerAnimation: {
    width: 140,
    height: 140,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xxl + 2,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemAmount: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  taxBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  taxBadgeTaxable: {
    backgroundColor: colors.successBgSubtle,
  },
  taxBadgeExempt: {
    backgroundColor: colors.surfaceSlate,
  },
  taxBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  taxBadgeTextTaxable: {
    color: colors.success,
  },
  taxBadgeTextExempt: {
    color: colors.textMuted,
  },
  breakdownCard: {
    backgroundColor: colors.primaryBgSubtle,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  breakdownTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  breakdownLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  breakdownLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  breakdownExplainer: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  breakdownValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  breakdownValuePositive: {
    color: colors.success,
  },
  breakdownValueNegative: {
    color: colors.error,
  },
  breakdownTotal: {
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
  learnMore: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  tryButton: {
    backgroundColor: colors.info,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  editCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  editTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  currencyInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  currencyInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm + 2,
  },
  taxToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  taxToggleActive: {
    backgroundColor: colors.successBgSubtle,
    borderColor: colors.success,
  },
  taxToggleText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  taxToggleTextActive: {
    color: colors.success,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  editActionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  editActionText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  editActionTextPrimary: {
    color: colors.textOnPrimary,
  },
  actions: {
    gap: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
});
