import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { calculateFullPIT, PIT_BANDS } from '../../utils/taxCalculator';
import { colors, radii, spacing, typography } from '../../theme/tokens';

const { width } = Dimensions.get('window');

interface Props {
  onNext: () => void;
}

// Enhanced quiz with more user-friendly questions
// Quiz questions now use i18n keys
const getQuizQuestions = (t: any) => [
  {
    id: 1,
    question: t('onboarding.pitTutorial.quizQuestion'),
    options: [
      { value: 'a', label: t('onboarding.pitTutorial.quizOptionA'), emoji: '🎉', isCorrect: true },
      { value: 'b', label: t('onboarding.pitTutorial.quizOptionB'), emoji: '💰', isCorrect: false },
      { value: 'c', label: t('onboarding.pitTutorial.quizOptionC'), emoji: '📊', isCorrect: false },
    ],
    explanation: t('onboarding.pitTutorial.quizCorrect'),
    wrongExplanation: t('onboarding.pitTutorial.quizWrong'),
  },
];

// Income level presets for quick selection (now with i18n support)
const getIncomePresets = (t: any) => [
  { label: t('onboarding.pitTutorial.presetMarket'), value: '600000', emoji: '🏪', description: t('onboarding.pitTutorial.presetMarketDesc') },
  { label: t('onboarding.pitTutorial.presetBusiness'), value: '1500000', emoji: '🏢', description: t('onboarding.pitTutorial.presetBusinessDesc') },
  { label: t('onboarding.pitTutorial.presetProfessional'), value: '3600000', emoji: '💼', description: t('onboarding.pitTutorial.presetProfessionalDesc') },
  { label: t('onboarding.pitTutorial.presetCustom'), value: 'custom', emoji: '✏️', description: t('onboarding.pitTutorial.presetCustomDesc') },
];

