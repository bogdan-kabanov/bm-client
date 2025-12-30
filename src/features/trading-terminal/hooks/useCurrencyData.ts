import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useSelector } from 'react-redux';

import { type Currency, type CurrencyCategory } from '@src/shared/api';
import { getApiBaseUrl } from '@src/shared/api/client/apiClient';
import { preloadImages } from '@src/shared/lib/imageOptimization';
import {
  selectCurrencyCategories,
  selectCurrencyCategoriesLoading,
} from '@src/entities/currency/model/selectors';

import { getFallbackCurrency } from '../constants/currencies';
import { LOCAL_CURRENCY_ICONS } from '../constants/currencyIcons';

// Глобальный кеш для отслеживания неудачных URL-ов иконок
const failedIconUrlsCache = new Set<string>();

// Функция для добавления URL в кеш неудачных
export const markIconUrlAsFailed = (url: string) => {
  failedIconUrlsCache.add(url);
};

// Функция для проверки, является ли URL неудачным
export const isIconUrlFailed = (url: string): boolean => {
  return failedIconUrlsCache.has(url);
};

// Глобальный кеш удален - теперь используется Redux

const stripCommonQuoteSuffix = (symbol: string): string => symbol.replace(/(USDT|USDC|USD|BTC|ETH)$/i, '');

type UseCurrencyDataResult = {
  currencyCategories: CurrencyCategory[];
  currenciesLoading: boolean;
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  favoriteCurrencies: string[];
  setFavoriteCurrencies: Dispatch<SetStateAction<string[]>>;
  getCurrencyInfo: (baseCurrency: string) => Currency | undefined;
  updateSelectedCurrencyInfo: (baseCurrency: string) => void;
  setForcedCurrency: (base: string, quote: string) => void;
  resolveCurrencyIconUrls: (currency?: Currency | null) => string[];
  resolveCurrencyAveragePrice: (baseCurrency: string) => number | null;
};

export const MAX_FAVORITE_CURRENCIES = 6;

const readFavoriteCurrencies = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const saved = localStorage.getItem('favoriteCurrencies');
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.slice(0, MAX_FAVORITE_CURRENCIES);
    }
  } catch {
    // ignore malformed storage
  }

  return [];
};

