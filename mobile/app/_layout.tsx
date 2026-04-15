import 'react-native-reanimated';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { Slot } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import i18n, { initializeI18n } from '../i18n';
import { closeDatabase, initDatabase } from '../services/database';
import { migrateFromAsyncStorage as runStorageMigration } from '../services/storageMigration';
import { offlineQueue } from '../services/offlineQueue';
import { AppKV } from '../storage/kv';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { Colors } from '../components/design-system/tokens';

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

function waitForHydration(): Promise<void> {
  return new Promise((resolve) => {
    if (useOnboardingStore.getState()._hasHydrated) {
      resolve();
      return;
    }

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve();
    };

    const unsub = useOnboardingStore.subscribe((state) => {
      if (state._hasHydrated) {
        unsub();
        finish();
      }
    });

    timeoutId = setTimeout(() => {
      unsub();
      Sentry.captureMessage(
        'waitForHydration resolved via 4s timeout — previewMode KV read may not have completed',
        'warning'
      );
      AppKV.flags.getPreviewMode()
        .then((previewMode) => {
          useOnboardingStore.setState({ _hasHydrated: true, previewMode: previewMode ?? false });
        })
        .catch(() => {
          useOnboardingStore.setState({ _hasHydrated: true });
        })
        .finally(() => finish());
    }, 4000);
  });
}

function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  useEffect(() => {
    void (async () => {
      try {
        await initializeI18n();
        await initDatabase();
        await runStorageMigration();
        await useOnboardingStore.persist.rehydrate();
        await waitForHydration();
        await hydrateProfile();
        offlineQueue.start();
      } catch (error) {
        Sentry.captureException(error);
      } finally {
        setIsAppReady(true);
        // Always hide splash screen, even on error, to prevent hang on restart
        await SplashScreen.hideAsync().catch(() => undefined);
        void offlineQueue.flush().catch((error) => {
          Sentry.captureException(error);
        });
      }
    })();

    // Cleanup resources when app goes to background/closed to prevent locks on restart
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAppReady) {
        void (async () => {
          try {
            await initDatabase();
            offlineQueue.start();
          } catch (error) {
            Sentry.captureException(error);
          }
        })();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        void (async () => {
          try {
            offlineQueue.destroy();
            await closeDatabase();
          } catch (error) {
            Sentry.captureException(error);
          }
        })();
      }
    });

    return () => subscription.remove();
  }, [hydrateProfile]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="auto" />
          {isAppReady ? (
            <Slot />
          ) : (
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
          )}
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
