import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Slot, router } from 'expo-router';
import { DEFAULT_TAB_ROUTE, STEP_ROUTES, STEPS, useIsOnboardingDone, useOnboardingStore, useStoreHydrated } from '../../stores/onboardingStore';
import { Colors } from '../../components/design-system/tokens';

/** Pre-warm the JS module graph for the next two onboarding steps to reduce transition latency. */
function usePrefetchNextSteps() {
  const currentStepId = useOnboardingStore((state) => state.currentStepId);
  useEffect(() => {
    if (currentStepId === 'done') return;
    const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);
    const nextSteps = STEPS.slice(currentIndex + 1, currentIndex + 3);
    for (const step of nextSteps) {
      router.prefetch(STEP_ROUTES[step.id]);
    }
  }, [currentStepId]);
}

export default function OnboardingLayout() {
  const hydrated = useStoreHydrated();
  const isDone = useIsOnboardingDone();
  usePrefetchNextSteps();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.ui.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={Colors.brand.primary} size="large" />
      </View>
    );
  }

  if (isDone) {
    return <Redirect href={DEFAULT_TAB_ROUTE} />;
  }

  return <Slot />;
}
