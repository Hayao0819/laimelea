import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as RNLocalize from "react-native-localize";

import ja from "./locales/ja.json";
import en from "./locales/en.json";

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

const languageDetector = {
  type: "languageDetector" as const,
  async: false,
  detect: (): string => {
    const locales = RNLocalize.getLocales();
    const bestMatch = locales.find((locale) =>
      Object.keys(resources).includes(locale.languageCode),
    );
    return bestMatch?.languageCode ?? "ja";
  },
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