export const useCurrencyData = (selectedBase: string): UseCurrencyDataResult => {
  // Получаем данные из Redux
  const currencyCategories = useSelector(selectCurrencyCategories);
  const currenciesLoading = useSelector(selectCurrencyCategoriesLoading);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  // Храним принудительно выбранную валюту (base_currency + quote_currency)
  const [forcedCurrency, setForcedCurrency] = useState<{ base: string; quote: string } | null>(null);
  const [favoriteCurrencies, setFavoriteCurrencies] = useState<string[]>(readFavoriteCurrencies);
  // Флаг для отслеживания, была ли выполнена начальная установка категории
  const hasInitializedCategoryRef = useRef(false);

  const updateFavoriteCurrencies = useCallback<Dispatch<SetStateAction<string[]>>>(
    (value) => {
      setFavoriteCurrencies((prev) => {
        const next = typeof value === 'function' ? (value as (current: string[]) => string[])(prev) : value;
        if (!Array.isArray(next)) {
          return prev;
        }
        const normalized = next.filter((item, index, arr) => arr.indexOf(item) === index);
        const limited = normalized.slice(0, MAX_FAVORITE_CURRENCIES);
        if (limited.length === prev.length && limited.every((item, index) => item === prev[index])) {
          return prev;
        }
        return limited;
      });
    },
    [],
  );

  // Загрузка категорий и валют теперь выполняется один раз в TradingPage при монтировании
  // Данные доступны через Redux селекторы

  // Устанавливаем первую категорию по умолчанию только один раз при первой загрузке
  // Это позволяет пользователю выбирать вкладку "Все" (null) без автоматической переустановки
  useEffect(() => {
    if (currencyCategories.length > 0 && !hasInitializedCategoryRef.current && selectedCategoryId === null) {
      hasInitializedCategoryRef.current = true;
      // По умолчанию оставляем null (вкладка "Все"), а не первую категорию
      // Если нужно выбрать первую категорию по умолчанию, раскомментируйте следующую строку:
      // setSelectedCategoryId(currencyCategories[0]?.id || null);
    }
  }, [currencyCategories, selectedCategoryId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (favoriteCurrencies.length > MAX_FAVORITE_CURRENCIES) {
      localStorage.setItem('favoriteCurrencies', JSON.stringify(favoriteCurrencies.slice(0, MAX_FAVORITE_CURRENCIES)));
    } else {
      localStorage.setItem('favoriteCurrencies', JSON.stringify(favoriteCurrencies));
    }
  }, [favoriteCurrencies]);

  const allCurrenciesMap = useMemo(() => {
    const map = new Map<string, Currency>();
    for (const category of currencyCategories) {
      const list = category.currencies ?? [];
      for (const currency of list) {
        if (currency?.base_currency) {
          const existing = map.get(currency.base_currency);
          // Если уже есть валюта с таким base_currency, выбираем ту, у которой больше profit_percentage (приоритет)
          if (!existing || (currency.profit_percentage ?? 0) > (existing.profit_percentage ?? 0)) {
            map.set(currency.base_currency, currency);
          }
        }
      }
    }
    return map;
  }, [currencyCategories]);

  const getCurrencyInfo = useCallback(
    (baseCurrency: string): Currency | undefined => {
      // Если есть принудительно выбранная валюта для этого base_currency, используем её
      if (forcedCurrency && forcedCurrency.base === baseCurrency) {
        // Ищем валюту с нужным quote_currency
        for (const category of currencyCategories) {
          const list = category.currencies ?? [];
          const found = list.find(
            (c) => c.base_currency === baseCurrency && c.quote_currency === forcedCurrency.quote
          );
          if (found) {
            return found;
          }
        }
      }
      // Иначе используем стандартную логику (выбор по profit_percentage)
      const currency = allCurrenciesMap.get(baseCurrency);
      // Если валюты уже загружены, возвращаем найденную валюту или undefined (не используем fallback)
      // Fallback используется только если валюты еще не загружены
      if (currenciesLoading) {
        return currency ?? getFallbackCurrency(baseCurrency);
      }
      // После загрузки валют используем только реальные данные с положительными ID
      return currency;
    },
    [allCurrenciesMap, forcedCurrency, currencyCategories, currenciesLoading],
  );

  // Сбрасываем forcedCurrency при изменении selectedBase (если базовая валюта изменилась)
  useEffect(() => {
    if (forcedCurrency && forcedCurrency.base !== selectedBase) {
      setForcedCurrency(null);
    }
  }, [selectedBase]); // Убираем forcedCurrency из зависимостей, чтобы избежать бесконечного цикла

  const updateSelectedCurrencyInfo = useCallback(
    (baseCurrency: string) => {
      if (typeof window === 'undefined') {
        return;
      }
      // Удаляем сохраненную информацию о валюте, так как больше не используем bybit
      localStorage.removeItem('selectedCurrencyInfo');
    },
    [],
  );

  const setForcedCurrencyHandler = useCallback(
    (base: string, quote: string) => {
      setForcedCurrency({ base, quote });
    },
    [],
  );


  const resolveCurrencyIconUrls = useCallback((currency?: Currency | null): string[] => {
    if (!currency) {
      return [];
    }

    const uniqueUrls: string[] = [];
    const base = currency.base_currency?.toUpperCase();

    const addUrl = (url?: string | null) => {
      // Пропускаем URL-ы, которые уже были помечены как неудачные
      if (url && !uniqueUrls.includes(url) && !isIconUrlFailed(url)) {
        uniqueUrls.push(url);
      }
    };

    const rawIcon = typeof currency.icon === 'string' ? currency.icon.trim() : null;

    const buildAbsoluteIconUrl = (iconPath: string): string | null => {
      if (!iconPath || typeof iconPath !== 'string') {
        return null;
      }
      
      const trimmedPath = iconPath.trim();
      if (!trimmedPath) {
        return null;
      }
      
      // Если уже абсолютный URL, возвращаем как есть
      if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
        return trimmedPath;
      }
      
      if (typeof window === 'undefined') {
        return null;
      }
      
      // Используем тот же базовый URL, что и для API
      const baseUrl = getApiBaseUrl();
      
      // Если путь начинается с /v3/, убираем префикс /v3 и добавляем baseUrl
      // baseUrl уже содержит /v3, поэтому убираем его из пути
      if (trimmedPath.startsWith('/v3/')) {
        const pathWithoutV3 = trimmedPath.replace(/^\/v3/, '');
        return `${baseUrl}${pathWithoutV3}`;
      }
      
      // Если путь начинается с /uploads/, добавляем baseUrl
      // baseUrl уже содержит /v3, поэтому просто добавляем путь
      if (trimmedPath.startsWith('/uploads/')) {
        return `${baseUrl}${trimmedPath}`;
      }
      
      // Если путь не начинается с /, добавляем /uploads/currency-icons/
      if (!trimmedPath.startsWith('/')) {
        return `${baseUrl}/uploads/currency-icons/${trimmedPath}`;
      }
      
      // Для всех остальных случаев добавляем baseUrl
      return `${baseUrl}${trimmedPath}`;
    };

    // Приоритет 1: локальные иконки (из assets/currency с хешами Vite) - пробуем сначала локальные
    if (base) {
      const localIcon = LOCAL_CURRENCY_ICONS[base];
      if (localIcon) {
        addUrl(localIcon);
      }
    }

    // Приоритет 2: иконка из базы данных (с сервера)
    if (rawIcon) {
      const dbIconUrl = buildAbsoluteIconUrl(rawIcon);
      if (dbIconUrl) {
        addUrl(dbIconUrl);
      }
    }

    // Приоритет 3: иконки из папки currency-icons через API (пробуем разные форматы и варианты)
    if (base && typeof window !== 'undefined') {
      // Используем тот же базовый URL, что и для API
      const baseUrl = getApiBaseUrl();
      // Пробуем разные форматы: svg, png, jpg (webp убран, так как файлы не существуют на сервере)
      const currencyIconExtensions = ['svg', 'png', 'jpg'];
      // Пробуем разные варианты названий: полное название, в нижнем регистре, с разными регистрами
      const nameVariants = [
        base, // BTC, AVAX
        base.toLowerCase(), // btc, avax
        base.charAt(0) + base.slice(1).toLowerCase(), // Btc, Avax
      ];
      
      for (const nameVariant of nameVariants) {
        for (const ext of currencyIconExtensions) {
          addUrl(`${baseUrl}/uploads/currency-icons/${nameVariant}.${ext}`);
        }
      }
    }

    // Приоритет 4: иконки из папки /assets/images/ (статические файлы с хешами)
    if (base && typeof window !== 'undefined') {
      // Пробуем разные форматы: svg, png, jpg, jpeg (webp убран, так как файлы не существуют)
      const currencyIconExtensions = ['svg', 'png', 'jpg', 'jpeg'];
      // Пробуем разные варианты названий: полное название, в нижнем регистре, с разными регистрами
      const nameVariants = [
        base, // BTC, AVAX
        base.toLowerCase(), // btc, avax
        base.charAt(0) + base.slice(1).toLowerCase(), // Btc, Avax
      ];
      
      for (const nameVariant of nameVariants) {
        for (const ext of currencyIconExtensions) {
          addUrl(`/assets/images/${nameVariant}.${ext}`);
        }
      }
    }



    return uniqueUrls;
  }, []);

  const resolveCurrencyAveragePrice = useCallback(
    (baseCurrency: string): number | null => {
      if (!baseCurrency) {
        return null;
      }
      // Возвращаем цену из данных валюты, если она есть
      const currency = getCurrencyInfo(baseCurrency);
      if (currency) {
        const rawAverage = currency.average_price ?? currency.avg_price;
        if (rawAverage !== null && rawAverage !== undefined) {
          const numeric = typeof rawAverage === 'number' ? rawAverage : Number(rawAverage);
          if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
          }
        }
      }
      return null;
    },
    [getCurrencyInfo],
  );

  // Предзагрузка иконок избранных валют
  useEffect(() => {
    if (favoriteCurrencies.length === 0 || currencyCategories.length === 0) {
      return;
    }

    const preloadFavoriteIcons = async () => {
      const iconUrlsToPreload: string[] = [];
      
      for (const baseCurrency of favoriteCurrencies) {
        const currency = getCurrencyInfo(baseCurrency);
        if (currency) {
          const urls = resolveCurrencyIconUrls(currency);
          iconUrlsToPreload.push(...urls.slice(0, 2)); // Берем первые 2 URL для предзагрузки
        }
      }

      if (iconUrlsToPreload.length > 0) {
        // Предзагружаем с ограничением параллельных запросов
        preloadImages(iconUrlsToPreload, 3).catch(() => {
          // Игнорируем ошибки предзагрузки
        });
      }
    };

    // Запускаем предзагрузку с небольшой задержкой, чтобы не блокировать основной рендер
    const timeoutId = setTimeout(preloadFavoriteIcons, 500);
    return () => clearTimeout(timeoutId);
  }, [favoriteCurrencies, currencyCategories, getCurrencyInfo, resolveCurrencyIconUrls]);

  return {
    currencyCategories,
    currenciesLoading,
    selectedCategoryId,
    setSelectedCategoryId,
    favoriteCurrencies,
    setFavoriteCurrencies: updateFavoriteCurrencies,
    getCurrencyInfo,
    updateSelectedCurrencyInfo,
    setForcedCurrency: setForcedCurrencyHandler,
    resolveCurrencyIconUrls,
    resolveCurrencyAveragePrice,
  };
};


