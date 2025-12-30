/**
 * Утилиты для оптимизации загрузки изображений
 */

// Кэш успешно загруженных изображений
const imageCache = new Map<string, boolean>();

// Кэш предзагруженных изображений
const preloadedImages = new Map<string, HTMLImageElement>();

// Кэш неудачных URL-ов (чтобы не пытаться загружать их повторно)
const failedUrlsCache = new Set<string>();

// Кэш URL-ов, которые сейчас загружаются (чтобы избежать дублирования запросов)
const loadingUrls = new Set<string>();

// Проверка, является ли URL неудачным
const isUrlFailed = (url: string): boolean => {
  return failedUrlsCache.has(url);
};

// Пометить URL как неудачный
const markUrlAsFailed = (url: string): void => {
  failedUrlsCache.add(url);
  loadingUrls.delete(url); // Удаляем из загружающихся
  
  // Также синхронизируем с глобальным кешем, если доступен
  try {
    const currencyDataModule = require('@src/features/trading-terminal/hooks/useCurrencyData');
    if (currencyDataModule?.markIconUrlAsFailed) {
      currencyDataModule.markIconUrlAsFailed(url);
    }
  } catch {
    // Модуль недоступен, продолжаем
  }
};

// Проверка поддержки современных форматов
const supportsWebP = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

const supportsAVIF = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
};

// Определение оптимального формата изображения
export const getOptimalImageFormat = (url: string): string => {
  if (!url) return url;
  
  // Если URL уже содержит формат, возвращаем как есть
  if (/\.(webp|avif|png|jpg|jpeg|svg)$/i.test(url)) {
    return url;
  }
  
  // Пробуем заменить расширение на оптимальное
  if (supportsAVIF()) {
    return url.replace(/\.(png|jpg|jpeg|webp)$/i, '.avif');
  }
  
  if (supportsWebP()) {
    return url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  }
  
  return url;
};

// Получение локального fallback URL из assets/currency через LOCAL_CURRENCY_ICONS
const getLocalFallbackUrl = async (url: string): Promise<string | null> => {
  if (!url || typeof window === 'undefined') {
    return null;
  }

  // Извлекаем имя валюты из URL (например, из /uploads/currency-icons/BTC.webp)
  const urlMatch = url.match(/currency-icons\/([^\/]+)\.(webp|svg|png|jpg|jpeg)$/i);
  if (!urlMatch) {
    return null;
  }

  const [, currencyName] = urlMatch;
  const currencyKey = currencyName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  try {
    // Динамически импортируем LOCAL_CURRENCY_ICONS
    const { LOCAL_CURRENCY_ICONS } = await import('@src/features/trading-terminal/constants/currencyIcons');
    return LOCAL_CURRENCY_ICONS[currencyKey] || null;
  } catch {
    return null;
  }
};

// Предзагрузка изображения с fallback на локальные файлы
export const preloadImage = (url: string, fallbackUrl?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url || typeof window === 'undefined') {
      resolve(false);
      return;
    }
    
    // Проверяем, не является ли URL уже известным как неудачный
    if (isUrlFailed(url)) {
      resolve(false);
      return;
    }
    
    // Проверяем, не загружается ли уже этот URL
    if (loadingUrls.has(url)) {
      // Уже загружается, просто возвращаем false чтобы не создавать дублирующие запросы
      // Результат будет доступен через кэш позже
      resolve(false);
      return;
    }
    
    // Также проверяем через глобальный кеш неудачных URL-ов (если доступен)
    try {
      // Проверяем глобальный кеш из useCurrencyData
      const currencyDataModule = require('@src/features/trading-terminal/hooks/useCurrencyData');
      if (currencyDataModule?.isIconUrlFailed && currencyDataModule.isIconUrlFailed(url)) {
        markUrlAsFailed(url);
        resolve(false);
        return;
      }
    } catch {
      // Модуль недоступен или произошла ошибка, продолжаем
    }
    
    // Проверяем кэш успешно загруженных
    if (imageCache.has(url)) {
      resolve(true);
      return;
    }
    
    // Проверяем предзагруженные изображения
    if (preloadedImages.has(url)) {
      const img = preloadedImages.get(url)!;
      if (img.complete && img.naturalWidth > 0) {
        imageCache.set(url, true);
        resolve(true);
        return;
      }
    }
    
    // Помечаем URL как загружающийся
    loadingUrls.add(url);
    
    // Для всех изображений используем прямую загрузку через Image
    // Image.onerror будет вызван если файл не существует, и мы обработаем это через tryFallback
    // Это избегает 404 ошибок в консоли от HEAD запросов
    loadImage(url, fallbackUrl, (success: boolean) => {
      loadingUrls.delete(url); // Удаляем из загружающихся
      resolve(success);
    });
  });
};

