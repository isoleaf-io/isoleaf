import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-BR": { translation: ptBR },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "pt-BR"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["navigator", "localStorage", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "isohub-lng",
    },
  });

export default i18n;
