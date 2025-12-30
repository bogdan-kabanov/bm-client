// Список всех доступных языков
export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
}

export const languages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'el', name: 'Greek', nativeName: 'ελληνικά' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'hy', name: 'Armenian', nativeName: 'հայերեն' },
  { code: 'id', name: 'Indonesian', nativeName: 'Indonesian' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'ms', name: 'Malay', nativeName: 'Malay' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'th', name: 'Thai', nativeName: 'Thai' },
  { code: 'tl', name: 'Filipino', nativeName: 'Pilipinas' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Ўзбекча' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

export type LanguageCode = typeof languages[number]['code'];

export const getLanguageByCode = (code: string): LanguageInfo | undefined => {
  return languages.find(lang => lang.code === code);
};

