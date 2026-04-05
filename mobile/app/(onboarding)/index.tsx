import React from 'react';
import { Redirect } from 'expo-router';
import { STEP_ROUTES, useCurrentStepId } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const currentStepId = useCurrentStepId();

  return <Redirect href={STEP_ROUTES[currentStepId]} />;
}
