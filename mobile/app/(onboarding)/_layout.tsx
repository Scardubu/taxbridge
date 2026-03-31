import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useIsOnboardingDone, useOnboardingHydrated } from '../../stores/onboardingStore';

export default function OnboardingLayout() {
  const isHydrated = useOnboardingHydrated();
  const isDone = useIsOnboardingDone();

  if (!isHydrated) {
    return null;
  }

  if (isDone) {
    return <Redirect href="/(tabs)/" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }} />;
}
