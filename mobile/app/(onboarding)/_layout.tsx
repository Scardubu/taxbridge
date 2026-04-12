import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { DEFAULT_TAB_ROUTE, useIsOnboardingDone, useStoreHydrated } from '../../stores/onboardingStore';
import { Colors } from '../../components/design-system/tokens';

export default function OnboardingLayout() {
  const hydrated = useStoreHydrated();
  const isDone = useIsOnboardingDone();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.ui.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={Colors.brand.primary} size="large" />
      </View>
    );
  }

  if (isDone) {
    return <Redirect href={DEFAULT_TAB_ROUTE} />;
  }

  return <Slot />;
}
