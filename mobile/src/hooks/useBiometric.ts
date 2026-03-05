/**
 * TaxBridge — Biometric Authentication Hook
 *
 * Wraps expo-local-authentication to provide a consistent biometric
 * authentication API across iOS (Face ID / Touch ID) and Android
 * (fingerprint / face unlock).
 *
 * Usage:
 *   const { isAvailable, biometricType, authenticate } = useBiometric();
 *   if (isAvailable) {
 *     const ok = await authenticate('Confirm payment');
 *   }
 *
 * Offline-safe: biometric checks are device-local, no network required.
 * C-07: Never throws — returns false on any failure.
 */

import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface UseBiometricResult {
  /** Whether the device supports biometric auth */
  isAvailable: boolean;
  /** Whether biometric data is enrolled */
  isEnrolled: boolean;
  /** Detected biometric type */
  biometricType: BiometricType;
  /** Trigger biometric prompt. Returns true on success, false on cancel/failure. */
  authenticate: (promptMessage?: string) => Promise<boolean>;
  /** Loading state during initial hardware check */
  checking: boolean;
}

/**
 * Map Expo's authentication type enum to a human-readable string.
 */
function mapBiometricType(
  types: LocalAuthentication.AuthenticationType[],
): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'facial';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris';
  }
  return 'none';
}

export function useBiometric(): UseBiometricResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        if (cancelled) return;

        if (!compatible) {
          setIsAvailable(false);
          setChecking(false);
          return;
        }

        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (cancelled) return;
        setIsEnrolled(enrolled);

        const supportedTypes =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (cancelled) return;

        setIsAvailable(enrolled);
        setBiometricType(mapBiometricType(supportedTypes));
      } catch {
        // C-07: never throw — degrade gracefully
        if (!cancelled) setIsAvailable(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    probe();
    return () => { cancelled = true; };
  }, []);

  const authenticate = useCallback(
    async (promptMessage?: string): Promise<boolean> => {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: promptMessage ?? 'Authenticate to continue',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
          // On Android, allows device passcode fallback if biometric fails
          fallbackLabel: Platform.OS === 'ios' ? 'Use Passcode' : undefined,
        });
        return result.success;
      } catch {
        // C-07: never throw — return false
        return false;
      }
    },
    [],
  );

  return {
    isAvailable,
    isEnrolled,
    biometricType,
    authenticate,
    checking,
  };
}

export default useBiometric;
