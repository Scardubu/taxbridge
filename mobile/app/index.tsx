import React from 'react';
import { Redirect } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone, usePreviewMode, useStoreHydrated } from '../stores/onboardingStore';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../components/design-system/tokens';

export default function AppIndex() {
  const isDone = useIsOnboardingDone();
  const previewMode = usePreviewMode();
  const hydrated = useStoreHydrated();

  // === v3 PERSIST-REINFORCED DASHBOARD NAVIGATION GUARD (Zustand v5 + Expo Router v6 + RQ-safe) ===
  // Directly leverages the official onRehydrateStorage + _hasHydrated pattern already in onboardingStore.ts.
  // Prevents premature redirect before persist rehydration + profile hydrate + RQ cache is ready.
  // Superior to Redux Toolkit HYDRATE because no extra boilerplate is needed.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.ui.bg }}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  const targetRoute = !isDone && !previewMode ? "/(onboarding)/" : DEFAULT_TAB_ROUTE;
  return <Redirect href={targetRoute} />;
}
