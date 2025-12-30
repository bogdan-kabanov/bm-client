import { storage } from '../storage';

export interface Candle {
  x: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
}

interface CachedCandlesData {
  candles: Candle[];
  timestamp: number; // время кеширования
  oldestTime: number; // время самой старой свечи
  newestTime: number; // время самой новой свечи
}

interface CachedCandlesEntry {
  data: CachedCandlesData;
  lastAccess: number; // время последнего доступа для LRU
}

// Memory cache для быстрого доступа
const memoryCache = new Map<string, CachedCandlesEntry>();

// Максимальное количество записей в memory cache
const MAX_MEMORY_CACHE_SIZE = 50;

// Время жизни кеша в localStorage (24 часа)
const LOCALSTORAGE_CACHE_TTL = 24 * 60 * 60 * 1000;

// Максимальное количество свечей в кеше для одной валютной пары и таймфрейма
const MAX_CANDLES_PER_CACHE = 1000;

// Ключ для localStorage
const getStorageKey = (currencyId: number, timeframe: string): string => {
  return `candles_cache_${currencyId}_${timeframe}`;
};

// Ключ для memory cache
const getMemoryKey = (currencyId: number, timeframe: string, startIndex?: number, endIndex?: number): string => {
  if (startIndex !== undefined && endIndex !== undefined) {
    return `candles_${currencyId}_${timeframe}_${startIndex}_${endIndex}`;
  }
  return `candles_${currencyId}_${timeframe}_all`;
};

/**
 * Очистка старых записей из memory cache по LRU
 */
const cleanupMemoryCache = () => {
  if (memoryCache.size <= MAX_MEMORY_CACHE_SIZE) {
    return;
  }

  // Сортируем по времени последнего доступа и удаляем самые старые
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  
  const toRemove = entries.slice(0, entries.length - MAX_MEMORY_CACHE_SIZE);
  toRemove.forEach(([key]) => {
    memoryCache.delete(key);
  });
};

/**
 * Сохранение в memory cache
 */
const saveToMemoryCache = (
  currencyId: number,
  timeframe: string,
  candles: Candle[],
  startIndex?: number,
  endIndex?: number
): void => {
  if (candles.length === 0) {
    return;
  }

  const key = getMemoryKey(currencyId, timeframe, startIndex, endIndex);
  const oldestTime = candles[0].x;
  const newestTime = candles[candles.length - 1].x;

  memoryCache.set(key, {
    data: {
      candles: [...candles], // копируем массив
      timestamp: Date.now(),
      oldestTime,
      newestTime,
    },
    lastAccess: Date.now(),
  });

  cleanupMemoryCache();
};

/**
 * Сохранение в localStorage
 */
const saveToLocalStorage = (
  currencyId: number,
  timeframe: string,
  candles: Candle[]
): void => {
  if (candles.length === 0) {
    return;
  }

  try {
    const oldestTime = candles[0].x;
    const newestTime = candles[candles.length - 1].x;

    const cacheData: CachedCandlesData = {
      candles: candles.slice(0, MAX_CANDLES_PER_CACHE), // ограничиваем размер
      timestamp: Date.now(),
      oldestTime,
      newestTime,
    };

    const key = getStorageKey(currencyId, timeframe);
    storage.setJson(key, cacheData);
  } catch (error) {
    // Если localStorage заполнен, просто игнорируем ошибку
    console.warn('[CandlesCache] Не удалось сохранить в localStorage:', error);
  }
};

/**
 * Загрузка из memory cache
 */
const loadFromMemoryCache = (
  currencyId: number,
  timeframe: string,
  startIndex?: number,
  endIndex?: number
): Candle[] | null => {
  const key = getMemoryKey(currencyId, timeframe, startIndex, endIndex);
  const entry = memoryCache.get(key);

  if (!entry) {
    return null;
  }

  // Обновляем время последнего доступа
  entry.lastAccess = Date.now();

  return entry.data.candles;
};

/**
 * Загрузка из localStorage
 */
const loadFromLocalStorage = (
  currencyId: number,
  timeframe: string
): Candle[] | null => {
  try {
    const key = getStorageKey(currencyId, timeframe);
    const cached = storage.getJson<CachedCandlesData>(key);

    if (!cached || !cached.candles || !Array.isArray(cached.candles)) {
      return null;
    }

    // Проверяем TTL
    const now = Date.now();
    if (now - cached.timestamp > LOCALSTORAGE_CACHE_TTL) {
      // Кеш устарел, удаляем
      storage.remove(key);
      return null;
    }

    // Проверяем, что свечи не слишком старые (старше 7 дней удаляем)
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
    const newestTime = cached.newestTime || 0;
    if (now - newestTime > MAX_AGE) {
      storage.remove(key);
      return null;
    }

    return cached.candles;
  } catch (error) {
    console.warn('[CandlesCache] Ошибка загрузки из localStorage:', error);
    return null;
  }
};

