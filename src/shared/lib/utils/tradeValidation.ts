import { convertToUSDSync, convertFromUSDSync } from '@src/shared/lib/currency/exchangeRates';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';

export interface TradeValidationResult {
  valid: boolean;
  error?: string;
  errorParams?: Record<string, any>;
}

export interface TradeValidationParams {
  amount: number;
  amountInUserCurrency: number;
  userCurrency: string;
  minAmountUSD?: number;
  balance: number;
  expirationSeconds: number;
  minExpirationSeconds?: number;
  price: number | null;
  tradingMode: 'manual' | 'demo';
}

export const validateTrade = (params: TradeValidationParams): TradeValidationResult => {
  const {
    amount,
    amountInUserCurrency,
    userCurrency,
    minAmountUSD = 1,
    balance,
    expirationSeconds,
    minExpirationSeconds = 30,
    price,
    tradingMode,
  } = params;

  if (amountInUserCurrency <= 0) {
    return {
      valid: false,
      error: 'trading.tradeAmountMustBeGreaterThanZero',
    };
  }

  if (amount < minAmountUSD) {
    const minAmountInUserCurrency = userCurrency === 'USD' 
      ? minAmountUSD 
      : convertFromUSDSync(minAmountUSD, userCurrency);
    const formattedMinAmount = formatCurrency(minAmountInUserCurrency, userCurrency, { convertFromUSD: false });
    return {
      valid: false,
      error: 'trading.tradeAmountMustBeAtLeastOneDollar',
      errorParams: { amount: formattedMinAmount },
    };
  }

  if (amount > balance) {
    const balanceInUserCurrency = userCurrency === 'USD' 
      ? balance 
      : convertFromUSDSync(balance, userCurrency);
    const formattedBalance = formatCurrency(balanceInUserCurrency, userCurrency, { convertFromUSD: false });
    return {
      valid: false,
      error: 'trading.insufficientFunds',
      errorParams: { balance: formattedBalance },
    };
  }

  if (expirationSeconds < minExpirationSeconds) {
    return {
      valid: false,
      error: 'trading.expirationTimeMustBeAtLeast30Seconds',
    };
  }

  if (!price || price <= 0) {
    return {
      valid: false,
      error: 'trading.priceNotAvailable',
    };
  }

  return { valid: true };
};

