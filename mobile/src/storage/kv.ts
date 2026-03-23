import AsyncStorage from '@react-native-async-storage/async-storage';

const syncCache = new Map<string, string>();
let cacheHydrated = false;

async function ensureCacheHydrated(): Promise<void> {
  if (cacheHydrated) {
    return;
  }

  const keys = await AsyncStorage.getAllKeys().catch(() => []);
  if (keys.length > 0) {
    const entries = await AsyncStorage.multiGet(keys).catch(() => []);
    entries.forEach(([key, value]) => {
      if (value != null) {
        syncCache.set(key, value);
      }
    });
  }

  cacheHydrated = true;
}

function getCachedBoolean(key: string): boolean | undefined {
  const value = syncCache.get(key);
  if (value == null) {
    return undefined;
  }
  return value === 'true';
}

export const zustandKvStorage = {
  async getItem(key: string): Promise<string | null> {
    await ensureCacheHydrated();

    const cached = syncCache.get(key);
    if (cached != null) {
      return cached;
    }

    const value = await AsyncStorage.getItem(key);
    if (value != null) {
      syncCache.set(key, value);
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    syncCache.set(key, value);
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    syncCache.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export const AppKV = {
  onboarding: {
    async getStep(): Promise<string | null> {
      return zustandKvStorage.getItem('ob:step');
    },

    async setStep(step: string): Promise<void> {
      await zustandKvStorage.setItem('ob:step', step);
    },

    async getCompletedSteps(): Promise<string[]> {
      const value = await zustandKvStorage.getItem('ob:completed');
      return value ? JSON.parse(value) : [];
    },

    async setCompletedSteps(steps: string[]): Promise<void> {
      await zustandKvStorage.setItem('ob:completed', JSON.stringify(steps));
    },

    async isDone(): Promise<boolean> {
      const value = await zustandKvStorage.getItem('ob:done');
      return value === 'true';
    },

    async setDone(done: boolean): Promise<void> {
      await zustandKvStorage.setItem('ob:done', String(done));
    },
  },

  prefs: {
    async getLanguage(): Promise<string> {
      return (await zustandKvStorage.getItem('prefs:lang')) ?? 'en';
    },

    async setLanguage(lang: string): Promise<void> {
      await zustandKvStorage.setItem('prefs:lang', lang);
    },

    async isDarkMode(): Promise<boolean> {
      const value = await zustandKvStorage.getItem('prefs:dark');
      return value === 'true';
    },

    async setDarkMode(enabled: boolean): Promise<void> {
      await zustandKvStorage.setItem('prefs:dark', String(enabled));
    },

    async isVoiceEnabled(): Promise<boolean> {
      const value = await zustandKvStorage.getItem('prefs:voice');
      return value === 'true';
    },

    async setVoiceEnabled(enabled: boolean): Promise<void> {
      await zustandKvStorage.setItem('prefs:voice', String(enabled));
    },
  },

  flags: {
    async getFlag(flag: string): Promise<boolean> {
      const value = await zustandKvStorage.getItem(`flag:${flag}`);
      return value === 'true';
    },

    async setFlag(flag: string, enabled: boolean): Promise<void> {
      await zustandKvStorage.setItem(`flag:${flag}`, String(enabled));
    },

    async getAllFlags(): Promise<Record<string, boolean>> {
      await ensureCacheHydrated();
      const keys = Array.from(syncCache.keys()).filter((key) => key.startsWith('flag:'));
      const flags: Record<string, boolean> = {};

      keys.forEach((key) => {
        flags[key.replace('flag:', '')] = getCachedBoolean(key) ?? false;
      });

      return flags;
    },
  },

  migration: {
    async hasMigrated(version: string): Promise<boolean> {
      const value = await zustandKvStorage.getItem(`migration:${version}`);
      return value === 'true';
    },

    async markMigrated(version: string): Promise<void> {
      await zustandKvStorage.setItem(`migration:${version}`, 'true');
    },
  },
};

export const AppKVSync = {
  getStepSync(): string | null {
    return syncCache.get('ob:step') ?? null;
  },

  setStepSync(step: string): void {
    syncCache.set('ob:step', step);
    void AsyncStorage.setItem('ob:step', step);
  },

  isDoneSync(): boolean {
    return getCachedBoolean('ob:done') ?? false;
  },

  setDoneSync(done: boolean): void {
    const value = String(done);
    syncCache.set('ob:done', value);
    void AsyncStorage.setItem('ob:done', value);
  },
};
