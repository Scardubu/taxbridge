import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

export default function OnboardingLayout() {
  const isDone = useIsOnboardingDone();

  if (isDone) {
    return <Redirect href="/(tabs)/" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }} />;
}
