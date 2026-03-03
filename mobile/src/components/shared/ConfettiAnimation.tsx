/**
 * V12 §11.2 — ConfettiAnimation (GAP-14, C-42)
 *
 * Lottie-based confetti burst with mandatory onError fallback.
 * If the animation fails to load, renders a static emoji-based celebration
 * instead of crashing — per C-42: onError fallback mandatory.
 *
 * Gate check: grep -q "onError" mobile/src/components/shared/ConfettiAnimation.tsx
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfettiAnimationProps {
  /** Play the animation on mount? Default: true */
  autoPlay?: boolean;
  /** Loop the animation? Default: false (plays once) */
  loop?: boolean;
  /** Duration of fade-out after animation completes (ms). Default: 500 */
  fadeOutDuration?: number;
  /** Callback when the animation finishes or errors */
  onFinish?: () => void;
  /** Custom Lottie source override — defaults to bundled confetti.json */
  source?: string | object;
  /** Test ID */
  testID?: string;
}

// ---------------------------------------------------------------------------
// Static Fallback
// ---------------------------------------------------------------------------

const StaticFallback: React.FC<{ testID?: string }> = ({ testID }) => (
  <View style={styles.fallback} testID={testID ?? 'confetti-fallback'}>
    <Text style={styles.fallbackEmoji}>🎉</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  autoPlay = true,
  loop = false,
  fadeOutDuration = 500,
  onFinish,
  source,
  testID = 'confetti-animation',
}) => {
  const lottieRef = useRef<LottieView>(null);
  const [hasError, setHasError] = useState(false);
  const opacity = useSharedValue(1);

  // ── Error fallback (C-42) ───────────────────────────────────────────
  const onError = useCallback(
    (_err: unknown) => {
      setHasError(true);
      onFinish?.();
    },
    [onFinish],
  );

  // ── Fade-out on completion ──────────────────────────────────────────
  const handleFinish = useCallback(
    (isCancelled: boolean) => {
      if (isCancelled) return;
      opacity.value = withDelay(
        DURATION.NORMAL,
        withSequence(
          withTiming(0, {
            duration: fadeOutDuration,
            easing: EASE.STANDARD,
          }),
        ),
      );
      onFinish?.();
    },
    [fadeOutDuration, onFinish, opacity],
  );

  // ── Auto-play on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (autoPlay && lottieRef.current && !hasError) {
      lottieRef.current.play();
    }
  }, [autoPlay, hasError]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // ── Render ──────────────────────────────────────────────────────────
  if (hasError) {
    return <StaticFallback testID={`${testID}-fallback`} />;
  }

  // Resolve animation source with safe fallback
  let animationSource: string | object;
  try {
    animationSource =
      source ?? require('../../assets/animations/confetti.json');
  } catch {
    // If required JSON is missing, fall back
    return <StaticFallback testID={`${testID}-fallback`} />;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}
      pointerEvents="none"
      testID={testID}
    >
      <LottieView
        ref={lottieRef}
        source={animationSource as Parameters<typeof LottieView>[0]['source']}
        autoPlay={autoPlay}
        loop={loop}
        onAnimationFinish={handleFinish}
        onAnimationFailure={onError}
        style={styles.lottie}
        resizeMode="cover"
        renderMode="AUTOMATIC"
      />
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  fallbackEmoji: {
    fontSize: 64,
  },
});

export default ConfettiAnimation;
