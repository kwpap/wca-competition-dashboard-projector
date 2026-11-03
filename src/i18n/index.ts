import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readJson, storageKeys, type UiSettings } from '../state/storage';
import el from './el.json';
import en from './en.json';

/** Supported languages. Names stay in their own language, so anyone can find theirs. */
export const LANGUAGES = {
  en: 'English',
  el: 'Ελληνικά',
} as const;

export type Language = keyof typeof LANGUAGES;

/** Language of the control screen and start pages, as saved on this device. */
export function savedLanguage(): Language {
  const language = readJson<Partial<UiSettings>>(storageKeys.uiSettings, {}).language;
  return language && language in LANGUAGES ? language : 'en';
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

// Add a language by creating e.g. de.json with the same keys and listing it here and in LANGUAGES.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el },
  },
  lng: savedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
