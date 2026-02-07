/**
 * Platform-safe haptics wrapper.
 *
 * expo-haptics is technically a no-op on web, but importing and calling it
 * still creates unnecessary async overhead.  This wrapper short-circuits on
 * web so the calls are truly free, and keeps native behaviour unchanged.
 */
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Lazy-load expo-haptics only on native to avoid web bundling overhead
let _Haptics: typeof import('expo-haptics') | null = null;

function getHaptics() {
  if (!_Haptics && !isWeb) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _Haptics = require('expo-haptics');
    } catch {
      _Haptics = null;
    }
  }
  return _Haptics;
}

export const ImpactFeedbackStyle = {
  Light: 'Light' as const,
  Medium: 'Medium' as const,
  Heavy: 'Heavy' as const,
};

export const NotificationFeedbackType = {
  Success: 'Success' as const,
  Warning: 'Warning' as const,
  Error: 'Error' as const,
};

export async function impactAsync(
  style: keyof typeof ImpactFeedbackStyle = 'Medium'
): Promise<void> {
  if (isWeb) return;
  const H = getHaptics();
  if (H) {
    await H.impactAsync(H.ImpactFeedbackStyle[style]);
  }
}

export async function notificationAsync(
  type: keyof typeof NotificationFeedbackType = 'Success'
): Promise<void> {
  if (isWeb) return;
  const H = getHaptics();
  if (H) {
    await H.notificationAsync(H.NotificationFeedbackType[type]);
  }
}

export async function selectionAsync(): Promise<void> {
  if (isWeb) return;
  const H = getHaptics();
  if (H) {
    await H.selectionAsync();
  }
}

const SafeHaptics = {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default SafeHaptics;