// Вспомогательная функция для загрузки изображения
const loadImage = (
  url: string,
  fallbackUrl: string | undefined,
  resolve: (value: boolean) => void
): void => {
  // Финальная проверка перед созданием Image объекта - если URL уже failed, не создаем запрос
  if (isUrlFailed(url)) {
    resolve(false);
    return;
  }
  
  // Также проверяем глобальный кеш перед созданием Image
  try {
    const currencyDataModule = require('@src/features/trading-terminal/hooks/useCurrencyData');
    if (currencyDataModule?.isIconUrlFailed && currencyDataModule.isIconUrlFailed(url)) {
      markUrlAsFailed(url);
      resolve(false);
      return;
    }
  } catch {
    // Модуль недоступен, продолжаем
  }
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  img.onload = () => {
    imageCache.set(url, true);
    preloadedImages.set(url, img);
    loadingUrls.delete(url);
    resolve(true);
  };
  
  img.onerror = () => {
    // Помечаем URL как неудачный перед попыткой fallback
    markUrlAsFailed(url);
    loadingUrls.delete(url);
    tryFallback(url, fallbackUrl, resolve);
  };
  
  img.src = url;
};

// Вспомогательная функция для попытки использовать fallback
const tryFallback = (
  url: string,
  fallbackUrl: string | undefined,
  resolve: (value: boolean) => void
): void => {
  // Если есть явный fallback URL, пробуем его
  if (fallbackUrl) {
    const fallbackImg = new Image();
    fallbackImg.crossOrigin = 'anonymous';
    fallbackImg.onload = () => {
      imageCache.set(fallbackUrl, true);
      preloadedImages.set(fallbackUrl, fallbackImg);
      resolve(true);
    };
    fallbackImg.onerror = () => {
      markUrlAsFailed(fallbackUrl);
      resolve(false);
    };
    fallbackImg.src = fallbackUrl;
    return;
  }
  
  // Пробуем автоматический fallback на локальный файл из assets/currency
  getLocalFallbackUrl(url).then((localFallback) => {
    if (localFallback) {
      const localImg = new Image();
      localImg.crossOrigin = 'anonymous';
      localImg.onload = () => {
        imageCache.set(localFallback, true);
        preloadedImages.set(localFallback, localImg);
        resolve(true);
      };
      localImg.onerror = () => {
        markUrlAsFailed(localFallback);
        resolve(false);
      };
      localImg.src = localFallback;
    } else {
      resolve(false);
    }
  }).catch(() => {
    resolve(false);
  });
};

// Предзагрузка нескольких изображений с ограничением параллельных запросов
export const preloadImages = async (
  urls: string[],
  maxConcurrent: number = 5
): Promise<Map<string, boolean>> => {
  const results = new Map<string, boolean>();
  const queue = [...urls];
  
  const processBatch = async (): Promise<void> => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) continue;
      
      const success = await preloadImage(url);
      results.set(url, success);
    }
  };
  
  // Запускаем несколько параллельных батчей
  const batches = Array.from({ length: Math.min(maxConcurrent, urls.length) }, () => processBatch());
  await Promise.all(batches);
  
  return results;
};

// Проверка, загружено ли изображение
export const isImageCached = (url: string): boolean => {
  return imageCache.has(url);
};

// Проверка, является ли URL неудачным (для использования в компонентах)
export const isImageUrlFailed = (url: string): boolean => {
  if (isUrlFailed(url)) {
    return true;
  }
  
  // Также проверяем глобальный кеш
  try {
    const currencyDataModule = require('@src/features/trading-terminal/hooks/useCurrencyData');
    if (currencyDataModule?.isIconUrlFailed && currencyDataModule.isIconUrlFailed(url)) {
      return true;
    }
  } catch {
    // Модуль недоступен
  }
  
  return false;
};

// Проверка, загружается ли изображение
export const isImageLoading = (url: string): boolean => {
  return loadingUrls.has(url);
};

// Очистка кэша
export const clearImageCache = (): void => {
  imageCache.clear();
  preloadedImages.clear();
  failedUrlsCache.clear();
  loadingUrls.clear();
};

// Получение приоритета загрузки для изображения
export const getImagePriority = (
  isImportant: boolean = false,
  isAboveFold: boolean = false
): 'high' | 'low' | 'auto' => {
  if (isImportant || isAboveFold) {
    return 'high';
  }
  return 'auto';
};

