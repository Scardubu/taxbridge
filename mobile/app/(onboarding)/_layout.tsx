import React from 'react';
import { Redirect, Slot } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone } from '../../stores/onboardingStore';

export default function OnboardingLayout() {
  const isDone = useIsOnboardingDone();

  if (isDone) {
    return <Redirect href={DEFAULT_TAB_ROUTE} />;
  }

  return <Slot />;
}
