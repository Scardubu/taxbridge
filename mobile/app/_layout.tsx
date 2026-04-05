import 'react-native-reanimated';
import '../global.css';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import i18n, { initializeI18n } from '../i18n';
import { getDatabase as initDatabase } from '../services/database';
import { migrateFromAsyncStorage as runStorageMigration } from '../services/storageMigration';
import { offlineQueue } from '../services/offlineQueue';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { useOnboardingStore } from '../stores/onboardingStore';

let hasInitializedSentry = false;

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

async function waitForOnboardingHydration() {
  await new Promise<void>((resolve) => {
    const checkHydration = () => {
      if (useOnboardingStore.getState()._hasHydrated) {
        resolve();
        return;
      }

      setTimeout(checkHydration, 30);
    };

    checkHydration();
  });
}

function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await SplashScreen.preventAutoHideAsync().catch(() => undefined);
        await initializeI18n();
        await initDatabase();
        await runStorageMigration();
        await useOnboardingStore.persist.rehydrate();

        await waitForOnboardingHydration();

        await hydrateProfile();

        if (isMounted) {
          offlineQueue.start();
          void offlineQueue.flush().catch((error) => {
            Sentry.captureException(error);
          });
        }
      } catch (error) {
        Sentry.captureException(error);
      } finally {
        if (isMounted) {
          setIsAppReady(true);
        }

        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [hydrateProfile]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="auto" />
          {isAppReady ? (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            </Stack>
          ) : (
            <SafeAreaView
              edges={['top', 'bottom']}
              style={{
                flex: 1,
                backgroundColor: '#0a0a0a',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color="#1D9E75" size="large" />
            </SafeAreaView>
          )}
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
