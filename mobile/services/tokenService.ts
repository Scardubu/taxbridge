import * as SecureStore from 'expo-secure-store';

const ACCESS = 'taxbridge:access_token';
const REFRESH = 'taxbridge:refresh_token';

export const TokenService = {
  async setTokens(access: string, refresh: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS, access),
      SecureStore.setItemAsync(REFRESH, refresh),
    ]);
  },
  getAccessToken: () => SecureStore.getItemAsync(ACCESS),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH),
  async clearTokens() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
  },
};
