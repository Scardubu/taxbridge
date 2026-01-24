import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useOnboarding, OnboardingStepId, UserProfile } from '../contexts/OnboardingContext';
import { useNetwork } from '../contexts/NetworkContext';
import { addBreadcrumb } from '../services/sentry';
import { LivingBridgeHeader } from '../components/header';
import { colors, radii, spacing, typography } from '../theme/tokens';

// Step components
import ProfileAssessmentStep from '../components/onboarding/ProfileAssessmentStep';
import PITTutorialStep from '../components/onboarding/PITTutorialStep';
import VATCITAwarenessStep from '../components/onboarding/VATCITAwarenessStep';
import FIRSDemoStep from '../components/onboarding/FIRSDemoStep';
import GamificationStep from '../components/onboarding/GamificationStep';
import CommunityStep from '../components/onboarding/CommunityStep';

const APP_ICON = require('../../assets/icon.png');

interface OnboardingStep {
  id: OnboardingStepId;
  component: React.ComponentType<StepProps>;
  canSkip: boolean;
  gatingLogic?: (profile: UserProfile) => boolean;
}

interface StepProps {
  onNext: () => void;
  onSkip?: () => void;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    component: ProfileAssessmentStep,
    canSkip: false,
  },
  {
    id: 'pit',
    component: PITTutorialStep,
    canSkip: false,
  },
  {
    id: 'vatcit',
    component: VATCITAwarenessStep,
    canSkip: true,
    gatingLogic: (profile) => {
      return (
        (profile.annualTurnover ?? 0) > 2_000_000 ||
        profile.businessType === 'considering_incorporation'
      );
    },
  },
  {
    id: 'firs',
    component: FIRSDemoStep,
    canSkip: true,
    gatingLogic: (profile) => {
      return (
        (profile.annualIncome ?? 0) > 1_000_000 ||
        profile.incomeSource === 'business'
      );
    },
  },
  {
    id: 'gamification',
    component: GamificationStep,
    canSkip: true,
  },
  {
    id: 'community',
    component: CommunityStep,
    canSkip: true,
  },
];

interface OnboardingScreenProps {
  navigation?: {
    replace: (route: string) => void;
  };
}

