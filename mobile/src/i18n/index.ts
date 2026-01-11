import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import pidgin from './pidgin.json';

export const SUPPORTED_LANGUAGES = ['en', 'pidgin'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    pidgin: { translation: pidgin }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;

