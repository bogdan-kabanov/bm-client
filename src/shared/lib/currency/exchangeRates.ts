import { apiClient } from '@src/shared/api/client';

// Определяем тип валюты здесь, чтобы избежать циклической зависимости
export type SupportedCurrency = 
  | 'USD'  // По умолчанию
  | 'COP'  // Колумбия
  | 'BSD'  // Багамы (B$)
  | 'BRL'  // Бразилия
  | 'EUR'  // Евро (€)
  | 'AED'  // ОАЭ
  | 'KGS'  // Киргизия
  | 'AZN'  // Азербайджан
  | 'UZS'  // Узбекистан
  | 'TJS'  // Таджикистан
  | 'TRY'  // Турция (₺)
  | 'IDR'  // Индонезия
  | 'VND'  // Вьетнам
  | 'BDT'  // Бангладеш
  | 'CNY'  // Китай
  | 'INR'  // Индия
  | 'MYR'  // Малайзия
  | 'THB'  // Таиланд (฿)
  | 'VES'  // Венесуэла
  | 'ARS'; // Аргентина

// НЕТ КЭША НА КЛИЕНТЕ - всегда запрашиваем с сервера
// currentRates используется только для синхронных функций (convertFromUSDSync, convertToUSDSync)
// после того как курсы были загружены через fetchExchangeRates()
let currentRates: Record<string, number> | null = null;
let hasRealRates: boolean = false; // Флаг, что загружены реальные курсы

/**
 * Получает курсы валют к USD с нашего сервера
 * Возвращает null, если не удалось загрузить реальные курсы
 * ВАЖНО: Нет кэша - всегда запрашивает свежие курсы с сервера
 */
export async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  // НЕТ КЭША - всегда запрашиваем с сервера
  try {
    // Запрашиваем курсы с нашего сервера
    const response = await apiClient<{
      success: boolean;
      rates: Record<string, number>;
      timestamp: number;
      base: string;
      error?: string;
    }>('/fiat-exchange-rates', {
      method: 'GET',
      noAuth: true, // Публичный эндпоинт
    });

    if (response.success && response.rates) {
      const rates = response.rates;
      
      // Валидация курсов
      const validationChecks: Record<string, { min: number; max: number }> = {
        'INR': { min: 50, max: 150 },
        'EUR': { min: 0.5, max: 1.5 },
        'GBP': { min: 0.5, max: 1.5 },
        'CNY': { min: 5, max: 10 },
      };
      
      let isValid = true;
      let validationErrors: string[] = [];
      for (const [currency, range] of Object.entries(validationChecks)) {
        if (rates[currency] !== undefined) {
          const rate = rates[currency];
          if (rate < range.min || rate > range.max) {
            validationErrors.push(`${currency}: ${rate} (expected ${range.min}-${range.max})`);
            isValid = false;
          }
        }
      }
      
      if (isValid) {
        // Сохраняем только для синхронных функций (не кэшируем для следующих запросов)
        currentRates = rates;
        hasRealRates = true;
        
        // Логируем для отладки
        if (rates.INR) {
          console.log('[exchangeRates] ✅ INR rate from server:', rates.INR, '(Expected: ~90)');
          // Проверяем, что курс разумный
          if (rates.INR > 1000 || rates.INR < 10) {
            console.error('[exchangeRates] ⚠️ SUSPICIOUS INR rate detected:', rates.INR);
          }
        }
        
        return rates;
      } else {
        console.warn('[exchangeRates] Rates validation failed:', validationErrors);
        return null;
      }
    } else {
      throw new Error(response.error || 'Invalid response from server');
    }
  } catch (error: any) {
    console.error('[exchangeRates] Error fetching exchange rates from server:', error.message);
    hasRealRates = false;
    return null;
  }
}

/**
 * Конвертирует сумму из USD в указанную валюту
 * Возвращает null, если курсы недоступны
 * ВАЖНО: Всегда запрашивает свежие курсы с сервера (нет кэша)
 */
