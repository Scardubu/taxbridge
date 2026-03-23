import React from 'react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useCurrentStepId } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const currentStepId = useCurrentStepId();

  useEffect(() => {
    router.replace(`/(onboarding)/${currentStepId}`);
  }, [currentStepId]);

  return null;
}
