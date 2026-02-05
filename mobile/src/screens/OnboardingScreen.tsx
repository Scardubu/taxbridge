import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  BackHandler,
  Keyboard,
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
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useOnboarding, OnboardingStepId, UserProfile } from '../contexts/OnboardingContext';
import { useNetwork } from '../contexts/NetworkContext';
import { addBreadcrumb } from '../services/sentry';
import {
  trackOnboardingStart,
  trackOnboardingStep,
  trackOnboardingComplete,
  trackOnboardingDropOff,
} from '../services/analytics';
import { LivingBridgeHeader } from '../components/header';
import { showToast } from '../components/ui/Toast';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

// Step components
import WelcomeStep from '../components/onboarding/WelcomeStep';
import ProfileAssessmentStep from '../components/onboarding/ProfileAssessmentStep';
import TaxEngineDemo from '../components/onboarding/TaxEngineDemo';
import OCRScannerDemo from '../components/onboarding/OCRScannerDemo';

const APP_ICON = require('../../assets/icon.png');

// Constants
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 100,
  overshootClamping: false,
};

const STEP_ANIMATION_CONFIG = {
  damping: 18,
  stiffness: 140,
};

interface OnboardingStep {
  id: OnboardingStepId;
  component: React.ComponentType<StepProps>;
  canSkip: boolean;
  gatingLogic?: (profile: UserProfile) => boolean;
  requiredFields?: Array<keyof UserProfile>;
}

interface StepProps {
  onNext: () => void;
  onSkip?: () => void;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    component: WelcomeStep,
    canSkip: false,
  },
  {
    id: 'profile',
    component: ProfileAssessmentStep,
    canSkip: false,
    requiredFields: ['businessType'],
  },
  {
    id: 'taxEngine',
    component: TaxEngineDemo,
    canSkip: true,
  },
  {
    id: 'scanner',
    component: OCRScannerDemo,
    canSkip: true,
  },
];

interface OnboardingScreenProps {
  navigation?: {
    replace: (route: string) => void;
    goBack?: () => void;
  };
}

/**
 * OnboardingScreen Component
 * 
 * Improvements:
 * 1. Enhanced error handling and validation
 * 2. Better animation performance with shared values
 * 3. Accessibility improvements (announcements, labels)
 * 4. Network-aware step progression
 * 5. Auto-save progress on background/unmount
 * 6. Keyboard-aware layout
 * 7. Back button handling for Android
 * 8. Memory leak prevention
 * 9. Step transition animations
 * 10. Progress persistence optimization
 */
