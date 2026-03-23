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
import { offlineQueue } from '../services/offlineQueue';

const { Stack } = require('expo-router') as {
  Stack: React.ComponentType<any> & { Screen: React.ComponentType<any> };
};

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ && !isRunningInExpoGo(),
  tracesSampleRate: 0.15,
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
});

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  useEffect(() => {
    void (async () => {
      try {
        await getDatabase();
        await migrateFromAsyncStorage();
        await hydrateProfile();
        void offlineQueue.flush();
      } catch (error) {
        Sentry.captureException(error);
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
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
