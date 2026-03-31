import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { OnboardingErrorBoundary } from '../../components/OnboardingErrorBoundary';
import { StepContainer } from '../../components/StepContainer';
import { OnboardingProgressBar } from '../../components/OnboardingProgressBar';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { STEPS, type StepId, useOnboardingStore } from '../../stores/onboardingStore';

const ROUTES: Record<StepId, string> = {
  welcome: '/(onboarding)/welcome',
  'business-type': '/(onboarding)/business-type',
  'tin-verify': '/(onboarding)/tin-verify',
  'vat-setup': '/(onboarding)/vat-setup',
  einvoice: '/(onboarding)/einvoice',
  community: '/(onboarding)/community',
};

export function useBindOnboardingStep(stepId: StepId) {
  useEffect(() => {
    useOnboardingStore.setState({ currentStepId: stepId });
  }, [stepId]);
}

interface FrameProps {
  stepId: StepId;
  eyebrow?: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function advanceToNext(stepId: StepId) {
  const state = useOnboardingStore.getState();
  const index = STEPS.findIndex((step) => step.id === stepId);
  const next = STEPS[index + 1];
  return state.goNext().then(() => {
    if (next) {
      router.replace(ROUTES[next.id]);
    }
  });
}

export function completeOptionalFlow() {
  return useOnboardingStore.getState().skipAllOptional();
}

export function OnboardingFrame({
  stepId,
  eyebrow,
  title,
  body,
  children,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: FrameProps) {
  useBindOnboardingStep(stepId);
  const tokens = useTokens();
  const { t } = useTranslation();
  const progress = useOnboardingStore((state) => {
    const required = STEPS.filter((step) => step.required).length;
    const done = state.completedSteps.filter((id) => STEPS.find((step) => step.id === id && step.required)).length;
    return Math.round((done / required) * 100);
  });
  const current = STEPS.findIndex((step) => step.id === stepId) + 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingErrorBoundary stepId={stepId}>
        <OnboardingProgressBar percent={progress} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
          <StepContainer isActive>
            <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.lg }}>
              <View style={{ gap: spacing.md }}>
                <Text style={{ ...typography.label, color: palette.nrsGreen }}>{t('onboarding.stepCount', { current, total: STEPS.length })}</Text>
                {eyebrow ? <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{eyebrow}</Text> : null}
                <Text style={{ ...typography.display, color: tokens.textPrimary }}>{title}</Text>
                <Text style={{ ...typography.body, color: tokens.textSecondary }}>{body}</Text>
                <View style={{ gap: spacing.md }}>{children}</View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={onPrimary}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel ?? t('common.continue')}
                  style={{ backgroundColor: palette.nrsGreen, borderRadius: radius.xl, paddingVertical: spacing.md, alignItems: 'center' }}
                >
                  <Text style={{ ...typography.bodyBold, color: palette.white }}>{primaryLabel ?? t('common.continue')}</Text>
                </Pressable>
                {secondaryLabel && onSecondary ? (
                  <Pressable
                    onPress={onSecondary}
                    accessibilityRole="button"
                    accessibilityLabel={secondaryLabel}
                    style={{ borderRadius: radius.xl, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: tokens.border }}
                  >
                    <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{secondaryLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </StepContainer>
        </ScrollView>
      </OnboardingErrorBoundary>
    </SafeAreaView>
  );
}