export async function convertFromUSD(
  amountUSD: number,
  targetCurrency: SupportedCurrency | string
): Promise<number | null> {
  if (targetCurrency === 'USD' || !targetCurrency) {
    return amountUSD;
  }

  const rates = await fetchExchangeRates();
  if (!rates) {
    return null;
  }

  const rate = rates[targetCurrency.toUpperCase()];
  if (!rate) {
    return null;
  }

  return amountUSD * rate;
}

/**
 * Синхронная версия конвертации (использует текущие курсы, если они загружены)
 * Возвращает null, если реальные курсы недоступны
 * ВАЖНО: Для получения актуальных курсов используйте fetchExchangeRates() перед вызовом
 */
export function convertFromUSDSync(
  amountUSD: number,
  targetCurrency: SupportedCurrency | string
): number | null {
  if (targetCurrency === 'USD' || !targetCurrency) {
    return amountUSD;
  }

  // Если нет реальных курсов, возвращаем null
  // Не логируем предупреждение - это нормальная ситуация при первой загрузке приложения
  if (!hasRealRates || !currentRates) {
    return null;
  }

  const upperCurrency = targetCurrency.toUpperCase();
  const rate = currentRates[upperCurrency];
  
  // Если курс не найден, возвращаем null
  if (rate === undefined || rate === null) {
    console.warn(`[exchangeRates] convertFromUSDSync: Rate not found for ${upperCurrency}. Available rates:`, Object.keys(currentRates));
    return null;
  }

  // Валидация результата конвертации
  const result = amountUSD * rate;
  
  // Логируем конвертацию для отладки (особенно для больших сумм)
  if (result > 100000 || result < 0 || !isFinite(result)) {
    console.warn(`[exchangeRates] ⚠️ Conversion result: ${amountUSD} USD * ${rate} = ${result} ${upperCurrency}`);
  } else {
    console.log(`[exchangeRates] Conversion: ${amountUSD} USD * ${rate} = ${result} ${upperCurrency}`);
  }
  
  return result;
}

/**
 * Конвертирует сумму из указанной валюты в USD
 * Возвращает null, если реальные курсы недоступны
 * ВАЖНО: Для получения актуальных курсов используйте fetchExchangeRates() перед вызовом
 */
export function convertToUSDSync(
  amount: number,
  sourceCurrency: SupportedCurrency | string
): number | null {
  if (sourceCurrency === 'USD' || !sourceCurrency) {
    return amount;
  }

  // Если нет реальных курсов, возвращаем null
  if (!hasRealRates || !currentRates) {
    return null;
  }

  const upperCurrency = sourceCurrency.toUpperCase();
  const rate = currentRates[upperCurrency];
  
  // Если курс не найден или равен 0, возвращаем null
  if (rate === undefined || rate === null || rate === 0) {
    return null;
  }

  const result = amount / rate;
  
  // Логируем конвертацию для отладки (только для подозрительных значений)
  if (result > 1000000 || result < 0 || !isFinite(result)) {
    console.warn(`[exchangeRates] ⚠️ Conversion to USD: ${amount} ${sourceCurrency} / ${rate} = ${result} USD`);
  } else if (amount > 1000) {
    console.log(`[exchangeRates] Conversion to USD: ${amount} ${sourceCurrency} / ${rate} = ${result} USD`);
  }
  
  return result;
}

/**
 * Проверяет, доступны ли реальные курсы валют
 */
export function hasRealExchangeRates(): boolean {
  return hasRealRates && currentRates !== null;
}

/**
 * Очищает текущие курсы валют
 */
export function clearExchangeRatesCache(): void {
  currentRates = null;
  hasRealRates = false;
}

/**
 * Инициализирует загрузку курсов валют (вызывать при старте приложения)
 * Всегда запрашивает свежие курсы с сервера (без кэша)
 */
export async function initializeExchangeRates(): Promise<void> {
  try {
    await fetchExchangeRates();
  } catch (error) {
    // Не используем fallback - просто не загружаем курсы
    hasRealRates = false;
    console.error('[exchangeRates] Failed to initialize exchange rates:', error);
  }
}
