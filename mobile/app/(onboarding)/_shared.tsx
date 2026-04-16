import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingErrorBoundary } from '../../components/OnboardingErrorBoundary';
import { StepContainer } from '../../components/StepContainer';
import { OnboardingProgressBar } from '../../components/OnboardingProgressBar';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { STEPS, STEP_ROUTES, type StepId, useOnboardingStore } from '../../stores/onboardingStore';

// ─── Step metadata: icon + eyebrow category for visual identity ───
const STEP_META: Record<StepId, { icon: string; eyebrowKey: string }> = {
  welcome: { icon: '🇳🇬', eyebrowKey: 'onboarding.eyebrow.welcome' },
  'business-type': { icon: '🏢', eyebrowKey: 'onboarding.eyebrow.profile' },
  'tin-verify': { icon: '🔐', eyebrowKey: 'onboarding.eyebrow.identity' },
  'vat-setup': { icon: '📊', eyebrowKey: 'onboarding.eyebrow.obligations' },
  einvoice: { icon: '🧾', eyebrowKey: 'onboarding.eyebrow.compliance' },
  community: { icon: '🏆', eyebrowKey: 'onboarding.eyebrow.finish' },
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
    // CONTRACT: when stepId is the last step, goNext() calls complete() which sets
    // isComplete=true. The (onboarding)/_layout.tsx guard then emits <Redirect href={DEFAULT_TAB_ROUTE} />.
    // Do NOT call router.replace here in that case — the layout owns that navigation.
    // For all intermediate steps, next is defined and isComplete remains false, so
    // the layout guard does not fire and we drive navigation explicitly below.
    if (next) {
      router.replace(STEP_ROUTES[next.id]);
    }
  });
}

export function completeOptionalFlow() {
  return useOnboardingStore.getState().skipAllOptional();
}

export function skipSetupForNow() {
  return useOnboardingStore.getState().skipForNow();
}

// ─── Reusable educational info card ───
export function InfoCard({
  variant = 'tip',
  icon,
  title,
  body,
}: {
  variant?: 'tip' | 'warning' | 'info';
  icon?: string;
  title: string;
  body: string;
}) {
  const tokens = useTokens();
  const bgMap = { tip: palette.nrsGreenLight, warning: palette.amber50, info: palette.blue50 };
  const borderMap = { tip: `${palette.nrsGreen}30`, warning: `${palette.amber600}30`, info: `${palette.blue600}30` };
  const iconMap = { tip: '💡', warning: '⚠️', info: 'ℹ️' };
  const titleColorMap = { tip: palette.nrsGreen, warning: palette.amber600, info: palette.blue600 };

  return (
    <View
      style={{
        backgroundColor: bgMap[variant],
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: borderMap[variant],
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: 18 }}>{icon ?? iconMap[variant]}</Text>
        <Text style={{ ...typography.bodyBold, color: titleColorMap[variant], flex: 1 }}>{title}</Text>
      </View>
      <Text style={{ ...typography.body, color: tokens.textSecondary, lineHeight: 22 }}>{body}</Text>
    </View>
  );
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
}: Readonly<FrameProps>) {
  useBindOnboardingStep(stepId);
  const tokens = useTokens();
  const { t } = useTranslation();
  const meta = STEP_META[stepId];
  const progress = useOnboardingStore((state) => {
    const required = STEPS.filter((step) => step.required).length;
    const done = state.completedSteps.filter((id) => STEPS.find((step) => step.id === id && step.required)).length;
    return Math.round((done / required) * 100);
  });
  const current = STEPS.findIndex((step) => step.id === stepId) + 1;
  const resolvedEyebrow = eyebrow ?? t(meta.eyebrowKey);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingErrorBoundary stepId={stepId}>
        {/* ─── Header: back + progress + counter ─── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {current > 1 ? (
              <Pressable
                onPress={() => {
                  useOnboardingStore.getState().goPrev();
                  const prevStep = STEPS[current - 2];
                  if (prevStep) router.replace(STEP_ROUTES[prevStep.id]);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                hitSlop={12}
                style={{
                  padding: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: tokens.bgCard,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-back" size={20} color={tokens.textPrimary} />
              </Pressable>
            ) : <View style={{ width: 36 }} />}
            <View style={{ flex: 1 }}>
              <OnboardingProgressBar percent={progress} />
            </View>
            <View
              style={{
                backgroundColor: palette.nrsGreenLight,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                minWidth: 48,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.label, color: palette.nrsGreen }}>{t('stepCount', { current, total: STEPS.length })}</Text>
            </View>
          </View>
        </View>

        {/* ─── Scrollable content ─── */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <StepContainer isActive>
            <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.lg }}>
              {/* ─── Step identity + hero ─── */}
              <View style={{ gap: spacing.md }}>
                {/* Step icon + eyebrow */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.lg,
                      backgroundColor: palette.nrsGreenLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
                  </View>
                  <Text
                    style={{
                      ...typography.label,
                      color: palette.nrsGreen,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {resolvedEyebrow}
                  </Text>
                </View>

                {/* Title */}
                <Text style={{ ...typography.display, color: tokens.textPrimary }}>
                  {title}
                </Text>

                {/* Body */}
                <Text style={{ ...typography.body, color: tokens.textSecondary, lineHeight: 24 }}>
                  {body}
                </Text>

                {/* Screen-specific content */}
                <View style={{ gap: spacing.md }}>{children}</View>
              </View>

              {/* ─── Action buttons ─── */}
              <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                <Pressable
                  onPress={onPrimary}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel ?? t('common.continue')}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? palette.nrsGreenDim : palette.nrsGreen,
                    borderRadius: radius.xl,
                    paddingVertical: spacing.lg,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: spacing.sm,
                  })}
                >
                  <Text style={{ ...typography.bodyBold, color: palette.white }}>
                    {primaryLabel ?? t('common.continue')}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={palette.white} />
                </Pressable>
                {secondaryLabel && onSecondary ? (
                  <Pressable
                    onPress={onSecondary}
                    accessibilityRole="button"
                    accessibilityLabel={secondaryLabel}
                    style={{
                      borderRadius: radius.xl,
                      paddingVertical: spacing.md,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.body, color: tokens.textMuted }}>
                      {secondaryLabel}
                    </Text>
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
