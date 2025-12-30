import { convertFromUSDSync, type SupportedCurrency } from './exchangeRates';

// Реэкспортируем тип для обратной совместимости
export type { SupportedCurrency };

export interface CurrencyInfo {
  code: SupportedCurrency;
  symbol: string;
  name: string;
}

export const CURRENCY_INFO: Record<SupportedCurrency, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  COP: { code: 'COP', symbol: 'COP', name: 'Colombian Peso' },
  BSD: { code: 'BSD', symbol: 'B$', name: 'Bahamian Dollar' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  KGS: { code: 'KGS', symbol: 'KGS', name: 'Kyrgystani Som' },
  AZN: { code: 'AZN', symbol: 'AZN', name: 'Azerbaijani Manat' },
  UZS: { code: 'UZS', symbol: 'UZS', name: 'Uzbekistani Som' },
  TJS: { code: 'TJS', symbol: 'TJS', name: 'Tajikistani Somoni' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  VES: { code: 'VES', symbol: 'Bs', name: 'Venezuelan Bolívar' },
  ARS: { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
};

/**
 * Получает информацию о валюте по коду
 */
export function getCurrencyInfo(currency: SupportedCurrency | string | null | undefined): CurrencyInfo {
  if (!currency) {
    return CURRENCY_INFO.USD;
  }

  const upperCurrency = currency.toUpperCase() as SupportedCurrency;
  return CURRENCY_INFO[upperCurrency] || CURRENCY_INFO.USD;
}

/**
 * Форматирует сумму с учетом валюты
 * @param amount Сумма в USD для форматирования (будет автоматически конвертирована)
 * @param currency Код валюты (по умолчанию USD)
 * @param options Опции форматирования
 * @returns Отформатированная строка
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency | string | null | undefined = 'USD',
  options: {
    showSymbol?: boolean;
    decimals?: number;
    prefix?: boolean;
    convertFromUSD?: boolean;
    noSpace?: boolean;
  } = {}
): string {
  const { showSymbol = true, decimals = 2, prefix = true, convertFromUSD = true, noSpace = false } = options;

  const space = noSpace ? '' : ' ';
  
  if (amount === null || amount === undefined) {
    return showSymbol 
      ? (prefix ? `${getCurrencyInfo(currency).symbol}${space}0.00` : `0.00${space}${getCurrencyInfo(currency).symbol}`)
      : '0.00';
  }

  let numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return showSymbol 
      ? (prefix ? `${getCurrencyInfo(currency).symbol}${space}0.00` : `0.00${space}${getCurrencyInfo(currency).symbol}`)
      : '0.00';
  }

  if (convertFromUSD && currency && currency.toUpperCase() !== 'USD') {
    try {
      const converted = convertFromUSDSync(numAmount, currency);
      if (converted === null) {
        // Если конвертация не удалась, возвращаем исходную сумму
        return showSymbol 
          ? (prefix ? `${getCurrencyInfo(currency).symbol}${space}${numAmount.toFixed(decimals)}` : `${numAmount.toFixed(decimals)}${space}${getCurrencyInfo(currency).symbol}`)
          : numAmount.toFixed(decimals);
      }
      numAmount = converted;
    } catch (e) {
      // Игнорируем ошибки
    }
  }

  const formattedAmount = numAmount.toFixed(decimals);
  const currencyInfo = getCurrencyInfo(currency);

  if (!showSymbol) {
    return formattedAmount;
  }

  return prefix 
    ? `${currencyInfo.symbol}${space}${formattedAmount}`
    : `${formattedAmount}${space}${currencyInfo.symbol}`;
}

/**
 * Получает символ валюты
 */
export function getCurrencySymbol(currency: SupportedCurrency | string | null | undefined): string {
  return getCurrencyInfo(currency).symbol;
}

