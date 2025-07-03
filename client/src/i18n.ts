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
          authPage: {
            anocm: "Anonymer Chat-Messenger",
            or: "oder",
            tabSwitcher: {
              login: "Anmeldung",
              register: "Registrierung",
            },
            buttons: {
              login: "Anmelden",
              register: "Registrieren",
              anonymous: "Anonym fortfahren",
            },
            inputField: {
              username: "Benutzername",
              password: "Kennwort",
            },
          },
        },
      },
      fr: {
        translation: {
          authPage: {
            anocm: "Messager de chat anonyme",
            or: "ou",
            tabSwitcher: {
              login: "Connexion",
              register: "Inscription",
            },
            buttons: {
              login: "Connexion",
              register: "Inscription",
              anonymous: "Continuer anonymement",
            },
            inputField: {
              username: "Nom d'utilisateur",
              password: "Mot de passe",
            },
          },
        },
      },
    },
  });

export default i18n;
