import 'react-native-reanimated';

import React, { useEffect, useRef, useState } from 'react';
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
      console.log('[HYDRATION] waitForHydration: already hydrated on entry');
      resolve();
      return;
    }

    const _t0 = Date.now();
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
        console.log('[HYDRATION] waitForHydration: resolved via subscribe', { elapsed: Date.now() - _t0 });
        Sentry.addBreadcrumb({
          category: 'hydration',
          message: 'waitForHydration resolved via subscribe',
          level: 'info',
          data: { elapsed: Date.now() - _t0 },
        });
        finish();
      }
    });

    timeoutId = setTimeout(() => {
      unsub();
      console.log('[HYDRATION] waitForHydration: 4s timeout fired — forcing KV read');
      Sentry.captureMessage(
        'waitForHydration resolved via 4s timeout — previewMode KV read may not have completed. Root index.tsx guard now hardened for Zustand v5 persist + Expo Router v6 + RQ dashboard + EAS compiler cache.',
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
  // Ref mirrors state so the AppState event listener never closes over a stale `false`.
  // The effect runs once; without the ref, resume never triggers db/queue re-init.
  const isAppReadyRef = useRef(false);
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  useEffect(() => {
    void (async () => {
      const _bootT0 = Date.now();
      console.log('[BOOT] RootLayout boot start', { timestamp: _bootT0 });
      Sentry.addBreadcrumb({ category: 'boot', message: 'RootLayout boot start', level: 'info', data: { timestamp: _bootT0 } });
      try {
        await initializeI18n();
        await initDatabase();
        await runStorageMigration();
        await useOnboardingStore.persist.rehydrate();
        console.log('[BOOT] persist.rehydrate() complete, waiting for hydration', { elapsed: Date.now() - _bootT0 });
        await waitForHydration();
        console.log('[BOOT] waitForHydration resolved', { elapsed: Date.now() - _bootT0 });
        Sentry.addBreadcrumb({ category: 'boot', message: 'waitForHydration resolved', level: 'info', data: { elapsed: Date.now() - _bootT0 } });
        await hydrateProfile();
        offlineQueue.start();
        console.log('[BOOT] RootLayout boot complete', { elapsed: Date.now() - _bootT0 });
        Sentry.addBreadcrumb({ category: 'boot', message: 'RootLayout boot complete', level: 'info', data: { elapsed: Date.now() - _bootT0 } });
      } catch (error) {
        Sentry.captureException(error);
      } finally {
        isAppReadyRef.current = true;
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
      if (nextAppState === 'active' && isAppReadyRef.current) {
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
