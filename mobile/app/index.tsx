import React from 'react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useIsOnboardingDone } from '../stores/onboardingStore';

export default function AppIndex() {
  const isDone = useIsOnboardingDone();

  useEffect(() => {
    router.replace(isDone ? '/(tabs)/' : '/(onboarding)/');
  }, [isDone]);

  return null;
}
