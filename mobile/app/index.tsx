import React from 'react';
import { Redirect } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone, useOnboardingHydrated } from '../stores/onboardingStore';

export default function AppIndex() {
  const isHydrated = useOnboardingHydrated();
  const isDone = useIsOnboardingDone();

  if (!isHydrated) {
    return null;
  }

  return <Redirect href={isDone ? DEFAULT_TAB_ROUTE : '/(onboarding)/'} />;
}
