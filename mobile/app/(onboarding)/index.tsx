import React from 'react';
import { Redirect } from 'expo-router';
import { STEP_ROUTES, useCurrentStepId, useOnboardingHydrated } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const isHydrated = useOnboardingHydrated();
  const currentStepId = useCurrentStepId();

  if (!isHydrated) {
    return null;
  }

  return <Redirect href={STEP_ROUTES[currentStepId]} />;
}
