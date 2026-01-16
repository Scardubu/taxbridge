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
            placeholder="1,000,000"
            placeholderTextColor="#9CA3AF"
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
              placeholder="50,000,000"
              placeholderTextColor="#9CA3AF"
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
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#667085',
    marginBottom: 32,
    lineHeight: 24,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  optionsColumn: {
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4E7EC',
    margin: 6,
    minWidth: '45%',
    alignItems: 'center',
  },
  optionButtonColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4E7EC',
  },
  optionButtonActive: {
    backgroundColor: '#EBF4FF',
    borderColor: '#0B5FFF',
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  optionEmojiColumn: {
    fontSize: 20,
    marginRight: 12,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#667085',
    textAlign: 'center',
  },
  optionTextColumn: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667085',
  },
  optionTextActive: {
    color: '#0B5FFF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4E7EC',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#344054',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#101828',
  },
  hint: {
    fontSize: 12,
    color: '#667085',
    marginTop: 8,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: '#0B5FFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#D0D5DD',
  },
  continueButtonLoading: {
    opacity: 0.7,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeEstimate: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default memo(ProfileAssessmentStep);
