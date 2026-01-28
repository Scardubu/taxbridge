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
import { colors } from '../../theme/tokens';

const { width } = Dimensions.get('window');

interface Props {
  onNext: () => void;
}

// Enhanced quiz with more user-friendly questions
// Quiz questions now use i18n keys
const getQuizQuestions = (t: any) => [
  {
    id: 1,
    question: t('pitTutorial.quizQuestion'),
    options: [
      { value: 'a', label: t('pitTutorial.quizOptionA'), emoji: '🎉', isCorrect: true },
      { value: 'b', label: t('pitTutorial.quizOptionB'), emoji: '💰', isCorrect: false },
      { value: 'c', label: t('pitTutorial.quizOptionC'), emoji: '📊', isCorrect: false },
    ],
    explanation: t('pitTutorial.quizCorrect'),
    wrongExplanation: t('pitTutorial.quizWrong'),
  },
];

// Income level presets for quick selection (now with i18n support)
const getIncomePresets = (t: any) => [
  { label: t('pitTutorial.presetMarket'), value: '600000', emoji: '🏪', description: t('pitTutorial.presetMarketDesc') },
  { label: t('pitTutorial.presetBusiness'), value: '1500000', emoji: '🏢', description: t('pitTutorial.presetBusinessDesc') },
  { label: t('pitTutorial.presetProfessional'), value: '3600000', emoji: '💼', description: t('pitTutorial.presetProfessionalDesc') },
  { label: t('pitTutorial.presetCustom'), value: 'custom', emoji: '✏️', description: t('pitTutorial.presetCustomDesc') },
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
          <Text style={styles.heroTitle}>{t('pitTutorial.title')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('pitTutorial.subtitle')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{t('pitTutorial.didYouKnow')}</Text>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>✅</Text>
            <Text style={styles.factText}>
              {t('pitTutorial.fact1')}
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>📊</Text>
            <Text style={styles.factText}>
              {t('pitTutorial.fact2')}
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>🏠</Text>
            <Text style={styles.factText}>
              {t('pitTutorial.fact3')}
            </Text>
          </View>
        </View>

        <View style={styles.taxBandsPreview}>
          <Text style={styles.taxBandsTitle}>{t('pitTutorial.taxBandsTitle')}</Text>
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
          <Text style={styles.primaryButtonText}>{t('pitTutorial.tryCalculator')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewQuiz}>
          <Text style={styles.secondaryButtonText}>{t('pitTutorial.takeQuiz')}</Text>
        </TouchableOpacity>

        <Text style={styles.timeEstimate}>{t('pitTutorial.timeEstimate')}</Text>
      </ScrollView>
    );
  }

  // Calculator screen with presets
  if (step === 'calculator') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('intro')}>
          <Text style={styles.backButtonText}>{t('pitTutorial.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('pitTutorial.calculateTitle')}</Text>
        <Text style={styles.subtitle}>{t('pitTutorial.calculateSubtitle')}</Text>

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
            <Text style={styles.inputLabel}>{t('pitTutorial.enterIncome')}</Text>
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
            <Text style={styles.deductionsTitle}>{t('pitTutorial.addDeductions')}</Text>
            <Text style={styles.deductionsHint}>{t('pitTutorial.deductionsHint')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('pitTutorial.annualRent')}</Text>
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
              <Text style={styles.inputLabel}>{t('pitTutorial.pensionContribution')}</Text>
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
            {disableCalculate ? t('pitTutorial.selectIncome') : t('pitTutorial.calculateTax')}
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
          <Text style={styles.backButtonText}>{t('pitTutorial.recalculate')}</Text>
        </TouchableOpacity>

        <View style={styles.resultsHero}>
          <Text style={styles.resultsHeroTitle}>{t('pitTutorial.estimatedPIT')}</Text>
          <Text style={styles.resultsHeroValue}>{formatCurrency(pitResult.estimatedTax)}</Text>
          {pitResult.isExempt && (
            <View style={styles.exemptBadgeLarge}>
              <Text style={styles.exemptBadgeText}>{t('pitTutorial.taxFree')}</Text>
            </View>
          )}
          <Text style={styles.resultsHeroSubtext}>
            {t('pitTutorial.perYear', { income: formatCurrency(pitResult.grossIncome) })}
          </Text>
        </View>

        {/* Visual breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>{t('pitTutorial.howCalculated')}</Text>
          
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
                <Text style={styles.legendText}>{t('pitTutorial.taxable', { amount: formatCurrency(pitResult.chargeableIncome) })}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>{t('pitTutorial.deductions', { amount: formatCurrency(pitResult.grossIncome - pitResult.chargeableIncome) })}</Text>
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
          <Text style={styles.bandsCardTitle}>{t('pitTutorial.taxBandsApplied')}</Text>
          {pitResult.breakdown.map((band, index) => (
            <View key={`band-${index}`} style={styles.bandRowEnhanced}>
              <View style={styles.bandInfo}>
                <View style={[styles.bandColorDot, { backgroundColor: getBandColor(band.rate) }]} />
                <Text style={styles.bandRateText}>{(band.rate * 100).toFixed(0)}%</Text>
              </View>
              <View style={styles.bandAmount}>
                <Text style={styles.bandAmountText}>{t('pitTutorial.on', { amount: formatCurrency(band.amount) })}</Text>
                <Text style={styles.bandTaxText}>= {formatCurrency(band.amount * band.rate)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('quiz')}>
          <Text style={styles.primaryButtonText}>{t('pitTutorial.takeQuiz')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onNext}>
          <Text style={styles.secondaryButtonText}>{t('pitTutorial.continue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Quiz screen
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => setStep(pitResult ? 'results' : 'intro')}>
        <Text style={styles.backButtonText}>{t('pitTutorial.back')}</Text>
      </TouchableOpacity>

      <View style={styles.quizHero}>
        <Text style={styles.quizHeroEmoji}>🧠</Text>
        <Text style={styles.quizHeroTitle}>{t('pitTutorial.quickQuiz')}</Text>
        <Text style={styles.quizHeroSubtitle}>{t('pitTutorial.testLearning')}</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionNumber}>{t('pitTutorial.questionNumber')}</Text>
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
          <Text style={styles.primaryButtonText}>{t('pitTutorial.continueNext')}</Text>
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
    paddingHorizontal: 4,
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#101828',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  // Info card
  infoCard: {
    backgroundColor: '#EBF4FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0B5FFF20',
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 16,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  factEmoji: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  factText: {
    flex: 1,
    fontSize: 15,
    color: '#344054',
    lineHeight: 22,
  },
  highlight: {
    fontWeight: '700',
    color: '#0B5FFF',
  },
  highlightGreen: {
    fontWeight: '700',
    color: '#16A34A',
  },
  // Tax bands preview
  taxBandsPreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  taxBandsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 12,
  },
  bandPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  bandPreviewText: {
    fontSize: 14,
    color: '#344054',
  },
  bandRate: {
    fontWeight: '700',
    color: '#0B5FFF',
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#0B5FFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0B5FFF',
    fontWeight: '600',
  },
  timeEstimate: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  // Calculator
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#667085',
    marginBottom: 20,
    lineHeight: 22,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  presetCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E4E7EC',
  },
  presetCardSelected: {
    borderColor: '#0B5FFF',
    backgroundColor: '#EBF4FF',
  },
  presetEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'center',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
  },
  customInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  deductionsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  deductionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 4,
  },
  deductionsHint: {
    fontSize: 13,
    color: '#667085',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#344054',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#101828',
  },
  calculateButton: {
    backgroundColor: '#0B5FFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  calculateButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  calculateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Results
  resultsHero: {
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  resultsHeroTitle: {
    fontSize: 16,
    color: '#667085',
    marginBottom: 8,
  },
  resultsHeroValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#0B5FFF',
    marginBottom: 8,
  },
  resultsHeroSubtext: {
    fontSize: 14,
    color: '#667085',
  },
  exemptBadgeLarge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  exemptBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 16,
  },
  breakdownVisual: {
    marginBottom: 16,
  },
  breakdownBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#667085',
  },
  deductionsList: {
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    paddingTop: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#667085',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#344054',
  },
  deductionValue: {
    color: '#16A34A',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: '#0B5FFF',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101828',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  // Bands card
  bandsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  bandsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 12,
  },
  bandRowEnhanced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bandColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  bandRateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#344054',
  },
  bandAmount: {
    alignItems: 'flex-end',
  },
  bandAmountText: {
    fontSize: 13,
    color: '#667085',
  },
  bandTaxText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5FFF',
  },
  // Quiz
  quizHero: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  quizHeroEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  quizHeroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 4,
  },
  quizHeroSubtitle: {
    fontSize: 15,
    color: '#667085',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0B5FFF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E4E7EC',
  },
  optionSelected: {
    borderColor: '#0B5FFF',
    backgroundColor: '#EBF4FF',
  },
  optionCorrect: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  optionWrong: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  optionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
  },
  optionTextCorrect: {
    color: '#16A34A',
  },
  optionTextWrong: {
    color: '#DC2626',
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16A34A',
  },
  crossmark: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  feedbackCorrect: {
    backgroundColor: '#DCFCE7',
  },
  feedbackWrong: {
    backgroundColor: '#FEF3C7',
  },
  feedbackEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    color: '#344054',
    lineHeight: 20,
  },
});
