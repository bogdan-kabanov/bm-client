import React, { createContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';

export type Language = 
  | 'en' | 'ru' | 'it' | 'fr' | 'ar' | 'tr' | 'fa' | 'hr' | 'bn' | 'sw' 
  | 'nl' | 'ha' | 'az' | 'ka' | 'pt' | 'pl' | 'th' | 'ms' | 'ja' | 'sr' 
  | 'hi' | 'uk' | 'ky' | 'yo' | 'af' | 'uz' | 'es' | 'id' | 'vi' | 'zh' 
  | 'ko' | 'ro' | 'el' | 'tl' | 'kk' | 'ig' | 'tg' | 'hy' | 'de' | 'cs';

export interface TranslationData {
  [key: string]: string | TranslationData;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string> & { defaultValue?: string }) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translationCache: Map<Language, TranslationData> = new Map();
const languagesGlob = import.meta.glob<{ default: any }>('@src/shared/lib/i18next/langs/*.json', { eager: false });

const getLanguageLoader = (lang: Language): (() => Promise<{ default: any }>) | undefined => {
  const globKeys = Object.keys(languagesGlob);
  const normalizedLang = lang.toLowerCase();
  
  const matchingKey = globKeys.find(key => {
    const normalizedKey = key.toLowerCase();
    return normalizedKey.endsWith(`/${normalizedLang}.json`) || normalizedKey.endsWith(`\\${normalizedLang}.json`);
  });
  
  if (matchingKey) {
    return languagesGlob[matchingKey];
  }
  
  return undefined;
};

const loadLanguageFile = async (lang: Language): Promise<TranslationData> => {
  if (translationCache.has(lang)) {
    const cached = translationCache.get(lang)!;
    return cached;
  }
  
  const loader = getLanguageLoader(lang);
  
  if (!loader) {
    throw new Error(`Language file not found for ${lang}`);
  }
  
  try {
    const translation = await loader();
    
    let data = translation.default || translation;
    
    if (data && typeof data === 'object' && 'default' in data && typeof data.default === 'object') {
      data = data.default;
    }
    
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid language data for ${lang}`);
    }
    
    if (Array.isArray(data)) {
      throw new Error(`Invalid language data structure for ${lang}: expected object, got array`);
    }
    
    translationCache.set(lang, data);
    return data;
  } catch (error) {
    throw error;
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

const getNestedValue = (obj: TranslationData, path: string): string => {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (typeof current === 'object' && current !== null && key in (current as TranslationData)) {
      return (current as TranslationData)[key];
    }
    return path;
  }, obj) as string;
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language');
      if (saved) {
        const supportedLanguages: string[] = ['en', 'ru', 'it', 'fr', 'ar', 'tr', 'fa', 'hr', 'bn', 'sw', 
          'nl', 'ha', 'az', 'ka', 'pt', 'pl', 'th', 'ms', 'ja', 'sr', 
          'hi', 'uk', 'ky', 'yo', 'af', 'uz', 'es', 'id', 'vi', 'zh', 
          'ko', 'ro', 'el', 'tl', 'kk', 'ig', 'tg', 'hy', 'de', 'cs'];
        if (supportedLanguages.includes(saved)) {
          return saved as Language;
        }
      }
    }
    return 'en';
  });

  const [translations, setTranslations] = useState<TranslationData>({});
  const translationsRef = useRef<TranslationData>({});
  const isLanguageChangingRef = useRef(false);
  const initialLanguageRef = useRef(language);

  const applyLanguage = useCallback(async (lang: Language) => {
    if (isLanguageChangingRef.current) {
      return;
    }
    isLanguageChangingRef.current = true;
    try {
      const data = await loadLanguageFile(lang);
      translationsRef.current = data;
      setTranslations(data);
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', lang);
      }
    } catch (error) {
      if (lang !== 'en') {
        try {
          const fallback = await loadLanguageFile('en');
          translationsRef.current = fallback;
          setTranslations(fallback);
          setLanguageState('en');
          if (typeof window !== 'undefined') {
            localStorage.setItem('language', 'en');
          }
        } catch (fallbackError) {
          translationsRef.current = {};
          setTranslations({});
        }
      } else {
        translationsRef.current = {};
        setTranslations({});
      }
    } finally {
      isLanguageChangingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isLanguageChangingRef.current && Object.keys(translationsRef.current).length === 0) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
          if (Object.keys(translationsRef.current).length === 0) {
            applyLanguage(initialLanguageRef.current);
          }
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          if (Object.keys(translationsRef.current).length === 0) {
            applyLanguage(initialLanguageRef.current);
          }
        }, 100);
      }
    }
  }, []);

  const handleSetLanguage = useCallback(async (lang: Language) => {
    if (lang === language || isLanguageChangingRef.current) {
      return;
    }
    initialLanguageRef.current = lang;
    await applyLanguage(lang);
  }, [language, applyLanguage]);

  const t = useCallback((key: string, params?: Record<string, string> & { defaultValue?: string }): string => {
    if (!key || typeof key !== 'string') {
      return key || '';
    }
    
    // Извлекаем defaultValue из params
    const defaultValue = params?.defaultValue;
    const translationParams = params ? { ...params } : undefined;
    if (translationParams && 'defaultValue' in translationParams) {
      delete translationParams.defaultValue;
    }
    
    // Используем translations из state, чтобы функция обновлялась при смене языка
    const currentTranslations = translations;
    
    // Загружаем переводы лениво при первом использовании
    if (Object.keys(currentTranslations).length === 0 && !isLanguageChangingRef.current) {
      applyLanguage(initialLanguageRef.current);
      return defaultValue || key; // Возвращаем defaultValue или ключ пока переводы загружаются
    }
    
    const [module, ...rest] = key.split('.');
    const moduleData = currentTranslations[module];
    
    if (!moduleData || typeof moduleData !== 'object') {
      return defaultValue || key;
    }

    if (rest.length === 0) {
      const result = typeof moduleData === 'string' ? moduleData : (defaultValue || key);
      return result;
    }

    let translation: string | TranslationData = moduleData;
    
    for (const part of rest) {
      if (typeof translation === 'object' && translation !== null && part in translation) {
        translation = (translation as TranslationData)[part];
      } else {
        return defaultValue || key;
      }
    }

    if (typeof translation !== 'string') {
      return defaultValue || key;
    }

    let result: string = translation;

    if (translationParams && Object.keys(translationParams).length > 0) {
      Object.keys(translationParams).forEach(param => {
        result = result.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), translationParams[param]);
        result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), translationParams[param]);
      });
    }
    
    return result;
  }, [translations, applyLanguage]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage: handleSetLanguage,
    t
  }), [language, handleSetLanguage, t, translations]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

