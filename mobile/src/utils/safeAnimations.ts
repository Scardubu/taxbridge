/**
 * Web-safe animation utilities for react-native-reanimated.
 *
 * On web, entering/exiting animations from reanimated can cause performance
 * issues or visual glitches. This module provides helpers to conditionally
 * apply animations only on native platforms.
 */
import { Platform } from 'react-native';
import {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  FadeInLeft,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  SlideInRight,
  SlideOutLeft,
  type BaseAnimationBuilder,
} from 'react-native-reanimated';

const isWeb = Platform.OS === 'web';

/**
 * Returns the animation builder on native, undefined on web.
 * Use this for `entering` / `exiting` props.
 */
export function webSafe<T extends BaseAnimationBuilder>(
  animation: T
): T | undefined {
  return isWeb ? undefined : animation;
}

// Pre-configured safe animations for common use cases
export const safeFadeIn = isWeb ? undefined : FadeIn;
export const safeFadeInDown = isWeb ? undefined : FadeInDown;
export const safeFadeInUp = isWeb ? undefined : FadeInUp;
export const safeFadeInRight = isWeb ? undefined : FadeInRight;
export const safeFadeInLeft = isWeb ? undefined : FadeInLeft;
export const safeFadeOut = isWeb ? undefined : FadeOut;
export const safeFadeOutDown = isWeb ? undefined : FadeOutDown;
export const safeFadeOutUp = isWeb ? undefined : FadeOutUp;
export const safeSlideInRight = isWeb ? undefined : SlideInRight;
export const safeSlideOutLeft = isWeb ? undefined : SlideOutLeft;

// Helper factories for animations with modifiers
export const fadeIn = {
  duration: (ms: number) => webSafe(FadeIn.duration(ms)),
  delay: (ms: number) => webSafe(FadeIn.delay(ms)),
  custom: (builder: ReturnType<typeof FadeIn.duration>) => webSafe(builder),
};

export const fadeInDown = {
  duration: (ms: number) => webSafe(FadeInDown.duration(ms)),
  delay: (ms: number) => webSafe(FadeInDown.delay(ms)),
  custom: (builder: ReturnType<typeof FadeInDown.duration>) => webSafe(builder),
};

export const fadeInUp = {
  duration: (ms: number) => webSafe(FadeInUp.duration(ms)),
  delay: (ms: number) => webSafe(FadeInUp.delay(ms)),
  custom: (builder: ReturnType<typeof FadeInUp.duration>) => webSafe(builder),
};

export default {
  webSafe,
  fadeIn,
  fadeInDown,
  fadeInUp,
  safeFadeIn,
  safeFadeInDown,
  safeFadeInUp,
  safeFadeInRight,
  safeFadeInLeft,
  safeFadeOut,
  safeFadeOutDown,
  safeFadeOutUp,
  safeSlideInRight,
  safeSlideOutLeft,
};
