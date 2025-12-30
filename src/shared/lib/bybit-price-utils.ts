export type BybitCategory = 'spot' | 'linear';

export interface BybitRateConfig {
  id: string;
  symbol: string | null;
  category?: BybitCategory;
  fallback?: number;
  altSymbol?: string | null;
  altCategory?: BybitCategory;
}

export interface FetchBybitRatesResult {
  rates: Record<string, number>;
  failed: string[];
}

const BYBIT_API_BASE = 'https://api.bybit.com/v5/market/tickers';

const DEFAULT_TIMEOUT_MS = 15000;

// Кеш для предотвращения множественных одновременных запросов одного символа
const activeRequestsCache = new Map<string, Promise<number>>();

// Очистка кеша через 5 секунд после завершения запроса
const cleanupCache = (key: string) => {
  setTimeout(() => {
    activeRequestsCache.delete(key);
  }, 5000);
};

const parsePrice = (ticker: Record<string, string | undefined>): number | null => {
  const possibleFields = [
    ticker.lastPrice,
    ticker.markPrice,
    ticker.indexPrice,
    ticker.bid1Price,
    ticker.ask1Price,
    ticker.prevPrice1h,
  ];

  for (const field of possibleFields) {
    if (field !== undefined) {
      const parsed = parseFloat(field);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

const fetchTicker = async (symbol: string, category: BybitCategory, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<number> => {
  // Создаем уникальный ключ для кеширования запросов
  const cacheKey = `${category}:${symbol.toUpperCase()}`;
  
  // Если запрос уже выполняется, возвращаем существующий промис
  const existingRequest = activeRequestsCache.get(cacheKey);
  if (existingRequest) {
    try {
      return await existingRequest;
    } catch (error) {
      // Если существующий запрос завершился с ошибкой, продолжаем новый
      activeRequestsCache.delete(cacheKey);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestPromise = (async () => {
    try {
      const url = new URL(BYBIT_API_BASE);
      url.searchParams.set('category', category);
      url.searchParams.set('symbol', symbol);

      const response = await fetch(url.toString(), { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const list = data?.result?.list;
      const ticker = Array.isArray(list) && list.length > 0 ? list[0] : null;
      if (!ticker) {
        const emptyError = new Error('EMPTY_RESULT');
        emptyError.name = 'EmptyResultError';
        throw emptyError;
      }

      const price = parsePrice(ticker);
      if (price === null) {
        const invalidError = new Error('INVALID_PRICE');
        invalidError.name = 'InvalidPriceError';
        throw invalidError;
      }

      return price;
    } catch (error) {
      activeRequestsCache.delete(cacheKey);
      if (error instanceof Error && (error.message === 'EMPTY_RESULT' || error.message === 'INVALID_PRICE')) {
        return null;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  // Сохраняем промис в кеш и автоматически очищаем после завершения
  activeRequestsCache.set(cacheKey, requestPromise);
  requestPromise.finally(() => {
    cleanupCache(cacheKey);
  });
  
  return requestPromise;
};

export const fetchBybitRates = async (
  configs: BybitRateConfig[],
  options?: { timeoutMs?: number }
): Promise<FetchBybitRatesResult> => {
  if (configs.length === 0) {
    return { rates: {}, failed: [] };
  }

  const rates: Record<string, number> = {};
  const failed: string[] = [];

  await Promise.allSettled(
    configs.map(async (config) => {
      try {
        const fallback = config.fallback ?? 1;

        if (!config.symbol) {
          rates[config.id] = fallback;
          return;
        }

        const candidates: Array<{ symbol: string; category: BybitCategory }> = [];

        if (config.symbol) {
          candidates.push({ symbol: config.symbol, category: config.category ?? 'spot' });
        }

        if (config.altSymbol) {
          candidates.push({ symbol: config.altSymbol, category: config.altCategory ?? 'spot' });
        }

        if (candidates.length === 0) {
          rates[config.id] = fallback;
          return;
        }

        let resolvedPrice: number | null = null;

        for (const candidate of candidates) {
          try {
            const price = await fetchTicker(
              candidate.symbol,
              candidate.category,
              options?.timeoutMs
            );
            if (price !== null && price > 0) {
              resolvedPrice = price;
              break;
            }
          } catch (error) {
            continue;
          }
        }

        if (resolvedPrice !== null) {
          rates[config.id] = resolvedPrice;
        } else {
          rates[config.id] = fallback;
          failed.push(config.id);
        }
      } catch (error) {
        // Обрабатываем любые неожиданные ошибки
        const fallback = config.fallback ?? 1;
        rates[config.id] = fallback;
        failed.push(config.id);
      }
    })
  );

  return { rates, failed };
};
