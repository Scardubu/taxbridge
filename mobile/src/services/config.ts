import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSetting, setSetting } from './database';

const SETTINGS_API_BASE_URL_KEY = 'api:baseUrl';
const LEGACY_ASYNCSTORAGE_API_BASE_URL_KEY = 'taxbridge_api_base_url';

function defaultApiBaseUrl(): string {
  // Default for development - works with Android emulator
  return __DEV__ ? 'http://10.0.2.2:3000' : 'https://api.taxbridge.ng';
}

function isValidUrl(url: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function getApiBaseUrl(): Promise<string> {
  // Prefer settings (stored in SQLite on device, AsyncStorage fallback)
  const stored = await getSetting(SETTINGS_API_BASE_URL_KEY).catch(() => null);
  if (stored && isValidUrl(stored)) return stored;

  // Backward compatibility: read legacy AsyncStorage key and migrate forward
  const legacy = await AsyncStorage.getItem(LEGACY_ASYNCSTORAGE_API_BASE_URL_KEY).catch(() => null);
  if (legacy && isValidUrl(legacy)) {
    await setSetting(SETTINGS_API_BASE_URL_KEY, legacy).catch(() => undefined);
    return legacy;
  }

  return defaultApiBaseUrl();
}

export async function setApiBaseUrl(url: string): Promise<void> {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL format');
  }

  await setSetting(SETTINGS_API_BASE_URL_KEY, url);
  // Also persist legacy key to keep older code paths working during rollout
  await AsyncStorage.setItem(LEGACY_ASYNCSTORAGE_API_BASE_URL_KEY, url).catch(() => undefined);
}
