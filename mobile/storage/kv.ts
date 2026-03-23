// mobile/storage/kv.ts
// B-01, C-01, SDK-10 fixes: dual API — async for Zustand, sync for components
import Storage from 'expo-sqlite/kv-store';

// ── Async adapter ── required by Zustand createJSONStorage (SDK-10 fix) ─
export const zustandKvStorage = {
  getItem:    (key: string): Promise<string | null> => Storage.getItem(key),
  setItem:    (key: string, value: string): Promise<void> => Storage.setItem(key, value),
  removeItem: (key: string): Promise<void> => Storage.removeItem(key),
};

// ── Sync helpers ── direct component reads, < 0.1ms (C-01 fix) ─────────
export const AppKV = {
  onboarding: {
    getStep:      (): string   => Storage.getItemSync('ob:step') ?? 'welcome',
    setStep:      (id: string) => Storage.setItemSync('ob:step', id),
    isComplete:   (): boolean  => Storage.getItemSync('ob:done') === 'true',
    setComplete:  (v: boolean) => Storage.setItemSync('ob:done', String(v)),
    isMigrated:   (): boolean  => Storage.getItemSync('migration:v13') === 'true',
    markMigrated: ()           => Storage.setItemSync('migration:v13', 'true'),
  },
  prefs: {
    getLanguage:    (): 'en' | 'pidgin' => (Storage.getItemSync('pref:lang') ?? 'en') as 'en' | 'pidgin',
    setLanguage:    (l: 'en' | 'pidgin') => Storage.setItemSync('pref:lang', l),
    isDarkMode:     (): boolean  => Storage.getItemSync('pref:dark') === 'true',
    setDarkMode:    (v: boolean) => Storage.setItemSync('pref:dark', String(v)),
    isVoiceEnabled: (): boolean  => Storage.getItemSync('pref:voice') === 'true',
    setVoice:       (v: boolean) => Storage.setItemSync('pref:voice', String(v)),
  },
  flags: {
    get: (key: string, fallback = '') => Storage.getItemSync(`flag:${key}`) ?? fallback,
    set: (key: string, v: string)     => Storage.setItemSync(`flag:${key}`, v),
  },
};
