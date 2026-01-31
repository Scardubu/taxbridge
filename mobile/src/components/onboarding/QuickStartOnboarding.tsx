/**
 * QuickStartOnboarding Component
 * 
 * Phase 7: Modular 4-5 step onboarding with personalization
 * 
 * Features:
 * - Reduced to 4 essential steps (profile → tax basics → quiz → summary)
 * - Quick questionnaire for personalization
 * - Interactive quiz with haptic feedback
 * - Progress indicator with animations
 * - Skip with "Remind Me Later" notification scheduling
 * - Summary recap on completion
 */

import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import {
  trackOnboardingStep,
  trackPersonalization,
  trackQuizScore,
} from '../../services/analytics';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

export type QuickStartStep = 'personalize' | 'taxBasics' | 'quiz' | 'summary';

interface PersonalizationAnswer {
  businessType: 'sole_prop' | 'registered' | 'considering' | null;
  sector: 'retail' | 'services' | 'manufacturing' | 'tech' | 'other' | null;
  taxExperience: 'none' | 'basic' | 'experienced' | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string; correct: boolean }[];
}

interface QuickStartOnboardingProps {
  onComplete: (answers: PersonalizationAnswer, quizScore: number) => void;
  onSkip: (remindLater: boolean) => void;
  isLoading?: boolean;
}

// ============================================================================
// Quiz Questions
// ============================================================================

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'pit_threshold',
    question: 'onboarding.quiz.pitThreshold',
    options: [
      { id: 'a', text: 'onboarding.quiz.pitThresholdA', correct: false },
      { id: 'b', text: 'onboarding.quiz.pitThresholdB', correct: true },
      { id: 'c', text: 'onboarding.quiz.pitThresholdC', correct: false },
    ],
  },
  {
    id: 'vat_registration',
    question: 'onboarding.quiz.vatRegistration',
    options: [
      { id: 'a', text: 'onboarding.quiz.vatRegistrationA', correct: false },
      { id: 'b', text: 'onboarding.quiz.vatRegistrationB', correct: true },
      { id: 'c', text: 'onboarding.quiz.vatRegistrationC', correct: false },
    ],
  },
  {
    id: 'invoice_requirement',
    question: 'onboarding.quiz.invoiceRequirement',
    options: [
      { id: 'a', text: 'onboarding.quiz.invoiceRequirementA', correct: true },
      { id: 'b', text: 'onboarding.quiz.invoiceRequirementB', correct: false },
      { id: 'c', text: 'onboarding.quiz.invoiceRequirementC', correct: false },
    ],
  },
];

// ============================================================================
// Step Components
// ============================================================================

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