function OnboardingScreen(props: OnboardingScreenProps = {}) {
  const { navigation } = props;
  const { t } = useTranslation();
  const { profile, progress, updateProgress, completeOnboarding } = useOnboarding();
  const { isOnline } = useNetwork();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStartTime, setStepStartTime] = useState(Date.now());
  const progressValue = useSharedValue(0);
  const hasRestoredRef = useRef(false);

  // Filter steps based on gating logic
  const activeSteps = STEPS.filter((step) => {
    if (!step.gatingLogic) return true;
    return step.gatingLogic(profile);
  });

  const currentStep = activeSteps[currentStepIndex];
  const StepComponent = currentStep?.component;

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

  useEffect(() => {
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
  }, [activeSteps, resolveResumeIndex]);

  useEffect(() => {
    if (activeSteps.length === 0) return;
    setStepStartTime(Date.now());
    progressValue.value = withSpring((currentStepIndex + 1) / activeSteps.length, {
      damping: 15,
      stiffness: 100,
    });
    
    addBreadcrumb({
      category: 'onboarding',
      message: `Started step ${currentStepIndex + 1}/${activeSteps.length}`,
      level: 'info',
      data: {
        stepId: currentStep?.id,
      },
    });
  }, [currentStepIndex, activeSteps.length]);

  useEffect(() => {
    if (currentStepIndex >= activeSteps.length) {
      setCurrentStepIndex(Math.max(0, activeSteps.length - 1));
    }
  }, [activeSteps.length, currentStepIndex]);

  useEffect(() => {
    if (progress.completedAt && navigation) {
      navigation.replace?.('MainTabs');
    }
  }, [progress.completedAt, navigation]);

  const handleNext = async () => {
    const duration = Date.now() - stepStartTime;
    
    // Track analytics
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

    const latestProgress = await updateProgress(currentStep.id, true, false);

    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      await completeOnboarding(latestProgress);
      navigation?.replace('MainTabs');
    }
  };

  const handleSkip = async () => {
    const duration = Date.now() - stepStartTime;
    
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

    const latestProgress = await updateProgress(currentStep.id, false, true);

    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      await completeOnboarding(latestProgress);
      navigation?.replace('MainTabs');
    }
  };

  const handleSkipAll = () => {
    Alert.alert(
      t('onboarding.skipAllTitle'),
      t('onboarding.skipAllMessage'),
      [
        { text: t('onboarding.cancel'), style: 'cancel' },
        {
          text: t('onboarding.skipAllConfirm'),
          style: 'destructive',
          onPress: async () => {
            addBreadcrumb({
              category: 'onboarding',
              message: 'Skipped entire onboarding',
              level: 'info',
            });
            
            // Mark all steps as skipped
            let latestProgress = progress;
            for (const step of activeSteps) {
              latestProgress = await updateProgress(step.id, false, true);
            }
            await completeOnboarding(latestProgress);
            navigation?.replace('MainTabs');
          },
        },
      ]
    );
  };

  if (!StepComponent) {
    return null;
  }

  const handleFinishLater = useCallback(async () => {
    addBreadcrumb({
      category: 'onboarding',
      message: 'User chose to finish later',
      level: 'info',
    });
    // Save progress without completing
    Alert.alert(
      t('onboarding.finishLaterTitle'),
      t('onboarding.finishLaterMessage'),
      [
        { text: t('onboarding.cancel'), style: 'cancel' },
        {
          text: t('onboarding.save'),
          onPress: async () => {
            if (currentStep?.id) {
              await updateProgress(currentStep.id, false, false);
            }
            navigation?.replace('MainTabs');
          },
        },
      ]
    );
  }, [currentStep?.id, navigation, t, updateProgress]);

  return (
    <SafeAreaView style={styles.container}>
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
        showTrustBadges={true}
        showMetricChip={true}
        metricValue={t('onboarding.avgSetupValue')}
        metricLabel={t('onboarding.avgSetupLabel')}
        showSkip={true}
        onSkip={handleSkipAll}
        showSave={true}
        onSave={handleFinishLater}
      />

      {/* Step Indicator with Progress Dots */}
      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepNumber}>
            {currentStepIndex + 1} {t('onboarding.of')} {activeSteps.length}
          </Text>
          <Text style={styles.stepName}>
            {currentStep?.id ? t(`onboarding.${currentStep.id}.title`) : ''}
          </Text>
        </View>
      </View>

      {/* Animated Progress Steps */}
      <View style={styles.stepsContainer}>
        {activeSteps.map((step, index) => (
          <View
            key={step.id}
            style={[
              styles.stepDot,
              index < currentStepIndex && styles.stepDotCompleted,
              index === currentStepIndex && styles.stepDotActive,
            ]}
          />
        ))}
      </View>

      {/* Step content with animation */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        entering={FadeIn.duration(300)}
      >
        <Animated.View
          style={styles.stepCard}
          entering={SlideInRight.springify().damping(18).stiffness(140)}
        >
          <StepComponent
            onNext={handleNext}
            onSkip={currentStep.canSkip ? handleSkip : undefined}
          />
        </Animated.View>

        <View style={styles.helperCard}>
          <Text style={styles.helperTitle}>{t('onboarding.helperTitle')}</Text>
          <Text style={styles.helperSubtitle}>{t('onboarding.helperSubtitle')}</Text>
          <View style={styles.helperPills}>
            <Text style={styles.helperPill}>{t('onboarding.helperPill1')}</Text>
            <Text style={styles.helperPill}>{t('onboarding.helperPill2')}</Text>
            <Text style={styles.helperPill}>{t('onboarding.helperPill3')}</Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Trust Footer */}
      <View style={styles.trustFooter}>
        <Text style={styles.trustText}>{t('onboarding.trustLocalFirst')}</Text>
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
    elevation: 4,
  },
  helperCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: 10,
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
  trustFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  trustText: {
    fontSize: typography.size.xs - 1,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
});
