import type { Language, TranslationModule } from './routePriorities';

const modulesGlob = import.meta.glob<{ default: any }>('../../shared/lib/i18next/locales/*/*.json', { eager: false });

export const loadModule = async (lang: Language, module: TranslationModule): Promise<Record<string, any>> => {
  const modulePath = `../../shared/lib/i18next/locales/${lang}/${module}.json`;
  
  try {
    const moduleLoader = modulesGlob[modulePath];
    if (moduleLoader) {
      const translation = await moduleLoader();
      return translation.default || translation;
    }
    throw new Error(`Module not found: ${modulePath}`);
  } catch (error) {

    try {
      const fallbackPath = `../../shared/lib/i18next/locales/en/${module}.json`;
      const fallbackLoader = modulesGlob[fallbackPath];
      if (fallbackLoader) {
        const fallback = await fallbackLoader();
        return fallback.default || fallback;
      }
      throw new Error(`Fallback module not found: ${fallbackPath}`);
    } catch (fallbackError) {

      return {};
    }
  }
};

