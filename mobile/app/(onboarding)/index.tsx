import React from 'react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useCurrentStepId, useOnboardingHydrated } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const isHydrated = useOnboardingHydrated();
  const currentStepId = useCurrentStepId();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    router.replace(`/(onboarding)/${currentStepId}`);
  }, [currentStepId, isHydrated]);

  if (!isHydrated) {
    return null;
  }

  return null;
}