// Personalization Step
const PersonalizationStep = memo(({ 
  onNext, 
  answers, 
  setAnswers 
}: StepProps & { 
  answers: PersonalizationAnswer; 
  setAnswers: React.Dispatch<React.SetStateAction<PersonalizationAnswer>>;
}) => {
  const { t } = useTranslation();

  const businessTypes = [
    { id: 'sole_prop', emoji: '👤', label: t('onboarding.quickStart.soleProp') },
    { id: 'registered', emoji: '🏢', label: t('onboarding.quickStart.registered') },
    { id: 'considering', emoji: '💭', label: t('onboarding.quickStart.considering') },
  ];

  const sectors = [
    { id: 'retail', emoji: '🛒', label: t('onboarding.quickStart.retail') },
    { id: 'services', emoji: '💼', label: t('onboarding.quickStart.services') },
    { id: 'manufacturing', emoji: '🏭', label: t('onboarding.quickStart.manufacturing') },
    { id: 'tech', emoji: '💻', label: t('onboarding.quickStart.tech') },
    { id: 'other', emoji: '📦', label: t('onboarding.quickStart.other') },
  ];

  const handleSelect = useCallback((field: keyof PersonalizationAnswer, value: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => ({ ...prev, [field]: value }));
    trackPersonalization(field, value);
  }, [setAnswers]);

  const canProceed = answers.businessType && answers.sector;

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('onboarding.quickStart.personalizeTitle')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.quickStart.personalizeSubtitle')}</Text>

      {/* Business Type */}
      <View style={styles.questionSection}>
        <Text style={styles.questionLabel}>{t('onboarding.quickStart.businessTypeQ')}</Text>
        <View style={styles.optionsRow}>
          {businessTypes.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.optionChip,
                answers.businessType === type.id && styles.optionChipSelected,
              ]}
              onPress={() => handleSelect('businessType', type.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: answers.businessType === type.id }}
              accessibilityLabel={type.label}
            >
              <Text style={styles.optionEmoji}>{type.emoji}</Text>
              <Text style={[
                styles.optionLabel,
                answers.businessType === type.id && styles.optionLabelSelected,
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sector */}
      <View style={styles.questionSection}>
        <Text style={styles.questionLabel}>{t('onboarding.quickStart.sectorQ')}</Text>
        <View style={styles.optionsGrid}>
          {sectors.map(sector => (
            <TouchableOpacity
              key={sector.id}
              style={[
                styles.optionChip,
                styles.optionChipSmall,
                answers.sector === sector.id && styles.optionChipSelected,
              ]}
              onPress={() => handleSelect('sector', sector.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: answers.sector === sector.id }}
              accessibilityLabel={sector.label}
            >
              <Text style={styles.optionEmojiSmall}>{sector.emoji}</Text>
              <Text style={[
                styles.optionLabelSmall,
                answers.sector === sector.id && styles.optionLabelSelected,
              ]}>
                {sector.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
        onPress={() => {
          if (canProceed) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNext();
          }
        }}
        disabled={!canProceed}
        accessibilityRole="button"
        accessibilityLabel={t('common.continue')}
        accessibilityState={{ disabled: !canProceed }}
      >
        <Text style={styles.continueButtonText}>{t('common.continue')}</Text>
        <Text style={styles.continueButtonIcon}>→</Text>
      </TouchableOpacity>
    </View>
  );
});

PersonalizationStep.displayName = 'PersonalizationStep';

// Tax Basics Step
const TaxBasicsStep = memo(({ onNext, onBack, answers }: StepProps & { answers: PersonalizationAnswer }) => {
  const { t } = useTranslation();

  // Personalized content based on business type
  const getTaxTips = () => {
    switch (answers.businessType) {
      case 'sole_prop':
        return [
          { emoji: '📋', title: t('onboarding.taxBasics.soleProp1Title'), desc: t('onboarding.taxBasics.soleProp1Desc') },
          { emoji: '💰', title: t('onboarding.taxBasics.soleProp2Title'), desc: t('onboarding.taxBasics.soleProp2Desc') },
          { emoji: '📱', title: t('onboarding.taxBasics.soleProp3Title'), desc: t('onboarding.taxBasics.soleProp3Desc') },
        ];
      case 'registered':
        return [
          { emoji: '🏢', title: t('onboarding.taxBasics.registered1Title'), desc: t('onboarding.taxBasics.registered1Desc') },
          { emoji: '📊', title: t('onboarding.taxBasics.registered2Title'), desc: t('onboarding.taxBasics.registered2Desc') },
          { emoji: '🔐', title: t('onboarding.taxBasics.registered3Title'), desc: t('onboarding.taxBasics.registered3Desc') },
        ];
      default:
        return [
          { emoji: '📋', title: t('onboarding.taxBasics.default1Title'), desc: t('onboarding.taxBasics.default1Desc') },
          { emoji: '💰', title: t('onboarding.taxBasics.default2Title'), desc: t('onboarding.taxBasics.default2Desc') },
          { emoji: '📱', title: t('onboarding.taxBasics.default3Title'), desc: t('onboarding.taxBasics.default3Desc') },
        ];
    }
  };

  const tips = getTaxTips();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('onboarding.taxBasics.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.taxBasics.subtitle')}</Text>

      {/* Tax Tips Cards */}
      <View style={styles.tipsContainer}>
        {tips.map((tip, index) => (
          <Animated.View
            key={index}
            entering={FadeIn.delay(index * 100)}
            style={styles.tipCard}
          >
            <Text style={styles.tipEmoji}>{tip.emoji}</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDesc}>{tip.desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNext();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.continue')}
        >
          <Text style={styles.continueButtonText}>{t('common.continue')}</Text>
          <Text style={styles.continueButtonIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

TaxBasicsStep.displayName = 'TaxBasicsStep';

// Quiz Step
const QuizStep = memo(({ 
  onNext, 
  onBack,
  quizScore,
  setQuizScore,
}: StepProps & {
  quizScore: number;
  setQuizScore: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const question = QUIZ_QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length - 1;

  const handleAnswerSelect = useCallback((optionId: string, correct: boolean) => {
    if (showFeedback) return;

    setSelectedAnswer(optionId);
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuizScore(prev => prev + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Auto-advance after feedback
    setTimeout(() => {
      if (isLastQuestion) {
        trackQuizScore('onboarding_quiz', quizScore + (correct ? 1 : 0), QUIZ_QUESTIONS.length);
        onNext();
      } else {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      }
    }, 1500);
  }, [showFeedback, isLastQuestion, quizScore, setQuizScore, onNext]);

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('onboarding.quiz.title')}</Text>
      <Text style={styles.stepSubtitle}>
        {t('onboarding.quiz.questionOf', { current: currentQuestion + 1, total: QUIZ_QUESTIONS.length })}
      </Text>

      {/* Progress */}
      <View style={styles.quizProgress}>
        {QUIZ_QUESTIONS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.quizDot,
              index < currentQuestion && styles.quizDotCompleted,
              index === currentQuestion && styles.quizDotActive,
            ]}
          />
        ))}
      </View>

      {/* Question */}
      <View style={styles.quizCard}>
        <Text style={styles.quizQuestion}>{t(question.question)}</Text>

        <View style={styles.quizOptions}>
          {question.options.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.quizOption,
                selectedAnswer === option.id && styles.quizOptionSelected,
                showFeedback && option.correct && styles.quizOptionCorrect,
                showFeedback && selectedAnswer === option.id && !option.correct && styles.quizOptionWrong,
              ]}
              onPress={() => handleAnswerSelect(option.id, option.correct)}
              disabled={showFeedback}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedAnswer === option.id }}
              accessibilityLabel={t(option.text)}
            >
              <Text style={[
                styles.quizOptionText,
                selectedAnswer === option.id && styles.quizOptionTextSelected,
              ]}>
                {t(option.text)}
              </Text>
              {showFeedback && option.correct && (
                <Text style={styles.quizOptionIcon}>✓</Text>
              )}
              {showFeedback && selectedAnswer === option.id && !option.correct && (
                <Text style={styles.quizOptionIcon}>✗</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback */}
        {showFeedback && (
          <Animated.View entering={FadeIn} style={[
            styles.quizFeedback,
            isCorrect ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong,
          ]}>
            <Text style={styles.quizFeedbackText}>
              {isCorrect ? t('onboarding.quiz.correct') : t('onboarding.quiz.incorrect')}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>{t('onboarding.quiz.score')}</Text>
        <Text style={styles.scoreValue}>{quizScore}/{currentQuestion + (showFeedback ? 1 : 0)}</Text>
      </View>

      {/* Back button */}
      {onBack && currentQuestion === 0 && !showFeedback && (
        <TouchableOpacity
          style={styles.backButtonFloating}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

QuizStep.displayName = 'QuizStep';

// Summary Step
const SummaryStep = memo(({ 
  onComplete, 
  answers, 
  quizScore 
}: { 
  onComplete: () => void;
  answers: PersonalizationAnswer;
  quizScore: number;
}) => {
  const { t } = useTranslation();
  const percentage = Math.round((quizScore / QUIZ_QUESTIONS.length) * 100);

  const getScoreEmoji = () => {
    if (percentage >= 80) return '🎉';
    if (percentage >= 50) return '👍';
    return '📚';
  };

  const getScoreMessage = () => {
    if (percentage >= 80) return t('onboarding.summary.scoreExcellent');
    if (percentage >= 50) return t('onboarding.summary.scoreGood');
    return t('onboarding.summary.scoreLearn');
  };

  return (
    <View style={styles.stepContainer}>
      <Animated.View entering={FadeIn.delay(100)} style={styles.summaryHeader}>
        <Text style={styles.summaryEmoji}>{getScoreEmoji()}</Text>
        <Text style={styles.summaryTitle}>{t('onboarding.summary.title')}</Text>
        <Text style={styles.summarySubtitle}>{getScoreMessage()}</Text>
      </Animated.View>

      {/* Results Card */}
      <Animated.View entering={FadeIn.delay(200)} style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('onboarding.summary.businessType')}</Text>
          <Text style={styles.summaryValue}>
            {t(`onboarding.quickStart.${answers.businessType}`)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('onboarding.summary.sector')}</Text>
          <Text style={styles.summaryValue}>
            {t(`onboarding.quickStart.${answers.sector}`)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('onboarding.summary.quizScore')}</Text>
          <View style={styles.scoreChip}>
            <Text style={styles.scoreChipText}>{quizScore}/{QUIZ_QUESTIONS.length}</Text>
          </View>
        </View>
      </Animated.View>

      {/* What's Next */}
      <Animated.View entering={FadeIn.delay(300)} style={styles.nextStepsCard}>
        <Text style={styles.nextStepsTitle}>{t('onboarding.summary.whatsNext')}</Text>
        <View style={styles.nextStep}>
          <Text style={styles.nextStepNumber}>1</Text>
          <Text style={styles.nextStepText}>{t('onboarding.summary.step1')}</Text>
        </View>
        <View style={styles.nextStep}>
          <Text style={styles.nextStepNumber}>2</Text>
          <Text style={styles.nextStepText}>{t('onboarding.summary.step2')}</Text>
        </View>
        <View style={styles.nextStep}>
          <Text style={styles.nextStepNumber}>3</Text>
          <Text style={styles.nextStepText}>{t('onboarding.summary.step3')}</Text>
        </View>
      </Animated.View>

      {/* Get Started Button */}
      <Animated.View entering={FadeIn.delay(400)}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.summary.getStarted')}
        >
          <Text style={styles.getStartedButtonText}>{t('onboarding.summary.getStarted')}</Text>
          <Text style={styles.getStartedButtonIcon}>🚀</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

SummaryStep.displayName = 'SummaryStep';

// ============================================================================
// Main Component
// ============================================================================

function QuickStartOnboarding({ onComplete, onSkip, isLoading }: QuickStartOnboardingProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<QuickStartStep>('personalize');
  const [answers, setAnswers] = useState<PersonalizationAnswer>({
    businessType: null,
    sector: null,
    taxExperience: null,
  });
  const [quizScore, setQuizScore] = useState(0);
  const stepStartTime = useRef(Date.now());

  const steps: QuickStartStep[] = ['personalize', 'taxBasics', 'quiz', 'summary'];
  const currentStepIndex = steps.indexOf(currentStep);

  const progressValue = useSharedValue(0);

  React.useEffect(() => {
    progressValue.value = withSpring((currentStepIndex + 1) / steps.length, {
      damping: 15,
      stiffness: 100,
    });
    stepStartTime.current = Date.now();
  }, [currentStepIndex, steps.length, progressValue]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressValue.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  const handleNext = useCallback(() => {
    const duration = Date.now() - stepStartTime.current;
    trackOnboardingStep(currentStep, true, false, duration);

    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  }, [currentStep, currentStepIndex, steps]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  }, [currentStepIndex, steps]);

  const handleComplete = useCallback(() => {
    onComplete(answers, quizScore);
  }, [answers, quizScore, onComplete]);

  const handleSkip = useCallback((remindLater: boolean) => {
    const duration = Date.now() - stepStartTime.current;
    trackOnboardingStep(currentStep, false, true, duration);
    onSkip(remindLater);
  }, [currentStep, onSkip]);

  const renderStep = () => {
    switch (currentStep) {
      case 'personalize':
        return (
          <PersonalizationStep
            onNext={handleNext}
            answers={answers}
            setAnswers={setAnswers}
          />
        );
      case 'taxBasics':
        return (
          <TaxBasicsStep
            onNext={handleNext}
            onBack={handleBack}
            answers={answers}
          />
        );
      case 'quiz':
        return (
          <QuizStep
            onNext={handleNext}
            onBack={handleBack}
            quizScore={quizScore}
            setQuizScore={setQuizScore}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            onComplete={handleComplete}
            answers={answers}
            quizScore={quizScore}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, progressBarStyle]} />
        </View>
        <Text style={styles.progressText}>
          {t('onboarding.stepOf', { current: currentStepIndex + 1, total: steps.length })}
        </Text>
      </View>

      {/* Skip Button */}
      {currentStep !== 'summary' && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleSkip(true)}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.quickStart.remindLater')}
        >
          <Text style={styles.skipButtonText}>{t('onboarding.quickStart.remindLater')}</Text>
        </TouchableOpacity>
      )}

      {/* Step Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={currentStep}
          entering={SlideInRight.springify().damping(18).stiffness(140)}
          exiting={SlideOutLeft.duration(200)}
        >
          {renderStep()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export default memo(QuickStartOnboarding);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  progressText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  stepContainer: {
    gap: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  questionSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  questionLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: spacing.sm,
  },
  optionChipSmall: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionEmojiSmall: {
    fontSize: 18,
  },
  optionLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  optionLabelSmall: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  continueButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  continueButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  continueButtonIcon: {
    fontSize: typography.size.lg,
    color: colors.textOnPrimary,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  backButtonFloating: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tipsContainer: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  tipEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  tipContent: {
    flex: 1,
    gap: spacing.xs,
  },
  tipTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  tipDesc: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  quizProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  quizDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderSubtle,
  },
  quizDotActive: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.2 }],
  },
  quizDotCompleted: {
    backgroundColor: colors.success,
  },
  quizCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  quizQuestion: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  quizOptions: {
    gap: spacing.sm,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quizOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  quizOptionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successBgSubtle,
  },
  quizOptionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorBgSubtle,
  },
  quizOptionText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  quizOptionTextSelected: {
    color: colors.textPrimary,
    fontWeight: typography.weight.medium,
  },
  quizOptionIcon: {
    fontSize: 20,
    fontWeight: typography.weight.bold,
  },
  quizFeedback: {
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  quizFeedbackCorrect: {
    backgroundColor: colors.successBgSubtle,
  },
  quizFeedbackWrong: {
    backgroundColor: colors.errorBgSubtle,
  },
  quizFeedbackText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  scoreLabel: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  scoreValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  summaryHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryEmoji: {
    fontSize: 64,
  },
  summaryTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  scoreChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  scoreChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  nextStepsCard: {
    backgroundColor: colors.indigoBg,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.indigoBorder,
    gap: spacing.md,
  },
  nextStepsTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.indigo,
    color: colors.textOnPrimary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  nextStepText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  getStartedButtonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  getStartedButtonIcon: {
    fontSize: 24,
  },
});
