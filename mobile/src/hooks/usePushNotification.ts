/**
 * usePushNotification — TaxBridge V12
 *
 * Handles Expo push notification registration, permission requests,
 * and foreground notification behaviour.
 *
 * GAP-01: Registers device push token with the backend so the server
 *         can send compliance deadline reminders and security alerts.
 *
 * C-07: Failures are logged to Sentry but never crash the app.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../services/apiClient';
import { addBreadcrumb } from '../services/sentry';

// ─── Notification display behaviour while app is foregrounded ────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Requests notification permissions and registers the Expo push token
 * with the TaxBridge backend (`POST /api/v1/notifications/register`).
 *
 * Returns null silently on simulators (Device.isDevice is false).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications are only available on physical devices.
  if (!Device.isDevice) {
    addBreadcrumb('push-notification', 'Skipping push registration — not a physical device', 'info');
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    addBreadcrumb('push-notification', 'Push permission denied', 'warning');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TaxBridge Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0B5FFF',
    });
  }

  // Obtain the Expo push token
  let tokenData: Notifications.ExpoPushToken;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
  } catch (err) {
    addBreadcrumb('push-notification', `Failed to get Expo push token: ${String(err)}`, 'error');
    return null;
  }

  const token = tokenData.data;

  // Register token with the TaxBridge backend (best-effort)
  try {
    await apiClient.post('/api/v1/notifications/register', {
      token,
      platform: Platform.OS,
    });
    addBreadcrumb('push-notification', 'Push token registered with backend', 'info');
  } catch (err) {
    // Non-fatal — the app works without push notifications
    addBreadcrumb('push-notification', `Backend registration failed: ${String(err)}`, 'warning');
  }

  return token;
}

// ─── React hook ───────────────────────────────────────────────────────────────

interface UsePushNotificationOptions {
  /** Callback fired when a notification is received while the app is foregrounded */
  onNotification?: (notification: Notifications.Notification) => void;
  /** Callback fired when the user taps a notification (foreground or background) */
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
}

export function usePushNotification(opts: UsePushNotificationOptions = {}) {
  const notificationListener  = useRef<Notifications.EventSubscription>();
  const responseListener      = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // Attempt registration on mount — non-blocking
    registerForPushNotifications().catch((err) => {
      addBreadcrumb('push-notification', `Registration error: ${String(err)}`, 'error');
    });

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        addBreadcrumb('push-notification', `Notification received: ${notification.request.identifier}`, 'info');
        opts.onNotification?.(notification);
      },
    );

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        addBreadcrumb('push-notification', `Notification response: ${response.notification.request.identifier}`, 'info');
        opts.onNotificationResponse?.(response);
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
