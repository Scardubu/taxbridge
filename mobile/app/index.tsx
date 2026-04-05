import React from 'react';
import { Redirect } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone, useOnboardingStore } from '../stores/onboardingStore';

export default function AppIndex() {
  const isDone = useIsOnboardingDone();
  const previewMode = useOnboardingStore((state) => state.previewMode);

  return <Redirect href={isDone || previewMode ? DEFAULT_TAB_ROUTE : '/(onboarding)'} />;
}