export default function PITTutorialStep({ onNext }: Props) {
  const { t } = useTranslation();
  const { addCalculatorEntry, unlockAchievement } = useOnboarding();

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [grossIncome, setGrossIncome] = useState('');
  const [rent, setRent] = useState('');
  const [pension, setPension] = useState('');
  const [pitResult, setPitResult] = useState<ReturnType<typeof calculateFullPIT> | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const [step, setStep] = useState<'intro' | 'calculator' | 'results' | 'quiz'>('intro');

  const QUIZ_QUESTIONS = getQuizQuestions(t);
  const INCOME_PRESETS = getIncomePresets(t);
  const currentQuestion = QUIZ_QUESTIONS[0];
  const disableCalculate = useMemo(() => grossIncome.trim().length === 0, [grossIncome]);

  const handlePresetSelect = (preset: typeof INCOME_PRESETS[0]) => {
    setSelectedPreset(preset.value);
    if (preset.value !== 'custom') {
      setGrossIncome(preset.value);
    } else {
      setGrossIncome('');
    }
  };

  const handleCalculate = async () => {
    const input = {
      grossIncome: parseFloat(grossIncome) || 0,
      annualRent: parseFloat(rent) || 0,
      pensionContribution: parseFloat(pension) || 0,
    };

    const result = calculateFullPIT(input);

    await addCalculatorEntry({
      grossIncome: input.grossIncome,
      rent: input.annualRent,
      pension: input.pensionContribution,
      nhf: result.deductions.nhf,
      nhis: result.deductions.nhis,
      chargeableIncome: result.chargeableIncome,
      estimatedTax: result.estimatedTax,
      isExempt: result.isExempt,
      timestamp: new Date().toISOString(),
    });

    await unlockAchievement('first_calculator');
    if (result.isExempt) {
      await unlockAchievement('pit_exempt');
    }

    setPitResult(result);
    setStep('results');
  };

  const handleQuizAnswer = async (answer: string) => {
    setQuizAnswer(answer);
    setShowQuizFeedback(true);
    
    const isCorrect = currentQuestion.options.find(o => o.value === answer)?.isCorrect;
    if (isCorrect) {
      await unlockAchievement('quiz_master');
    }
  };

  const handleStartCalculator = () => {
    setStep('calculator');
  };

  const handleViewQuiz = () => {
    setStep('quiz');
  };

  // Intro screen with friendly explanation
  if (step === 'intro') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🧮</Text>
          <Text style={styles.heroTitle}>{t('onboarding.pitTutorial.title')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('onboarding.pitTutorial.subtitle')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{t('onboarding.pitTutorial.didYouKnow')}</Text>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>✅</Text>
            <Text style={styles.factText}>
              {t('onboarding.pitTutorial.fact1')}
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>📊</Text>
            <Text style={styles.factText}>
              {t('onboarding.pitTutorial.fact2')}
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>🏠</Text>
            <Text style={styles.factText}>
              {t('onboarding.pitTutorial.fact3')}
            </Text>
          </View>
        </View>

        <View style={styles.taxBandsPreview}>
          <Text style={styles.taxBandsTitle}>{t('onboarding.pitTutorial.taxBandsTitle')}</Text>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: colors.success }]} />
            <Text style={styles.bandPreviewText}>{t('tutorial.bandExempt')}</Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: colors.info }]} />
            <Text style={styles.bandPreviewText}>{t('tutorial.band1')}</Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.bandPreviewText}>{t('tutorial.band2')}</Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: colors.error }]} />
            <Text style={styles.bandPreviewText}>{t('tutorial.band3')}</Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: colors.neutralDark }]} />
            <Text style={styles.bandPreviewText}>{t('tutorial.band4')}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleStartCalculator}>
          <Text style={styles.primaryButtonText}>{t('onboarding.pitTutorial.tryCalculator')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewQuiz}>
          <Text style={styles.secondaryButtonText}>{t('onboarding.pitTutorial.takeQuiz')}</Text>
        </TouchableOpacity>

        <Text style={styles.timeEstimate}>{t('onboarding.pitTutorial.timeEstimate')}</Text>
      </ScrollView>
    );
  }

  // Calculator screen with presets
  if (step === 'calculator') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('intro')}>
          <Text style={styles.backButtonText}>{t('onboarding.pitTutorial.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('onboarding.pitTutorial.calculateTitle')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.pitTutorial.calculateSubtitle')}</Text>

        {/* Income Presets */}
        <View style={styles.presetsContainer}>
          {INCOME_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.value}
              style={[
                styles.presetCard,
                selectedPreset === preset.value && styles.presetCardSelected,
              ]}
              onPress={() => handlePresetSelect(preset)}
            >
              <Text style={styles.presetEmoji}>{preset.emoji}</Text>
              <Text style={styles.presetLabel}>{preset.label}</Text>
              <Text style={styles.presetDescription}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom input if selected */}
        {selectedPreset === 'custom' && (
          <View style={styles.customInputCard}>
            <Text style={styles.inputLabel}>{t('onboarding.pitTutorial.enterIncome')}</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={t('placeholders.incomeExample')}
                value={grossIncome}
                onChangeText={setGrossIncome}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}

        {/* Optional deductions (collapsible) */}
        {selectedPreset && (
          <View style={styles.deductionsCard}>
            <Text style={styles.deductionsTitle}>{t('onboarding.pitTutorial.addDeductions')}</Text>
            <Text style={styles.deductionsHint}>{t('onboarding.pitTutorial.deductionsHint')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('onboarding.pitTutorial.annualRent')}</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder={t('placeholders.zero')}
                  value={rent}
                  onChangeText={setRent}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('onboarding.pitTutorial.pensionContribution')}</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder={t('placeholders.zero')}
                  value={pension}
                  onChangeText={setPension}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.calculateButton, disableCalculate && styles.calculateButtonDisabled]}
          onPress={handleCalculate}
          disabled={disableCalculate}
        >
          <Text style={styles.calculateButtonText}>
            {disableCalculate ? t('onboarding.pitTutorial.selectIncome') : t('onboarding.pitTutorial.calculateTax')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Results screen with visual breakdown
  if (step === 'results' && pitResult) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('calculator')}>
          <Text style={styles.backButtonText}>{t('onboarding.pitTutorial.recalculate')}</Text>
        </TouchableOpacity>

        <View style={styles.resultsHero}>
          <Text style={styles.resultsHeroTitle}>{t('onboarding.pitTutorial.estimatedPIT')}</Text>
          <Text style={styles.resultsHeroValue}>{formatCurrency(pitResult.estimatedTax)}</Text>
          {pitResult.isExempt && (
            <View style={styles.exemptBadgeLarge}>
              <Text style={styles.exemptBadgeText}>{t('onboarding.pitTutorial.taxFree')}</Text>
            </View>
          )}
          <Text style={styles.resultsHeroSubtext}>
            {t('onboarding.pitTutorial.perYear', { income: formatCurrency(pitResult.grossIncome) })}
          </Text>
        </View>

        {/* Visual breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>{t('onboarding.pitTutorial.howCalculated')}</Text>
          
          <View style={styles.breakdownVisual}>
            <View style={styles.breakdownBar}>
              <View style={[styles.breakdownSegment, { 
                flex: pitResult.chargeableIncome / Math.max(pitResult.grossIncome, 1),
                backgroundColor: colors.primary 
              }]} />
              <View style={[styles.breakdownSegment, { 
                flex: (pitResult.grossIncome - pitResult.chargeableIncome) / Math.max(pitResult.grossIncome, 1),
                backgroundColor: colors.success 
              }]} />
            </View>
            <View style={styles.breakdownLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>{t('onboarding.pitTutorial.taxable', { amount: formatCurrency(pitResult.chargeableIncome) })}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>{t('onboarding.pitTutorial.deductions', { amount: formatCurrency(pitResult.grossIncome - pitResult.chargeableIncome) })}</Text>
              </View>
            </View>
          </View>

          <View style={styles.deductionsList}>
            <BreakdownRow label={t('tutorial.grossIncome')} value={pitResult.grossIncome} />
            <BreakdownRow label={t('tutorial.rentRelief')} value={-pitResult.deductions.rentRelief} isDeduction />
            <BreakdownRow label={t('tutorial.nhf')} value={-pitResult.deductions.nhf} isDeduction />
            <BreakdownRow label={t('tutorial.pension')} value={-pitResult.deductions.pension} isDeduction />
            <BreakdownRow label={t('tutorial.nhis')} value={-pitResult.deductions.nhis} isDeduction />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('tutorial.taxableIncome')}</Text>
              <Text style={styles.totalValue}>{formatCurrency(pitResult.chargeableIncome)}</Text>
            </View>
          </View>
        </View>

        {/* Tax bands applied */}
        <View style={styles.bandsCard}>
          <Text style={styles.bandsCardTitle}>{t('onboarding.pitTutorial.taxBandsApplied')}</Text>
          {pitResult.breakdown.map((band, index) => (
            <View key={`band-${index}`} style={styles.bandRowEnhanced}>
              <View style={styles.bandInfo}>
                <View style={[styles.bandColorDot, { backgroundColor: getBandColor(band.rate) }]} />
                <Text style={styles.bandRateText}>{(band.rate * 100).toFixed(0)}%</Text>
              </View>
              <View style={styles.bandAmount}>
                <Text style={styles.bandAmountText}>{t('onboarding.pitTutorial.on', { amount: formatCurrency(band.amount) })}</Text>
                <Text style={styles.bandTaxText}>= {formatCurrency(band.amount * band.rate)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('quiz')}>
          <Text style={styles.primaryButtonText}>{t('onboarding.pitTutorial.takeQuiz')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onNext}>
          <Text style={styles.secondaryButtonText}>{t('onboarding.pitTutorial.continue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Quiz screen
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => setStep(pitResult ? 'results' : 'intro')}>
        <Text style={styles.backButtonText}>{t('onboarding.pitTutorial.back')}</Text>
      </TouchableOpacity>

      <View style={styles.quizHero}>
        <Text style={styles.quizHeroEmoji}>🧠</Text>
        <Text style={styles.quizHeroTitle}>{t('onboarding.pitTutorial.quickQuiz')}</Text>
        <Text style={styles.quizHeroSubtitle}>{t('onboarding.pitTutorial.testLearning')}</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionNumber}>{t('onboarding.pitTutorial.questionNumber')}</Text>
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => {
            const isSelected = quizAnswer === option.value;
            const showCorrect = showQuizFeedback && option.isCorrect;
            const showWrong = showQuizFeedback && isSelected && !option.isCorrect;
            
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  isSelected && !showQuizFeedback && styles.optionSelected,
                  showCorrect && styles.optionCorrect,
                  showWrong && styles.optionWrong,
                ]}
                onPress={() => handleQuizAnswer(option.value)}
                disabled={showQuizFeedback}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text style={[
                  styles.optionText,
                  showCorrect && styles.optionTextCorrect,
                  showWrong && styles.optionTextWrong,
                ]}>
                  {option.label}
                </Text>
                {showCorrect && <Text style={styles.checkmark}>✓</Text>}
                {showWrong && <Text style={styles.crossmark}>✗</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {showQuizFeedback && (
          <View style={[
            styles.feedbackCard,
            quizAnswer === 'a' ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}>
            <Text style={styles.feedbackEmoji}>
              {quizAnswer === 'a' ? '🎉' : '💡'}
            </Text>
            <Text style={styles.feedbackText}>
              {quizAnswer === 'a' 
                ? currentQuestion.explanation 
                : currentQuestion.wrongExplanation}
            </Text>
          </View>
        )}
      </View>

      {showQuizFeedback && (
        <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>{t('onboarding.pitTutorial.continueNext')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Helper components
function BreakdownRow({ label, value, isDeduction }: { label: string; value: number; isDeduction?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, isDeduction && value !== 0 && styles.deductionValue]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function getBandColor(rate: number): string {
  // Map tax rates to design tokens (PRD-aligned: 0%, 15%, 19%, 21%, 25%)
  if (rate === 0) return colors.success;       // Green for exempt
  if (rate <= 0.15) return colors.info;        // Blue for 15%
  if (rate <= 0.19) return colors.warning;     // Amber for 19%
  if (rate <= 0.21) return colors.error;       // Red for 21%
  return colors.neutralDark;                   // Dark gray for 25%
}

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₦${Math.abs(amount).toLocaleString('en-NG')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  heroEmoji: {
    fontSize: typography.size.xxxl * 2,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.size.xxl + spacing.xxs,
    fontWeight: typography.weight.extrabold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  // Info card
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  infoCardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  factEmoji: {
    fontSize: typography.size.lg,
    marginRight: spacing.md,
    marginTop: spacing.xxs,
  },
  factText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: spacing.xl + spacing.xxs,
  },
  highlight: {
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  highlightGreen: {
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  // Tax bands preview
  taxBandsPreview: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  taxBandsTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bandPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bandDot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: spacing.xs + spacing.xxs,
    marginRight: spacing.md,
  },
  bandPreviewText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  bandRate: {
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  timeEstimate: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  // Calculator
  title: {
    fontSize: typography.size.xl + spacing.xs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    lineHeight: spacing.xl + spacing.xxs,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  presetCard: {
    width: (width - 52) / 2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  presetCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  presetEmoji: {
    fontSize: typography.size.xxxl,
    marginBottom: spacing.sm,
  },
  presetLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  presetDescription: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  customInputCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  deductionsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  deductionsTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  deductionsHint: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  calculateButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  calculateButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  calculateButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  // Results
  resultsHero: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    marginBottom: spacing.xl,
  },
  resultsHeroTitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  resultsHeroValue: {
    fontSize: typography.size.xxxl + typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  resultsHeroSubtext: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  exemptBadgeLarge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl - spacing.xs,
    marginBottom: spacing.sm,
  },
  exemptBadgeText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  breakdownTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  breakdownVisual: {
    marginBottom: spacing.lg,
  },
  breakdownBar: {
    flexDirection: 'row',
    height: spacing.md,
    borderRadius: spacing.xs + spacing.xxs,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  breakdownSegment: {
    height: '100%',
  },
  breakdownLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: spacing.sm + spacing.xxs,
    height: spacing.sm + spacing.xxs,
    borderRadius: spacing.xs + spacing.xxs,
    marginRight: spacing.xs + spacing.xxs,
  },
  legendText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  deductionsList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  breakdownLabel: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  breakdownValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  deductionValue: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  // Bands card
  bandsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bandsCardTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bandRowEnhanced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + spacing.xxs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSecondary,
  },
  bandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bandColorDot: {
    width: typography.size.sm,
    height: typography.size.sm,
    borderRadius: spacing.xs + spacing.xxs,
    marginRight: spacing.sm + spacing.xxs,
  },
  bandRateText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
  },
  bandAmount: {
    alignItems: 'flex-end',
  },
  bandAmountText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
  },
  bandTaxText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  // Quiz
  quizHero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
  },
  quizHeroEmoji: {
    fontSize: typography.size.xxl * 2 + spacing.xs,
    marginBottom: spacing.md,
  },
  quizHeroTitle: {
    fontSize: typography.size.xl + spacing.xs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  quizHeroSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  questionNumber: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    lineHeight: typography.size.xxl,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  optionEmoji: {
    fontSize: typography.size.xl + spacing.xs,
    marginRight: spacing.md,
  },
  optionText: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  optionTextCorrect: {
    color: colors.success,
  },
  optionTextWrong: {
    color: colors.error,
  },
  checkmark: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  crossmark: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.error,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  feedbackCorrect: {
    backgroundColor: colors.successBg,
  },
  feedbackWrong: {
    backgroundColor: colors.warningBg,
  },
  feedbackEmoji: {
    fontSize: typography.size.xl + spacing.xs,
    marginRight: spacing.md,
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: spacing.xl,
  },
});
