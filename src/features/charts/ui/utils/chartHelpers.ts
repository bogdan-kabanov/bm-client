import { ChartTimeframe } from '../types';
import { BYBIT_INTERVAL_MAP } from '../constants/chartConstants';

export const normalizeBase = (base: string): string => {
  const cleaned = base.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : base;
};

export const getBybitSymbol = (
  currencyInfo?: { bybit_symbol?: string | null },
  normalizedBase?: string
): string => {
  const base = normalizedBase || '';
  return (currencyInfo?.bybit_symbol || `${base.toUpperCase()}USDT`).toUpperCase();
};

export const isForexPair = (symbol: string): boolean => {
  return /^(EUR|GBP|JPY|AUD|CAD|CHF)/i.test(symbol);
};

export const isTradFiAsset = (symbol: string): boolean => {
  return /^(AAPL|TSLA|MSFT|GOOGL|AMZN|META|NVDA|NFLX|AMD|INTC|SPX|NAS100|DJI|RUT|XAU|XAG|UKOIL|BRENT|WTI)/i.test(symbol);
};

export const getBybitCategory = (symbol: string): 'spot' | 'linear' => {
  return (isForexPair(symbol) || isTradFiAsset(symbol)) ? 'linear' : 'spot';
};

export const getBybitRequestSymbol = (symbol: string): string => {
  const upperSymbol = symbol.toUpperCase();
  if (isForexPair(upperSymbol) && upperSymbol.endsWith('USDT')) {
    return upperSymbol.replace('USDT', 'USD');
  }
  return upperSymbol;
};

export const getBybitInterval = (timeframe: ChartTimeframe): string => {
  return BYBIT_INTERVAL_MAP[timeframe] || '1';
};

export const getWebSocketUrl = (category: 'spot' | 'linear'): string => {
  const market = category === 'spot' ? 'spot' : 'linear';
  return `wss://stream.bybit.com/v5/public/${market}`;
};

export const getApiUrl = (): string => {
  return 'https://api.bybit.com/v5/market/kline';
};

export const validateCandle = (candle: any): boolean => {
  if (!candle) return false;
  const x = Number(candle.x);
  const o = Number(candle.o);
  const h = Number(candle.h);
  const l = Number(candle.l);
  const c = Number(candle.c);
  return (
    Number.isFinite(x) &&
    Number.isFinite(o) &&
    Number.isFinite(h) &&
    Number.isFinite(l) &&
    Number.isFinite(c) &&
    o > 0 && h > 0 && l > 0 && c > 0
  );
};

export const normalizeCandle = (candle: any) => {
  return {
    x: Number(candle.x),
    o: Number(candle.o),
    h: Number(candle.h),
    l: Number(candle.l),
    c: Number(candle.c),
  };
};