/**
 * Сохранение свечей в кеш
 */
export const saveCandlesToCache = (
  currencyId: number,
  timeframe: string,
  candles: Candle[],
  options?: {
    startIndex?: number;
    endIndex?: number;
    useLocalStorage?: boolean;
  }
): void => {
  if (candles.length === 0) {
    return;
  }

  // Сохраняем в memory cache
  saveToMemoryCache(currencyId, timeframe, candles, options?.startIndex, options?.endIndex);

  // Сохраняем в localStorage только если это полный набор свечей (не диапазон)
  if (options?.useLocalStorage !== false && options?.startIndex === undefined && options?.endIndex === undefined) {
    saveToLocalStorage(currencyId, timeframe, candles);
  }
};

/**
 * Загрузка свечей из кеша
 */
export const loadCandlesFromCache = (
  currencyId: number,
  timeframe: string,
  options?: {
    startIndex?: number;
    endIndex?: number;
    maxAge?: number; // максимальный возраст кеша в миллисекундах
  }
): Candle[] | null => {
  // Сначала проверяем memory cache
  const memoryCached = loadFromMemoryCache(currencyId, timeframe, options?.startIndex, options?.endIndex);
  if (memoryCached) {
    // Проверяем максимальный возраст
    if (options?.maxAge) {
      const entry = memoryCache.get(getMemoryKey(currencyId, timeframe, options?.startIndex, options?.endIndex));
      if (entry && Date.now() - entry.data.timestamp > options.maxAge) {
        // Кеш слишком старый - возвращаем null, чтобы запросить свежие данные с сервера
        console.log(`[CandlesCache] ⚠️ Кеш устарел (${Math.round((Date.now() - entry.data.timestamp) / 1000)}s), запрашиваем свежие данные`);
        return null;
      }
    }
    return memoryCached;
  }

  // Если это запрос диапазона, не используем localStorage
  if (options?.startIndex !== undefined || options?.endIndex !== undefined) {
    return null;
  }

  // Проверяем localStorage
  const localStorageCached = loadFromLocalStorage(currencyId, timeframe);
  if (localStorageCached) {
    // Проверяем максимальный возраст для localStorage тоже
    if (options?.maxAge) {
      const key = getStorageKey(currencyId, timeframe);
      const cached = storage.getJson<CachedCandlesData>(key);
      if (cached && Date.now() - cached.timestamp > options.maxAge) {
        // Кеш слишком старый - удаляем и возвращаем null
        console.log(`[CandlesCache] ⚠️ localStorage кеш устарел (${Math.round((Date.now() - cached.timestamp) / 1000)}s), запрашиваем свежие данные`);
        storage.remove(key);
        return null;
      }
    }
    // Сохраняем в memory cache для быстрого доступа в следующий раз
    saveToMemoryCache(currencyId, timeframe, localStorageCached);
    return localStorageCached;
  }

  return null;
};

/**
 * Получение свечей из кеша с фильтрацией по времени
 */
export const getCachedCandlesByTimeRange = (
  currencyId: number,
  timeframe: string,
  startTime: number,
  endTime: number
): Candle[] | null => {
  // Загружаем все свечи из кеша
  const allCandles = loadCandlesFromCache(currencyId, timeframe);
  
  if (!allCandles || allCandles.length === 0) {
    return null;
  }

  // Фильтруем по диапазону времени
  const filtered = allCandles.filter(candle => candle.x >= startTime && candle.x <= endTime);
  
  return filtered.length > 0 ? filtered : null;
};

/**
 * Очистка кеша для конкретной валютной пары и таймфрейма
 */
export const clearCache = (currencyId: number, timeframe: string): void => {
  // Очищаем memory cache
  const keysToDelete: string[] = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(`candles_${currencyId}_${timeframe}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => memoryCache.delete(key));

  // Очищаем localStorage
  const storageKey = getStorageKey(currencyId, timeframe);
  storage.remove(storageKey);
};

/**
 * Очистка всего кеша
 */
export const clearAllCache = (): void => {
  memoryCache.clear();
  
  // Очищаем все ключи localStorage, начинающиеся с candles_cache_
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('candles_cache_')) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[CandlesCache] Ошибка очистки localStorage:', error);
  }
};

/**
 * Получение статистики кеша (для отладки)
 */
export const getCacheStats = (): {
  memoryCacheSize: number;
  localStorageKeys: string[];
} => {
  const localStorageKeys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('candles_cache_')) {
        localStorageKeys.push(key);
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }

  return {
    memoryCacheSize: memoryCache.size,
    localStorageKeys,
  };
};

