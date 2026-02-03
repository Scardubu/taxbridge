import i18n, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import pidgin from './pidgin.json';

export const SUPPORTED_LANGUAGES = ['en', 'pidgin'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Ensure all resources are loaded
const resources = {
  en: { translation: en },
  pidgin: { translation: pidgin }
} as const;

// Configure i18n options
const i18nOptions: InitOptions = {
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation'],
  defaultNS: 'translation',
  
  // Configure fallback behavior
  fallbackNS: 'translation',
  returnEmptyString: false,  // Return key instead of empty string
  returnNull: false,         // Return key instead of null
  returnObjects: false,
  joinArrays: ' ',
  
  // Disable missing key warnings in production
  saveMissing: __DEV__,
  missingInterpolationHandler: (text: string, value: any) => {
    console.warn(`Missing interpolation: ${text} for value:`, value);
    return text;
  },
  
  // React-specific config
  react: {
    useSuspense: false,      // Don't use Suspense for translations
    transEmptyNodeValue: '',  // Value for empty trans nodes
    transSupportBasicHtmlNodes: true,
  },
  
  interpolation: {
    escapeValue: false,
    formatSeparator: ',',
    format: (value: any, format?: string) => {
      if (format === 'currency') {
        return `₦${Number(value).toLocaleString('en-NG')}`;
      }
      if (format === 'percent') {
        return `${Number(value).toFixed(2)}%`;
      }
      return value;
    }
  }
};

// Initialize i18n synchronously to ensure context is available immediately
i18n.use(initReactI18next);
void i18n.init(i18nOptions);

export default i18n;

