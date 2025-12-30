import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export interface TranslationResources {
  translation: {
    welcome: string;
    about: string;
    contact: string;
    home: {
      title: string;
      subtitle: string;
    };
  };
}

const resources = {
  en: {
    translation: {
      welcome: "Welcome",
      about: "About us",
      contact: "Contact",
      home: {
        title: "Home Page",
        subtitle: "Welcome to our website"
      }
    }
  },
  ru: {
    translation: {
      welcome: "Добро пожаловать",
      about: "О нас",
      contact: "Контакты",
      home: {
        title: "Главная страница",
        subtitle: "Добро пожаловать на наш сайт"
      }
    }
  }
} as const;

export type Language = keyof typeof resources;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;