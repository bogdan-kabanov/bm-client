/**
 * Единая система работы с валютными парами
 * Всегда использует формат BASE_QUOTE (например, EUR_USD, AVAX_USDT, RUB_CNY)
 */

// Список поддерживаемых котируемых валют (в порядке приоритета для парсинга)
const QUOTE_CURRENCIES = [
  'USDT', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'RUB', 'INR', 'AUD', 'CAD', 'CHF', 'NZD',
  'TRY', 'BRL', 'MXN', 'ZAR', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN',
  'THB', 'IDR', 'MYR', 'PHP', 'VND', 'BDT', 'PKR', 'KZT', 'UAH', 'AED', 'SAR',
  'ILS', 'CLP', 'COP', 'PEN', 'ARS', 'VES', 'KGS', 'AZN', 'UZS', 'TJS'
] as const;

export type QuoteCurrency = typeof QUOTE_CURRENCIES[number];

/**
 * Парсит валютную пару и возвращает base и quote
 * Поддерживает форматы: BASE_QUOTE, BASE/QUOTE, BASEQUOTE
 */
export function parseCurrencyPair(symbol: string): { base: string; quote: string } | null {
  if (!symbol) return null;
  
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9_\/]/g, '');
  
  // Если есть разделитель
  if (cleaned.includes('_') || cleaned.includes('/')) {
    const separator = cleaned.includes('_') ? '_' : '/';
    const parts = cleaned.split(separator);
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { base: parts[0], quote: parts[1] };
    }
  }
  
  // Если нет разделителя, пытаемся определить quote currency
  for (const quote of QUOTE_CURRENCIES) {
    if (cleaned.endsWith(quote) && cleaned.length > quote.length) {
      const base = cleaned.slice(0, -quote.length);
      if (base.length >= 2) {
        return { base, quote };
      }
    }
  }
  
  // Если не удалось распарсить, возвращаем null
  return null;
}

/**
 * Нормализует символ валютной пары в формат BASE_QUOTE
 * Поддерживает входные форматы: BASE_QUOTE, BASE/QUOTE, BASEQUOTE
 */
export function normalizeCurrencyPair(symbol: string): string {
  if (!symbol) return symbol;
  
  const parsed = parseCurrencyPair(symbol);
  if (parsed) {
    return `${parsed.base}_${parsed.quote}`;
  }
  
  // Если не удалось распарсить, пытаемся нормализовать как есть
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9_\/]/g, '');
  if (cleaned.includes('/')) {
    return cleaned.replace('/', '_');
  }
  
  // Если не содержит разделителя и не распарсился, возвращаем как есть
  return cleaned;
}

/**
 * Создает символ валютной пары из base и quote
 */
export function createCurrencyPairSymbol(base: string, quote: string): string {
  const normalizedBase = base.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedQuote = quote.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${normalizedBase}_${normalizedQuote}`;
}


/**
 * Получает base currency из символа
 */
export function getBaseCurrency(symbol: string): string | null {
  const parsed = parseCurrencyPair(symbol);
  return parsed?.base ?? null;
}

/**
 * Получает quote currency из символа
 */
export function getQuoteCurrency(symbol: string): string | null {
  const parsed = parseCurrencyPair(symbol);
  return parsed?.quote ?? null;
}

/**
 * Проверяет, является ли символ валидной валютной парой
 */
export function isValidCurrencyPair(symbol: string): boolean {
  return parseCurrencyPair(symbol) !== null;
}

