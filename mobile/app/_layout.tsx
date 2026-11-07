import 'react-native-reanimated';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Pressable, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
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
import { Colors, Typography, Spacing, Radii } from '../components/design-system/tokens';

export type BootstrapState =
  | 'BOOTING'
  | 'HYDRATING'
  | 'READY'
  | 'READY_OFFLINE'
  | 'RECOVERABLE_ERROR'
  | 'FATAL_INITIALIZATION_ERROR';

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

function waitForHydration(): Promise<boolean> {
  return new Promise((resolve) => {
    if (useOnboardingStore.getState()._hasHydrated) {
      console.log('[HYDRATION] waitForHydration: already hydrated on entry');
      resolve(true);
      return;
    }

    const _t0 = Date.now();
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
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
        finish(true);
      }
    });

    timeoutId = setTimeout(() => {
      unsub();
      console.log('[HYDRATION] waitForHydration: timeout fired — attempting authoritative KV recovery');
      AppKV.flags.getPreviewMode()
        .then((previewMode) => {
          useOnboardingStore.setState({ _hasHydrated: true, previewMode: previewMode ?? false });
          finish(true);
        })
        .catch((err) => {
          Sentry.captureMessage(
            'waitForHydration timeout and KV fallback failed; entering recoverable error state',
            'warning'
          );
          finish(false);
        });
    }, 4000);
  });
}

function RootLayout() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('BOOTING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isAppReadyRef = useRef(false);
  const isBootingRef = useRef(false);
  const hydrateProfile = useBusinessProfileStore((state) => state.hydrate);

  const runBootstrap = useCallback(async () => {
    if (isBootingRef.current) return;
    isBootingRef.current = true;
    setBootstrapState('BOOTING');
    setErrorMessage(null);

    const _bootT0 = Date.now();
    console.log('[BOOT] RootLayout boot start', { timestamp: _bootT0 });
    Sentry.addBreadcrumb({ category: 'boot', message: 'RootLayout boot start', level: 'info', data: { timestamp: _bootT0 } });

    let dbInitialized = false;

    try {
      await initializeI18n();

      await initDatabase();
      dbInitialized = true;

      await runStorageMigration();

      setBootstrapState('HYDRATING');
      await useOnboardingStore.persist.rehydrate();
      const hydrationOk = await waitForHydration();

      if (!hydrationOk) {
        throw new Error('Onboarding state could not be restored within timeout.');
      }

      await hydrateProfile();

      offlineQueue.start();

      const net = await NetInfo.fetch();
      const isOnline = net.isConnected ?? false;

      isAppReadyRef.current = true;
      setBootstrapState(isOnline ? 'READY' : 'READY_OFFLINE');

      console.log('[BOOT] RootLayout boot complete', { isOnline, elapsed: Date.now() - _bootT0 });
      Sentry.addBreadcrumb({ category: 'boot', message: 'RootLayout boot complete', level: 'info', data: { isOnline, elapsed: Date.now() - _bootT0 } });

      void offlineQueue.flush().catch((err) => Sentry.captureException(err));
    } catch (error: any) {
      Sentry.captureException(error);
      const msg = error?.message || 'Initialization failed.';
      setErrorMessage(msg);
      isAppReadyRef.current = false;

      if (!dbInitialized) {
        setBootstrapState('FATAL_INITIALIZATION_ERROR');
      } else {
        setBootstrapState('RECOVERABLE_ERROR');
      }
    } finally {
      isBootingRef.current = false;
      await SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrateProfile]);

  useEffect(() => {
    void runBootstrap();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAppReadyRef.current) {
        void (async () => {
          try {
            await initDatabase();
            offlineQueue.start();
            // Reconcile server-accepted operations on app resume. Network
            // transitions are not guaranteed to emit while the app is paused.
            await offlineQueue.flush();
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
  }, [runBootstrap]);

  const isReady = bootstrapState === 'READY' || bootstrapState === 'READY_OFFLINE';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="auto" />
          {isReady ? (
            <Slot />
          ) : bootstrapState === 'BOOTING' || bootstrapState === 'HYDRATING' ? (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.ui.bg,
                alignItems: 'center',
                justifyContent: 'center',
                padding: Spacing.xl,
              }}
              accessibilityRole="text"
              accessibilityLabel="Initializing TaxBridge"
            >
              <ActivityIndicator color={Colors.brand.primary} size="large" />
              <Text
                style={{
                  marginTop: Spacing.lg,
                  color: Colors.ui.textMuted,
                  ...Typography.caption,
                }}
              >
                {bootstrapState === 'HYDRATING' ? 'Restoring business profile...' : 'Starting TaxBridge...'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.ui.bg,
                alignItems: 'center',
                justifyContent: 'center',
                padding: Spacing.xl,
              }}
            >
              <Text style={{ fontSize: 36, marginBottom: Spacing.md }}>⚠️</Text>
              <Text
                style={{
                  color: Colors.ui.text,
                  ...Typography.title,
                  textAlign: 'center',
                  marginBottom: Spacing.sm,
                }}
              >
                {bootstrapState === 'FATAL_INITIALIZATION_ERROR'
                  ? 'Database Initialization Failed'
                  : 'Unable to Load Profile'}
              </Text>
              <Text
                style={{
                  color: Colors.ui.textMuted,
                  ...Typography.body,
                  textAlign: 'center',
                  marginBottom: Spacing.xl,
                }}
              >
                {errorMessage || 'TaxBridge encountered a startup error. Your saved data is protected.'}
              </Text>
              <Pressable
                onPress={() => void runBootstrap()}
                accessibilityRole="button"
                accessibilityLabel="Retry initialization"
                style={{
                  backgroundColor: Colors.brand.primary,
                  paddingHorizontal: Spacing.xxl,
                  paddingVertical: Spacing.md,
                  borderRadius: Radii.lg,
                  minHeight: 48,
                  minWidth: 160,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: Colors.ui.white, ...Typography.bodyBold }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          )}
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
