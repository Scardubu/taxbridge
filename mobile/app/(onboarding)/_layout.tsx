import React from 'react';
import { Stack } from 'expo-router';
import { useOnboardingHydrated } from '../../stores/onboardingStore';

export default function OnboardingLayout() {
  const isHydrated = useOnboardingHydrated();

  if (!isHydrated) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }} />;
}
