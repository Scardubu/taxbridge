import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { colors, spacing, radii, typography } from '../../theme/tokens';


interface Props {
  onNext: () => void;
}

// Income source options with emojis for better UX
const INCOME_SOURCES = [
  { value: 'salary', emoji: '💼' },
  { value: 'business', emoji: '🏪' },
  { value: 'investments', emoji: '📈' },
  { value: 'mixed', emoji: '🔀' },
];

// Business type options
const BUSINESS_TYPES = [
  { value: 'sole_prop', emoji: '👤' },
  { value: 'partnership', emoji: '🤝' },
  { value: 'considering_incorporation', emoji: '🏢' },
  { value: 'not_registered', emoji: '📋' },
];

function ProfileAssessmentStep({ onNext }: Props) {
  const { t } = useTranslation();
  const { updateProfile } = useOnboarding();
  
  const [incomeSource, setIncomeSource] = useState<string | null>(null);
  const [annualIncome, setAnnualIncome] = useState('');
  const [annualTurnover, setAnnualTurnover] = useState('');
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const income = parseFloat(annualIncome.replace(/,/g, '')) || 0;
      const turnover = parseFloat(annualTurnover.replace(/,/g, '')) || 0;

      await updateProfile({
        incomeSource: incomeSource as any,
        annualIncome: income,
        annualTurnover: turnover,
        businessType: businessType as any,
        completedAt: new Date().toISOString(),
      });

      onNext();
    } finally {
      setIsSubmitting(false);
    }
  }, [incomeSource, annualIncome, annualTurnover, businessType, isSubmitting, onNext, updateProfile]);

  // Format number with commas for better readability
  const formatNumber = useCallback((value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    return num ? parseInt(num, 10).toLocaleString('en-NG') : '';
  }, []);

  const handleIncomeChange = useCallback((value: string) => {
    setAnnualIncome(formatNumber(value));
  }, [formatNumber]);

  const handleTurnoverChange = useCallback((value: string) => {
    setAnnualTurnover(formatNumber(value));
  }, [formatNumber]);

  const isValid = useMemo(() => {
    const hasIncome = incomeSource && annualIncome;
    const needsBusinessType = incomeSource === 'business' || incomeSource === 'mixed';
    return hasIncome && (!needsBusinessType || businessType);
  }, [incomeSource, annualIncome, businessType]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.profile.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.profile.subtitle')}</Text>

      {/* Income Source */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('onboarding.profile.incomeSource')}</Text>
        <View style={styles.optionsGrid}>
          {INCOME_SOURCES.map((source) => (
            <TouchableOpacity
              key={source.value}
              style={[
                styles.optionButton,
                incomeSource === source.value && styles.optionButtonActive,
              ]}
              onPress={() => setIncomeSource(source.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: incomeSource === source.value }}
            >
              <Text style={styles.optionEmoji}>{source.emoji}</Text>
              <Text
                style={[
                  styles.optionText,
                  incomeSource === source.value && styles.optionTextActive,
                ]}
              >
                {t(`onboarding.profile.${source.value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Annual Income */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('onboarding.profile.annualIncome')}</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>₦</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={t('placeholders.income')}
            placeholderTextColor={colors.disabled}
            value={annualIncome}
            onChangeText={handleIncomeChange}
            accessibilityLabel={t('onboarding.profile.annualIncome')}
          />
        </View>
        <Text style={styles.hint}>{t('onboarding.profile.incomeHint')}</Text>
      </View>

      {/* Show turnover field for business owners */}
      {(incomeSource === 'business' || incomeSource === 'mixed') && (
        <View style={styles.section}>
          <Text style={styles.label}>{t('onboarding.profile.annualTurnover')}</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={t('placeholders.turnover')}
              placeholderTextColor={colors.disabled}
              value={annualTurnover}
              onChangeText={handleTurnoverChange}
              accessibilityLabel={t('onboarding.profile.annualTurnover')}
            />
          </View>
          <Text style={styles.hint}>{t('onboarding.profile.turnoverHint')}</Text>
        </View>
      )}

      {/* Business Type */}
      {(incomeSource === 'business' || incomeSource === 'mixed') && (
        <View style={styles.section}>
          <Text style={styles.label}>{t('onboarding.profile.businessType')}</Text>
          <View style={styles.optionsColumn}>
            {BUSINESS_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.optionButtonColumn,
                  businessType === type.value && styles.optionButtonActive,
                ]}
                onPress={() => setBusinessType(type.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: businessType === type.value }}
              >
                <Text style={styles.optionEmojiColumn}>{type.emoji}</Text>
                <Text
                  style={[
                    styles.optionTextColumn,
                    businessType === type.value && styles.optionTextActive,
                  ]}
                >
                  {t(`onboarding.profile.${type.value === 'sole_prop' ? 'soleProp' : type.value === 'considering_incorporation' ? 'consideringIncorp' : type.value === 'not_registered' ? 'notRegistered' : type.value}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton, 
          !isValid && styles.continueButtonDisabled,
          isSubmitting && styles.continueButtonLoading,
        ]}
        onPress={handleContinue}
        disabled={!isValid || isSubmitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isValid || isSubmitting }}
      >
        <Text style={styles.continueButtonText}>
          {isSubmitting ? '...' : t('onboarding.continue')}
        </Text>
      </TouchableOpacity>

      {/* Estimated time */}
      <Text style={styles.timeEstimate}>{t('onboarding.profile.timeEstimate')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.size.xxl + 2,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.xxl + spacing.sm,
    lineHeight: 24,
  },
  section: {
    marginBottom: spacing.xxl + spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  optionsColumn: {
    gap: spacing.sm,
  },
  optionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    margin: 6,
    minWidth: '45%',
    alignItems: 'center',
  },
  optionButtonColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  optionButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  optionEmojiColumn: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  optionText: {
    fontSize: typography.size.sm - 1,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  optionTextColumn: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
  },
  currencySymbol: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 6,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  continueButtonDisabled: {
    backgroundColor: colors.border,
  },
  continueButtonLoading: {
    opacity: 0.7,
  },
  continueButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  timeEstimate: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

export default memo(ProfileAssessmentStep);
