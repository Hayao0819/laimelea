import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as RNLocalize from "react-native-localize";

import en from "./locales/en.json";
import ja from "./locales/ja.json";

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

export const SUPPORTED_LANGUAGES = Object.keys(resources);

export function detectSystemLanguage(): string {
  const locales = RNLocalize.getLocales();
  const bestMatch = locales.find((locale) =>
    SUPPORTED_LANGUAGES.includes(locale.languageCode),
  );
  return bestMatch?.languageCode ?? "ja";
}

/** Resolve the effective language from a settings value ("auto", "en", "ja"). */
export function resolveLanguage(setting: string): string {
  if (setting === "auto" || !SUPPORTED_LANGUAGES.includes(setting)) {
    return detectSystemLanguage();
  }
  return setting;
}

const languageDetector = {
  type: "languageDetector" as const,
  async: false,
  detect: (): string => detectSystemLanguage(),
  init: () => {},
  cacheUserLanguage: () => {},
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "ja",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
