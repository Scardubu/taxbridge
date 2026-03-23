import * as SecureStore from 'expo-secure-store';

export class TokenService {
  private static readonly ACCESS_TOKEN_KEY = 'taxbridge:access_token';
  private static readonly REFRESH_TOKEN_KEY = 'taxbridge:refresh_token';
  private static readonly DEVICE_ID_KEY = 'taxbridge:device_id';

  /**
   * Store access token securely
   */
  static async setAccessToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.ACCESS_TOKEN_KEY, token, {
        requireAuthentication: false,
      });
    } catch (error) {
      console.error('Failed to store access token:', error);
      throw new Error('Could not securely store access token');
    }
  }

  /**
   * Get stored access token
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Store refresh token securely
   */
  static async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.REFRESH_TOKEN_KEY, token, {
        requireAuthentication: false,
      });
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      throw new Error('Could not securely store refresh token');
    }
  }

  /**
   * Get stored refresh token
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Store both tokens at once
   */
  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      this.setAccessToken(accessToken),
      this.setRefreshToken(refreshToken),
    ]);
  }

  /**
   * Clear all stored tokens
   */
  static async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(this.ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(this.REFRESH_TOKEN_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
      throw new Error('Could not clear stored tokens');
    }
  }

  /**
   * Check if any tokens are stored
   */
  static async hasTokens(): Promise<boolean> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);
    return !!(accessToken || refreshToken);
  }

  /**
   * Get or generate device ID
   */
  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Generate a new device ID
        deviceId = `taxbridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await SecureStore.setItemAsync(this.DEVICE_ID_KEY, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to get/generate device ID:', error);
      // Fallback to a non-persistent ID if SecureStore fails
      return `taxbridge-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Validate JWT token expiry (without verification)
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Add 30-second buffer to account for clock skew
      return payload.exp < (currentTime - 30);
    } catch {
      // If we can't parse the token, consider it expired
      return true;
    }
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  static getTimeUntilExpiry(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now();
      const expiryTime = payload.exp * 1000;
      
      return Math.max(0, expiryTime - currentTime);
    } catch {
      return 0;
    }
  }

  /**
   * Refresh token if it's close to expiring (within 5 minutes)
   */
  static async shouldRefreshToken(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      return false;
    }
    
    const timeUntilExpiry = this.getTimeUntilExpiry(accessToken);
    const fiveMinutes = 5 * 60 * 1000;
    
    return timeUntilExpiry <= fiveMinutes;
  }
}
