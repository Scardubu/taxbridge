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
} from 'react-native';

// 🔌 Boot services (existing or to be added)
import { warmUpSyncEngine } from '../sync/syncEngine';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width, height) * 0.42;

interface SplashScreenProps {
  onFinish: () => void;
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
      // 1️⃣ Fade in immediately (UX first)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }).start();

      // 2️⃣ Parallel warm-ups (never serial)
      await Promise.allSettled([
        warmUpSyncEngine(),
      ]);

      // 3️⃣ Enforce minimum splash duration
      const elapsed = Date.now() - startedAt.current;
      const remaining = minDurationMs - elapsed;

      if (remaining > 0) {
        await new Promise(res => setTimeout(res, remaining));
      }

      // 4️⃣ Safe exit
      if (mounted) {
        onFinish();
      }
    };

    boot();

    return () => {
      mounted = false;
    };
  }, [onFinish, minDurationMs, opacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.View style={[styles.logoWrapper, { opacity }]}>
        <Image
          source={require('../assets/logo.png')}
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
    backgroundColor: '#FFFFFF',
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
