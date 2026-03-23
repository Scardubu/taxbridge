import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pidgin from './pidgin.json';
import { AppKV } from '../storage/kv';

i18next.use(initReactI18next).init({
  lng: AppKV.prefs.getLanguage(),
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    pidgin: { translation: pidgin },
  },
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export default i18next;
