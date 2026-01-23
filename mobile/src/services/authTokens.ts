import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

const ACCESS_TOKEN_KEY = 'auth_accessToken';
const REFRESH_TOKEN_KEY = 'auth_refreshToken';
const LEGACY_ACCESS_TOKEN_KEY = 'auth:accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'auth:refreshToken';

let secureStorePromise: Promise<typeof import('expo-secure-store') | null> | null = null;

async function getSecureStore() {
  if (!secureStorePromise) {
    secureStorePromise = import('expo-secure-store').catch(() => null);
  }
  return secureStorePromise;
}

async function getItem(key: string): Promise<string | null> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    return secureStore.getItemAsync(key).catch(() => null);
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function deleteItem(key: string): Promise<void> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

async function getItemWithLegacy(key: string, legacyKey: string): Promise<string | null> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    const secureValue = await secureStore.getItemAsync(key).catch(() => null);
    if (secureValue) {
      return secureValue;
    }
  }

  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (legacyValue && secureStore) {
    await secureStore.setItemAsync(key, legacyValue).catch(() => undefined);
    await AsyncStorage.removeItem(legacyKey).catch(() => undefined);
  }
  return legacyValue;
}

export async function getAccessToken(): Promise<string | null> {
  return getItemWithLegacy(ACCESS_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItemWithLegacy(REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY);
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    deleteItem(ACCESS_TOKEN_KEY),
    deleteItem(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY),
  ]);
}
