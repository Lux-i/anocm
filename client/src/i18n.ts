import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://anocm.tomatenbot.com";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: `${API_BASE}/locales/{{lng}}.json`,
    },
  });

export default i18n;
