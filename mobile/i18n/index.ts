import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pidgin from './pidgin.json';
import { AppKV } from '../storage/kv';

export type SupportedLanguage = 'en' | 'pidgin';

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'pidgin' ? 'pidgin' : 'en';
}

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    pidgin: { translation: pidgin },
  },
  interpolation: { escapeValue: false },
  initImmediate: false,
});

let initializationPromise: Promise<void> | null = null;

export async function initializeI18n(): Promise<void> {
  initializationPromise ??= (async () => {
    const language = normalizeLanguage(await AppKV.prefs.getLanguageAsync());

    if (i18next.resolvedLanguage !== language) {
      await i18next.changeLanguage(language);
    }
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });

  await initializationPromise;
}

export default i18next;