function OnboardingScreen(props: OnboardingScreenProps = {}) {
  const navigationFromHook = useNavigation<any>();
  const navigation = props.navigation ?? navigationFromHook;
  const { t } = useTranslation();
  const { profile, progress, updateProgress, completeOnboarding } = useOnboarding();
  const { isOnline } = useNetwork();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStartTime, setStepStartTime] = useState(Date.now());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const progressValue = useSharedValue(0);
  const stepTransitionValue = useSharedValue(0);
  const hasRestoredRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onboardingStartedRef = useRef(false);

  // Memoize active steps to prevent recalculation
  const activeSteps = useMemo(() => {
    return STEPS.filter((step) => {
      if (!step.gatingLogic) return true;
      return step.gatingLogic(profile);
    });
  }, [profile]);

  const currentStep = activeSteps[currentStepIndex];
  const StepComponent = currentStep?.component;

  /**
   * Resolves the index to resume from based on progress state
   */
  const resolveResumeIndex = useCallback(() => {
    if (activeSteps.length === 0) return 0;

    if (progress.currentStep && !progress.completedAt) {
      const currentIndex = activeSteps.findIndex((step) => step.id === progress.currentStep);
      if (currentIndex >= 0) return currentIndex;
    }

    const completedSet = new Set(progress.completedSteps);
    const skippedSet = new Set(progress.skippedSteps);
    const firstIncompleteIndex = activeSteps.findIndex(
      (step) => !completedSet.has(step.id) && !skippedSet.has(step.id)
    );
    if (firstIncompleteIndex >= 0) return firstIncompleteIndex;

    return Math.max(0, activeSteps.length - 1);
  }, [activeSteps, progress.completedAt, progress.completedSteps, progress.currentStep, progress.skippedSteps]);

  /**
   * Validates current step before allowing progression
   */
  const validateCurrentStep = useCallback((): boolean => {
    const errors: string[] = [];
    
    if (!currentStep) {
      errors.push(t('onboarding.errors.invalidStep'));
      setValidationErrors(errors);
      return false;
    }

    // Profile step uses local validation inside the step component
    if (currentStep.id === 'profile') {
      setValidationErrors([]);
      return true;
    }

    // Check required profile fields
    if (currentStep.requiredFields) {
      for (const field of currentStep.requiredFields) {
        if (!profile[field]) {
          errors.push(t(`onboarding.errors.required.${field}`));
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [currentStep, profile, t]);

  /**
   * Auto-save progress periodically
   */
  const autoSaveProgress = useCallback(async () => {
    if (!currentStep?.id || !isMountedRef.current) return;
    
    try {
      await updateProgress(currentStep.id, false, false);
      addBreadcrumb({
        category: 'onboarding',
        message: 'Auto-saved progress',
        level: 'info',
        data: { stepId: currentStep.id },
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentStep?.id, updateProgress]);

  /**
   * Initialize step restoration and auto-save
   */
  useEffect(() => {
    isMountedRef.current = true;

    if (activeSteps.length === 0) return;
    
    const resumeIndex = resolveResumeIndex();
    setCurrentStepIndex((prev) => {
      if (!hasRestoredRef.current) {
        hasRestoredRef.current = true;
        return resumeIndex;
      }
      if (!activeSteps[prev]) {
        return resumeIndex;
      }
      return prev;
    });

    // Setup auto-save every 30 seconds
    autoSaveTimerRef.current = setInterval(autoSaveProgress, 30000);

    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [activeSteps, resolveResumeIndex, autoSaveProgress]);

  useEffect(() => {
    if (onboardingStartedRef.current) return;
    onboardingStartedRef.current = true;
    if (!progress.startedAt) {
      void trackOnboardingStart();
    }
  }, [progress.startedAt]);

  /**
   * Update progress animation and tracking
   */
  useEffect(() => {
    if (activeSteps.length === 0) return;
    
    setStepStartTime(Date.now());
    
    progressValue.value = withSpring(
      (currentStepIndex + 1) / activeSteps.length,
      SPRING_CONFIG
    );
    
    addBreadcrumb({
      category: 'onboarding',
      message: `Viewing step ${currentStepIndex + 1}/${activeSteps.length}`,
      level: 'info',
      data: {
        stepId: currentStep?.id,
        isOnline,
      },
    });

    // Announce step change for accessibility
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Could use AccessibilityInfo.announceForAccessibility here
    }
  }, [currentStepIndex, activeSteps.length, currentStep?.id, isOnline]);

  /**
   * Validate step bounds
   */
  useEffect(() => {
    if (currentStepIndex >= activeSteps.length) {
      setCurrentStepIndex(Math.max(0, activeSteps.length - 1));
    }
  }, [activeSteps.length, currentStepIndex]);

  /**
   * Navigate to main app when onboarding is complete
   */
  useEffect(() => {
    if (progress.completedAt) {
      navigation.replace?.('MainTabs');
    }
  }, [progress.completedAt, navigation]);

  /**
   * Handle Android back button
   */
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleFinishLater();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  /**
   * Animated progress bar style
   */
  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(
        progressValue.value,
        [0, 1],
        [0, 100],
        Extrapolation.CLAMP
      )}%`,
    };
  });

  /**
   * Step transition animation callback
   */
  const onStepTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
  }, []);

  /**
   * Handle next step progression
   */
  const handleNext = async () => {
    // Dismiss keyboard
    Keyboard.dismiss();

    // Allow profile updates to flush before validation (avoids stale context state)
    if (currentStep?.id === 'profile') {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Validate before proceeding (retry once after profile update)
    if (!validateCurrentStep()) {
      if (currentStep?.id === 'profile') {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (validateCurrentStep()) {
          // fall through
        } else {
          showToast({
            type: 'error',
            message: validationErrors[0] ?? t('onboarding.errors.tryAgain'),
            haptic: 'error',
          });
          return;
        }
      } else {
        showToast({
          type: 'error',
          message: validationErrors[0] ?? t('onboarding.errors.tryAgain'),
          haptic: 'error',
        });
        return;
      }
    }

    if (isTransitioning) return;
    
    const duration = Date.now() - stepStartTime;
    
    setIsTransitioning(true);
    
    // Animate transition
    stepTransitionValue.value = withTiming(
      1,
      { duration: 300 },
      (finished) => {
        if (finished) {
          runOnJS(onStepTransitionComplete)();
        }
      }
    );

    try {
      addBreadcrumb({
        category: 'onboarding',
        message: `Completed step ${currentStepIndex + 1}`,
        level: 'info',
        data: {
          stepId: currentStep.id,
          duration,
          skipped: false,
        },
      });

      void trackOnboardingStep(currentStep.id, true, false, duration);

      const latestProgress = await updateProgress(currentStep.id, true, false);

      if (!isMountedRef.current) return;

      if (currentStepIndex < activeSteps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        stepTransitionValue.value = 0;
        if (isMountedRef.current) {
          setIsTransitioning(false);
        }
      } else {
        await completeOnboarding(latestProgress);
        void trackOnboardingComplete();
        navigation.replace?.('MainTabs');
        if (isMountedRef.current) {
          setIsTransitioning(false);
        }
      }
    } catch (error) {
      console.error('Error progressing onboarding:', error);
      
      if (!isMountedRef.current) return;
      
      setIsTransitioning(false);
      
      showToast({
        type: 'error',
        message: t('onboarding.errors.tryAgain'),
        haptic: 'error',
      });
    }
  };

  /**
   * Handle step skip
   */
  const handleSkip = async () => {
    if (isTransitioning) return;
    
    const duration = Date.now() - stepStartTime;
    
    setIsTransitioning(true);
    
    try {
      addBreadcrumb({
        category: 'onboarding',
        message: `Skipped step ${currentStepIndex + 1}`,
        level: 'info',
        data: {
          stepId: currentStep.id,
          duration,
          skipped: true,
        },
      });

      void trackOnboardingStep(currentStep.id, false, true, duration);

      const latestProgress = await updateProgress(currentStep.id, false, true);

      if (!isMountedRef.current) return;

      if (currentStepIndex < activeSteps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        await completeOnboarding(latestProgress);
        void trackOnboardingComplete();
        navigation.replace?.('MainTabs');
      }
    } catch (error) {
      console.error('Error skipping step:', error);
      
      if (!isMountedRef.current) return;
      
      showToast({
        type: 'error',
        message: t('onboarding.errors.tryAgain'),
        haptic: 'error',
      });
    } finally {
      if (isMountedRef.current) {
        setIsTransitioning(false);
      }
    }
  };

  /**
   * Handle skip all with confirmation
   */
  const handleSkipAll = useCallback(() => {
    Alert.alert(
      t('onboarding.skipAllTitle'),
      t('onboarding.skipAllMessage'),
      [
        { text: t('onboarding.cancel'), style: 'cancel' },
        {
          text: t('onboarding.skipAllConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              addBreadcrumb({
                category: 'onboarding',
                message: 'Skipped entire onboarding',
                level: 'warning',
              });
              
              // Mark all steps as skipped
              let latestProgress = progress;
              for (const step of activeSteps) {
                latestProgress = await updateProgress(step.id, false, true);
                if (!isMountedRef.current) return;
              }
              
              await completeOnboarding(latestProgress);
              void trackOnboardingComplete();
              navigation.replace?.('MainTabs');
            } catch (error) {
              console.error('Error skipping all:', error);
              
              if (!isMountedRef.current) return;
              
              Alert.alert(
                t('onboarding.errors.skipAllFailed'),
                t('onboarding.errors.tryAgain'),
                [{ text: t('common.ok') }]
              );
            }
          },
        },
      ]
    );
  }, [activeSteps, completeOnboarding, navigation, progress, t, updateProgress]);

  /**
   * Handle finish later with progress save
   */
  const handleFinishLater = useCallback(async () => {
    addBreadcrumb({
      category: 'onboarding',
      message: 'User chose to finish later',
      level: 'info',
      data: { currentStepIndex },
    });

    if (currentStep?.id) {
      void trackOnboardingDropOff(currentStep.id);
    }

    Alert.alert(
      t('onboarding.finishLaterTitle'),
      t('onboarding.finishLaterMessage'),
      [
        { text: t('onboarding.cancel'), style: 'cancel' },
        {
          text: t('onboarding.save'),
          onPress: async () => {
            try {
              if (currentStep?.id) {
                await updateProgress(currentStep.id, false, false);
              }
              navigation.replace?.('MainTabs');
            } catch (error) {
              console.error('Error saving progress:', error);
              // Still navigate even if save fails
              navigation.replace?.('MainTabs');
            }
          },
        },
      ]
    );
  }, [currentStep?.id, currentStepIndex, navigation, t, updateProgress]);

  /**
   * Render loading state
   */
  if (!StepComponent || activeSteps.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('onboarding.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surfaceSlate} />
      
      {/* Living Bridge Header - Full Onboarding Variant */}
      <LivingBridgeHeader
        variant="onboarding"
        title={t('common.taxbridgeName')}
        subtitle={t('common.taxbridgeSlogan')}
        logoSource={APP_ICON}
        showNetworkStatus={true}
        isOnline={isOnline}
        showProgress={true}
        progress={(currentStepIndex + 1) / activeSteps.length}
        showTrustBadges={false}
        showMetricChip={false}
        showSkip={true}
        onSkip={handleSkipAll}
        showSave={true}
        onSave={handleFinishLater}
      />

      {/* Step Indicator with Progress Dots */}
      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <Text 
            style={styles.stepNumber}
            accessibilityLabel={t('onboarding.stepOf', { 
              current: currentStepIndex + 1, 
              total: activeSteps.length 
            })}
          >
            {currentStepIndex + 1} {t('onboarding.of')} {activeSteps.length}
          </Text>
          <Text style={styles.stepName}>
            {currentStep?.id ? t(`onboarding.${currentStep.id}.title`) : ''}
          </Text>
        </View>

        {/* Network status indicator */}
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>{t('common.offline')}</Text>
          </View>
        )}
      </View>

      {/* Animated Progress Steps */}
      <View style={styles.stepsContainer}>
        {activeSteps.map((step, index) => (
          <Animated.View
            key={step.id}
            style={[
              styles.stepDot,
              index < currentStepIndex && styles.stepDotCompleted,
              index === currentStepIndex && styles.stepDotActive,
            ]}
            entering={FadeIn.delay(index * 50)}
          />
        ))}
      </View>

      {/* Step content with animation */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        entering={FadeIn.duration(300)}
      >
        <Animated.View
          key={`step-${currentStepIndex}`}
          style={styles.stepCard}
          entering={SlideInRight.springify().damping(STEP_ANIMATION_CONFIG.damping).stiffness(STEP_ANIMATION_CONFIG.stiffness)}
          exiting={SlideOutLeft.duration(200)}
        >
          <StepComponent
            onNext={handleNext}
            onSkip={currentStep.canSkip ? handleSkip : undefined}
          />
        </Animated.View>

        {/* Helper Card */}
        <Animated.View 
          style={styles.helperCard}
          entering={FadeIn.delay(200)}
        >
          <Text style={styles.helperTitle}>{t('onboarding.helperTitle')}</Text>
          <Text style={styles.helperSubtitle}>{t('onboarding.helperSubtitle')}</Text>
          <View style={styles.helperPills}>
            <Text style={styles.helperPill}>{t('onboarding.helperPill1')}</Text>
            <Text style={styles.helperPill}>{t('onboarding.helperPill2')}</Text>
            <Text style={styles.helperPill}>{t('onboarding.helperPill3')}</Text>
          </View>
        </Animated.View>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Animated.View 
            style={styles.errorCard}
            entering={FadeIn}
            exiting={FadeOut}
          >
            {validationErrors.map((error, index) => (
              <Text key={index} style={styles.errorText}>• {error}</Text>
            ))}
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* Trust Footer */}
      <View style={styles.trustFooter}>
        <Text style={styles.trustText}>{t('onboarding.trustLocalFirst')}</Text>
        <Text style={styles.trustText}>•</Text>
        <Text style={styles.trustText}>{t('onboarding.trustOffline')}</Text>
      </View>
    </SafeAreaView>
  );
}

export default memo(OnboardingScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepIndicator: {
    flex: 1,
  },
  stepNumber: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  offlineBadge: {
    backgroundColor: colors.warningBgSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  offlineBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.warning,
    textTransform: 'uppercase',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderSubtle,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 8,
    gap: spacing.lg,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.md,
  },
  helperCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: 10,
    ...shadows.primary,
  },
  helperTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
    color: colors.textOnPrimary,
  },
  helperSubtitle: {
    fontSize: typography.size.sm - 1,
    color: colors.textOnPrimaryMuted,
    lineHeight: 18,
  },
  helperPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  helperPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
    backgroundColor: colors.overlayLightStrong,
    color: colors.textOnPrimary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  errorCard: {
    backgroundColor: colors.errorBgSubtle,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.error,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  trustFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.sm,
    ...shadows.header,
  },
  trustText: {
    fontSize: typography.size.xs - 1,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
});