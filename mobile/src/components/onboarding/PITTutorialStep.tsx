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
import { calculateFullPIT } from '../../utils/taxCalculator';

const { width } = Dimensions.get('window');

interface Props {
  onNext: () => void;
}

// Enhanced quiz with more user-friendly questions
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: 'If someone earns ₦200,000 per year, how much PIT do they pay?',
    options: [
      { value: 'a', label: '₦0 (Tax Free!)', emoji: '🎉', isCorrect: true },
      { value: 'b', label: '₦14,000', emoji: '💰', isCorrect: false },
      { value: 'c', label: '₦20,000', emoji: '📊', isCorrect: false },
    ],
    explanation: 'Great! Income below ₦300,000 is tax-exempt under Nigerian law. This protects low-income earners! 🇳🇬',
    wrongExplanation: 'Actually, income below ₦300,000 is completely tax-free! Nigeria\'s tax law protects low-income earners.',
  },
];

// Income level presets for quick selection
const INCOME_PRESETS = [
  { label: 'Market Trader', value: '600000', emoji: '🏪', description: '~₦50K/month' },
  { label: 'Small Business', value: '1500000', emoji: '🏢', description: '~₦125K/month' },
  { label: 'Professional', value: '3600000', emoji: '💼', description: '~₦300K/month' },
  { label: 'Custom Amount', value: 'custom', emoji: '✏️', description: 'Enter your own' },
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
          <Text style={styles.heroTitle}>Personal Income Tax (PIT)</Text>
          <Text style={styles.heroSubtitle}>
            Let's demystify how your income tax works in Nigeria
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>💡 Did you know?</Text>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>✅</Text>
            <Text style={styles.factText}>
              If you earn less than <Text style={styles.highlight}>₦300,000/year</Text>, you pay <Text style={styles.highlightGreen}>₦0 tax!</Text>
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>📊</Text>
            <Text style={styles.factText}>
              Nigeria uses a <Text style={styles.highlight}>progressive tax system</Text> - higher earners pay higher rates
            </Text>
          </View>
          <View style={styles.factItem}>
            <Text style={styles.factEmoji}>🏠</Text>
            <Text style={styles.factText}>
              Your <Text style={styles.highlight}>rent payments</Text> can reduce your taxable income!
            </Text>
          </View>
        </View>

        <View style={styles.taxBandsPreview}>
          <Text style={styles.taxBandsTitle}>🎯 Nigerian Tax Bands (2025)</Text>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.bandPreviewText}>First ₦300K → <Text style={styles.bandRate}>0%</Text></Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.bandPreviewText}>Next ₦300K → <Text style={styles.bandRate}>7%</Text></Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.bandPreviewText}>Next ₦500K → <Text style={styles.bandRate}>11%</Text></Text>
          </View>
          <View style={styles.bandPreviewRow}>
            <View style={[styles.bandDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.bandPreviewText}>Above ₦3.2M → <Text style={styles.bandRate}>24%</Text></Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleStartCalculator}>
          <Text style={styles.primaryButtonText}>🧮 Try the Calculator</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewQuiz}>
          <Text style={styles.secondaryButtonText}>📝 Take a Quick Quiz</Text>
        </TouchableOpacity>

        <Text style={styles.timeEstimate}>⏱️ 2-3 minutes</Text>
      </ScrollView>
    );
  }

  // Calculator screen with presets
  if (step === 'calculator') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('intro')}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>📊 Calculate Your PIT</Text>
        <Text style={styles.subtitle}>Select your income level or enter a custom amount</Text>

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
            <Text style={styles.inputLabel}>Enter your annual income</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 2,400,000"
                value={grossIncome}
                onChangeText={setGrossIncome}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        )}

        {/* Optional deductions (collapsible) */}
        {selectedPreset && (
          <View style={styles.deductionsCard}>
            <Text style={styles.deductionsTitle}>💰 Add Deductions (Optional)</Text>
            <Text style={styles.deductionsHint}>These reduce your taxable income</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Annual Rent Paid</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0"
                  value={rent}
                  onChangeText={setRent}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pension Contribution</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0"
                  value={pension}
                  onChangeText={setPension}
                  placeholderTextColor="#9CA3AF"
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
            {disableCalculate ? 'Select income first' : '🎯 Calculate My Tax'}
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
          <Text style={styles.backButtonText}>← Recalculate</Text>
        </TouchableOpacity>

        <View style={styles.resultsHero}>
          <Text style={styles.resultsHeroTitle}>Your Estimated PIT</Text>
          <Text style={styles.resultsHeroValue}>{formatCurrency(pitResult.estimatedTax)}</Text>
          {pitResult.isExempt && (
            <View style={styles.exemptBadgeLarge}>
              <Text style={styles.exemptBadgeText}>🎉 Tax Free!</Text>
            </View>
          )}
          <Text style={styles.resultsHeroSubtext}>
            per year on {formatCurrency(pitResult.grossIncome)} income
          </Text>
        </View>

        {/* Visual breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>📊 How it's calculated</Text>
          
          <View style={styles.breakdownVisual}>
            <View style={styles.breakdownBar}>
              <View style={[styles.breakdownSegment, { 
                flex: pitResult.chargeableIncome / Math.max(pitResult.grossIncome, 1),
                backgroundColor: '#0B5FFF' 
              }]} />
              <View style={[styles.breakdownSegment, { 
                flex: (pitResult.grossIncome - pitResult.chargeableIncome) / Math.max(pitResult.grossIncome, 1),
                backgroundColor: '#10B981' 
              }]} />
            </View>
            <View style={styles.breakdownLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0B5FFF' }]} />
                <Text style={styles.legendText}>Taxable: {formatCurrency(pitResult.chargeableIncome)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Deductions: {formatCurrency(pitResult.grossIncome - pitResult.chargeableIncome)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.deductionsList}>
            <BreakdownRow label="Gross Income" value={pitResult.grossIncome} />
            <BreakdownRow label="Rent Relief" value={-pitResult.deductions.rentRelief} isDeduction />
            <BreakdownRow label="NHF (2.5%)" value={-pitResult.deductions.nhf} isDeduction />
            <BreakdownRow label="Pension" value={-pitResult.deductions.pension} isDeduction />
            <BreakdownRow label="NHIS (5%)" value={-pitResult.deductions.nhis} isDeduction />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxable Income</Text>
              <Text style={styles.totalValue}>{formatCurrency(pitResult.chargeableIncome)}</Text>
            </View>
          </View>
        </View>

        {/* Tax bands applied */}
        <View style={styles.bandsCard}>
          <Text style={styles.bandsCardTitle}>📈 Tax Bands Applied</Text>
          {pitResult.breakdown.map((band, index) => (
            <View key={`band-${index}`} style={styles.bandRowEnhanced}>
              <View style={styles.bandInfo}>
                <View style={[styles.bandColorDot, { backgroundColor: getBandColor(band.rate) }]} />
                <Text style={styles.bandRateText}>{(band.rate * 100).toFixed(0)}%</Text>
              </View>
              <View style={styles.bandAmount}>
                <Text style={styles.bandAmountText}>on {formatCurrency(band.amount)}</Text>
                <Text style={styles.bandTaxText}>= {formatCurrency(band.amount * band.rate)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('quiz')}>
          <Text style={styles.primaryButtonText}>📝 Take the Quiz</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onNext}>
          <Text style={styles.secondaryButtonText}>Continue →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Quiz screen
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => setStep(pitResult ? 'results' : 'intro')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.quizHero}>
        <Text style={styles.quizHeroEmoji}>🧠</Text>
        <Text style={styles.quizHeroTitle}>Quick Quiz</Text>
        <Text style={styles.quizHeroSubtitle}>Test what you've learned!</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionNumber}>Question 1 of 1</Text>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>

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
          <Text style={styles.primaryButtonText}>Continue to Next Step →</Text>
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
  if (rate === 0) return '#10B981';
  if (rate <= 0.07) return '#3B82F6';
  if (rate <= 0.11) return '#F59E0B';
  if (rate <= 0.15) return '#F97316';
  if (rate <= 0.19) return '#EF4444';
  if (rate <= 0.21) return '#DC2626';
  return '#991B1B';
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
