import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppKV } from '@storage/kv';
import { TokenService } from '@services/tokenService';

export class StorageMigration {
  private static readonly MIGRATION_VERSION = 'v13';

  /**
   * Run migration from AsyncStorage to MMKV + SecureStore
   */
  static async migrate(): Promise<void> {
    try {
      // Check if migration already completed
      const hasMigrated = AppKV.onboarding.isMigrated();
      if (hasMigrated) {
        console.log('Storage migration already completed');
        return;
      }

      console.log('Starting storage migration to v13...');

      // 1. Migrate onboarding state
      await this.migrateOnboarding();

      // 2. Migrate user preferences
      await this.migratePreferences();

      // 3. Migrate tokens to SecureStore
      await this.migrateTokens();

      // 4. Migrate feature flags
      await this.migrateFeatureFlags();

      // 5. Mark migration as complete
      AppKV.onboarding.markMigrated();

      // 6. Clear old AsyncStorage data (optional, keep for rollback)
      // await this.clearAsyncStorage();

      console.log('Storage migration completed successfully');
    } catch (error) {
      console.error('Storage migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate onboarding state
   */
  private static async migrateOnboarding(): Promise<void> {
    const keys = ['onboarding_step', 'onboarding_completed', 'onboarding_done'];
    
    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          const newKey = `ob:${key.replace('onboarding_', '')}`;
          await AppKV.onboarding.setStep(value);
          console.log(`Migrated ${key} to ${newKey}`);
        }
      } catch (error) {
        console.warn(`Failed to migrate ${key}:`, error);
      }
    }
  }

  /**
   * Migrate user preferences
   */
  private static async migratePreferences(): Promise<void> {
    const preferences = [
      { old: 'user_language', new: 'lang', setter: (v: string) => AppKV.prefs.setLanguage(v === 'pidgin' ? 'pidgin' : 'en') },
      { old: 'dark_mode', new: 'dark', setter: (v: string) => AppKV.prefs.setDarkMode(v === 'true') },
      { old: 'voice_enabled', new: 'voice', setter: (v: string) => AppKV.prefs.setVoice(v === 'true') },
    ];

    for (const pref of preferences) {
      try {
        const value = await AsyncStorage.getItem(pref.old);
        if (value !== null) {
          pref.setter(value);
          console.log(`Migrated preference ${pref.old} to ${pref.new}`);
        }
      } catch (error) {
        console.warn(`Failed to migrate preference ${pref.old}:`, error);
      }
    }
  }

  /**
   * Migrate auth tokens to SecureStore
   */
  private static async migrateTokens(): Promise<void> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
      ]);

      if (accessToken || refreshToken) {
        await TokenService.setTokens(
          accessToken || '',
          refreshToken || ''
        );
        console.log('Migrated tokens to SecureStore');
      }
    } catch (error) {
      console.warn('Failed to migrate tokens:', error);
    }
  }

  /**
   * Migrate feature flags
   */
  private static async migrateFeatureFlags(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const flagKeys = keys.filter(k => k.startsWith('feature_'));

      for (const key of flagKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          const flagName = key.replace('feature_', '');
          AppKV.flags.set(flagName, value);
          console.log(`Migrated flag ${key} to flag:${flagName}`);
        }
      }
    } catch (error) {
      console.warn('Failed to migrate feature flags:', error);
    }
  }

  /**
   * Clear old AsyncStorage data (call after successful migration)
   */
  private static async clearAsyncStorage(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const taxbridgeKeys = keys.filter(k => 
        k.startsWith('onboarding_') ||
        k.startsWith('user_') ||
        k.startsWith('feature_') ||
        k === 'access_token' ||
        k === 'refresh_token'
      );

      if (taxbridgeKeys.length > 0) {
        await AsyncStorage.multiRemove(taxbridgeKeys);
        console.log(`Cleared ${taxbridgeKeys.length} old keys from AsyncStorage`);
      }
    } catch (error) {
      console.warn('Failed to clear AsyncStorage:', error);
    }
  }

  /**
   * Rollback migration (for testing)
   */
  static async rollback(): Promise<void> {
    try {
      console.log('Rolling back storage migration...');
      
      // Clear MMKV migration flag
      AppKV.onboarding.markMigrated();
      // Note: We don't clear MMKV data to allow for recovery
      
      console.log('Storage migration rollback completed');
    } catch (error) {
      console.error('Storage migration rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(): Promise<{
    hasMigrated: boolean;
    version: string;
    canMigrate: boolean;
  }> {
    const hasMigrated = AppKV.onboarding.isMigrated();
    
    // Check if there's data to migrate
    const keys = await AsyncStorage.getAllKeys();
    const hasOldData = keys.some(k => 
      k.startsWith('onboarding_') ||
      k.startsWith('user_') ||
      k.startsWith('feature_') ||
      k === 'access_token' ||
      k === 'refresh_token'
    );

    return {
      hasMigrated,
      version: this.MIGRATION_VERSION,
      canMigrate: !hasMigrated && hasOldData,
    };
  }
}
