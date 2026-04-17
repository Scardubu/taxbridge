import React from 'react';
import { Redirect } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone, usePreviewMode, useStoreHydrated } from '../stores/onboardingStore';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../components/design-system/tokens';

export default function AppIndex() {
  const isDone = useIsOnboardingDone();
  const previewMode = usePreviewMode();
  const hydrated = useStoreHydrated();

  // Hydration guard prevents redirect race on slow devices / restart recovery
  // Optimized for Zustand v5 + Expo Router v6 (matches (onboarding)/_layout.tsx)
  // Ensures backend profile hydrate + SSE events fire reliably
  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.brand.primaryDim }}>
        <ActivityIndicator size="large" color={Colors.brand.accent} />
      </View>
    );
  }

  return <Redirect href={isDone || previewMode ? DEFAULT_TAB_ROUTE : '/(onboarding)/welcome/welcome'} />;
}
