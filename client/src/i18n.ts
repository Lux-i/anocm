import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          authPage: {
            anocm: "Anonymous Chat Messenger",
            or: "or",
            tabSwitcher: {
              login: "Login",
              register: "Registration",
            },
            buttons: {
              login: "Login",
              register: "Register",
              anonymous: "Continue Anonymously",
            },
            inputField: {
              username: "Username",
              password: "Password",
            },
          },
        },
      },
      de: {
        translation: {
          anocm: "Anonymer Chat-Messenger",
          or: "oder",
          buttons: {
            login: "Anmelden",
            register: "Registrieren",
            anonymous: "Anonym fortfahren",
          },
        },
      },
    },
  });

export default i18n;
