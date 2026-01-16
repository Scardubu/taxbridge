import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
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
import BrandedHero from '../components/BrandedHero';

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

  // Filter steps based on gating logic
  const activeSteps = STEPS.filter((step) => {
    if (!step.gatingLogic) return true;
    return step.gatingLogic(profile);
  });

  const currentStep = activeSteps[currentStepIndex];
  const StepComponent = currentStep?.component;

  useEffect(() => {
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
      'Skip Onboarding?',
      'You can always access these tutorials later in Settings. Are you sure you want to skip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip All',
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
      t('onboarding.finishLaterTitle') || 'Save Progress?',
      t('onboarding.finishLaterMessage') || 'Your progress will be saved. You can continue from Settings anytime.',
      [
        { text: t('onboarding.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('onboarding.save') || 'Save & Exit',
          onPress: async () => {
            await completeOnboarding(progress);
            navigation?.replace('MainTabs');
          },
        },
      ]
    );
  }, [completeOnboarding, navigation, progress, t]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroSection}>
        <BrandedHero
          title="TaxBridge"
          subtitle="Simplify Your Taxes, Bridge Your Future"
          showProgress={true}
          progress={(currentStepIndex + 1) / activeSteps.length}
          showOfflineIndicator={true}
          isOnline={isOnline}
          variant="compact"
          logoSource={APP_ICON}
        />

        <View style={styles.heroMetaCard}>
          <View style={styles.heroMetaLeft}>
            <Image
              source={APP_ICON}
              style={styles.heroMetaImage}
              resizeMode="contain"
              accessible
              accessibilityLabel="TaxBridge icon"
            />
            <View style={styles.heroMetaCopy}>
              <Text style={styles.heroMetaTitle}>Built for Nigerian SMEs</Text>
              <Text style={styles.heroMetaSubtitle}>
                Finish onboarding offline in under 2 minutes and stay NRS compliant.
              </Text>
            </View>
          </View>
          <View style={styles.heroMetaBadge}>
            <Text style={styles.heroMetaBadgeValue}>30s</Text>
            <Text style={styles.heroMetaBadgeLabel}>Avg setup</Text>
          </View>
        </View>

        <View style={styles.heroMetaChips}>
          <Text style={styles.metaChip}>🌍 English + Pidgin</Text>
          <Text style={styles.metaChip}>🔄 Offline Sync</Text>
          <Text style={styles.metaChip}>🛡️ NDPR Secure</Text>
        </View>
      </View>

      {/* Enhanced Header with Actions */}
      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepNumber}>
            {currentStepIndex + 1} {t('onboarding.of')} {activeSteps.length}
          </Text>
          <Text style={styles.stepName}>
            {currentStep?.id ? t(`onboarding.${currentStep.id}.title`) : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleFinishLater} style={styles.finishLaterButton}>
            <Text style={styles.finishLaterText}>💾 {t('onboarding.finishLater') || 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipAll} style={styles.skipAllButton}>
            <Text style={styles.skipAllText}>{t('onboarding.skip')} →</Text>
          </TouchableOpacity>
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
          <Text style={styles.helperTitle}>Why complete onboarding?</Text>
          <Text style={styles.helperSubtitle}>
            Unlock guided PIT/VAT/CIT calculators, DigiTax-ready invoice templates, and
            save offline drafts that sync once you are online.
          </Text>
          <View style={styles.helperPills}>
            <Text style={styles.helperPill}>✅ Compliance tips</Text>
            <Text style={styles.helperPill}>🤝 WhatsApp support</Text>
            <Text style={styles.helperPill}>📈 SME insights</Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Trust Footer */}
      <View style={styles.trustFooter}>
        <Text style={styles.trustText}>� Local-first, syncs when online</Text>
        <Text style={styles.trustText}>📵 Works without internet</Text>
      </View>
    </SafeAreaView>
  );
}

export default memo(OnboardingScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroMetaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: -8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  heroMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  heroMetaImage: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  heroMetaCopy: {
    flex: 1,
  },
  heroMetaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroMetaSubtitle: {
    fontSize: 13,
    color: '#475467',
    marginTop: 4,
    lineHeight: 18,
  },
  heroMetaBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  heroMetaBadgeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4338CA',
  },
  heroMetaBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  metaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E0EAFF',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '600',
    color: '#0B5FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepIndicator: {
    flex: 1,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B5FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101828',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  finishLaterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  finishLaterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B5FFF',
  },
  skipAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  skipAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E4E7EC',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: '#0B5FFF',
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  helperCard: {
    backgroundColor: '#0B5FFF',
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  helperTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  helperSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  helperPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  helperPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  trustFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    gap: 16,
  },
  trustText: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '500',
  },
});
