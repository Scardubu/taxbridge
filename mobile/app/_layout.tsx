import 'react-native-reanimated';
import '../global.css';

import React, { useCallback, useEffect, useState } from 'react';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import i18n, { initializeI18n } from '../i18n';
import { getDatabase } from '../services/database';
import { migrateFromAsyncStorage } from '../services/storageMigration';
import { offlineQueue } from '../services/offlineQueue';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { useOnboardingStore } from '../stores/onboardingStore';

let hasInitializedSentry = false;
const STARTUP_TIMEOUT_MS = 4000;

function ensureSentryInitialized() {
  if (hasInitializedSentry) {
    return;
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !__DEV__ && !isRunningInExpoGo(),
    tracesSampleRate: 0.15,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
  });

  hasInitializedSentry = true;
}

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
ensureSentryInitialized();

function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  const onLayoutRootView = useCallback(() => {
    if (!appIsReady) {
      return;
    }

    void SplashScreen.hideAsync().catch(() => undefined);
  }, [appIsReady]);

  useEffect(() => {
    let isMounted = true;
    const releaseApp = () => {
      if (!useOnboardingStore.getState().hasHydrated) {
        useOnboardingStore.getState().markHydrated();
      }

      if (isMounted) {
        setAppIsReady(true);
      }
    };

    const timeoutId = setTimeout(releaseApp, STARTUP_TIMEOUT_MS);

    void (async () => {
      try {
        await initializeI18n();
        await getDatabase();
        await migrateFromAsyncStorage();
        await useOnboardingStore.persist.rehydrate();

        if (!useOnboardingStore.getState().hasHydrated) {
          useOnboardingStore.getState().markHydrated();
        }

        await hydrateProfile();
      } catch (error) {
        Sentry.captureException(error);

        if (!useOnboardingStore.getState().hasHydrated) {
          useOnboardingStore.getState().markHydrated();
        }
      } finally {
        clearTimeout(timeoutId);

        releaseApp();

        if (isMounted) {
          offlineQueue.start();
          void offlineQueue.flush().catch((error) => {
            Sentry.captureException(error);
          });
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [hydrateProfile]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          </Stack>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
