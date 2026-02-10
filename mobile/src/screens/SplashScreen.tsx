/**
 * TaxBridge Splash Screen – Production Boot Orchestrator
 *
 * Responsibilities:
 *  - Visual brand entry
 *  - Sync engine warm-up
 *  - Feature-flag hydration
 *  - Safe navigation handoff
 *
 * Design principles:
 *  - Never block app startup
 *  - Offline-first friendly
 *  - Zero native / external deps
 *  - Deterministic timing
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';

// 🔌 Boot services (existing or to be added)
import { warmUpSyncEngine } from '../sync/syncEngine';
import { hydrateFeatureFlags } from '../services/featureFlags';
import { colors } from '../theme/tokens';
import i18n from '../i18n';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width, height) * 0.42;
const BOOT_TIMEOUT_MS = 8000;

interface SplashScreenProps {
  onFinish: (bootData?: { deviceInfo: any; persistedState: any }) => void;
  minDurationMs?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 1800,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      // 0️⃣ Hide the native expo splash now that our custom splash is rendering
      ExpoSplashScreen.hideAsync().catch(() => undefined);

      // 1️⃣ Fade in immediately (UX first)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      // 2️⃣ Parallel warm-ups (never serial)
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const bootTasks = Promise.allSettled([
        warmUpSyncEngine(),
        hydrateFeatureFlags(),
        // Ensure i18n is fully initialized before proceeding
        i18n.isInitialized ? Promise.resolve() : new Promise<void>((resolve) => {
          i18n.on('initialized', () => resolve());
        }),
      ]);
      const bootTimeout = new Promise<'timeout'>((resolve) => {
        timeoutId = setTimeout(() => resolve('timeout'), BOOT_TIMEOUT_MS);
      });
      const bootResult = await Promise.race([bootTasks, bootTimeout]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const syncEngineResult = bootResult === 'timeout' ? null : bootResult[0];
      
      // Extract device info and persisted state
      let bootData: { deviceInfo: any; persistedState: any } | undefined;
      if (syncEngineResult?.status === 'fulfilled') {
        bootData = syncEngineResult.value;
      }

      // 3️⃣ Enforce minimum splash duration
      const elapsed = Date.now() - startedAt.current;
      const remaining = minDurationMs - elapsed;

      if (remaining > 0) {
        await new Promise(res => setTimeout(res, remaining));
      }

      // 4️⃣ Hand off without fade-out to avoid a blank transition frame
      if (mounted) {
        onFinish(bootData);
      }
    };

    boot();

    return () => {
      mounted = false;
    };
  }, [onFinish, minDurationMs, opacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <Animated.View style={[styles.logoWrapper, { opacity }]}><Image
          source={require('../../assets/icon-square.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});

export default SplashScreen;
