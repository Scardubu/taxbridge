import 'react-native-reanimated';
import '../global.css';

import React, { useEffect } from 'react';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { getDatabase } from '../services/database';
import { migrateFromAsyncStorage } from '../services/storageMigration';
import { useBusinessProfileStore } from '../stores/businessProfileStore';

const { Stack } = require('expo-router') as {
  Stack: React.ComponentType<any> & { Screen: React.ComponentType<any> };
};

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

function RootLayout() {
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  useEffect(() => {
    ensureSentryInitialized();

    let isMounted = true;

    void (async () => {
      try {
        await getDatabase();
        await migrateFromAsyncStorage();
      } catch (error) {
        Sentry.captureException(error);
      } finally {
        if (isMounted) {
          await SplashScreen.hideAsync().catch(() => undefined);

          setTimeout(() => {
            void hydrateProfile().catch((error) => {
              Sentry.captureException(error);
            });

            void import('../services/offlineQueue').then(({ offlineQueue }) => {
              return offlineQueue.flush();
            }).catch((error) => {
              Sentry.captureException(error);
            });
          }, 0);
        }
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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          </Stack>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
