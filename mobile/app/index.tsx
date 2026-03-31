import React from 'react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useIsOnboardingDone, useOnboardingHydrated } from '../stores/onboardingStore';

export default function AppIndex() {
  const isHydrated = useOnboardingHydrated();
  const isDone = useIsOnboardingDone();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    router.replace(isDone ? '/(tabs)/' : '/(onboarding)/');
  }, [isDone, isHydrated]);

  if (!isHydrated) {
    return null;
  }

  return null;
}
