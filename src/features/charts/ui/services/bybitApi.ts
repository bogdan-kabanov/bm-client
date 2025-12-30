import { Candle } from '../types';
import { BYBIT_INTERVAL_MAP } from '../constants';

export interface FetchBybitKlinesParams {
  limit?: number;
  endTime?: number;
  signal?: AbortSignal;
}

export interface BybitApiConfig {
  bybitCategory: 'spot' | 'linear';
  bybitRequestSymbol: string;
  bybitInterval: string;
  apiUrl?: string;
}

export const createBybitApi = (config: BybitApiConfig) => {
  const { bybitCategory, bybitRequestSymbol, bybitInterval, apiUrl = 'https://api.bybit.com/v5/market/kline' } = config;

  const fetchBybitKlines = async ({ limit = 200, endTime, signal }: FetchBybitKlinesParams): Promise<Candle[]> => {
    const params = new URLSearchParams({
      category: bybitCategory,
      symbol: bybitRequestSymbol,
      interval: bybitInterval,
      limit: String(limit),
    });

    if (typeof endTime === 'number') {
      params.set('endTime', String(endTime));
    }

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      signal,
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
      cache: 'no-cache',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data?.retCode !== 0) {
      throw new Error(`Bybit API error: ${data?.retMsg || 'Unknown error'}`);
    }

    const list: any[] = data?.result?.list || [];
    const candles = list.map((item) => ({
      x: Number(item[0]),
      o: parseFloat(item[1]),
      h: parseFloat(item[2]),
      l: parseFloat(item[3]),
      c: parseFloat(item[4]),
    }));

    // Bybit возвращает данные от новых к старым, разворачиваем
    const normalized = candles.reverse();
    return normalized;
  };

  return { fetchBybitKlines };
};

export const getBybitConfig = (
  symbol: string,
  timeframe: string,
  currencyInfo?: { bybit_symbol?: string }
): BybitApiConfig => {
  const isForexPair = /^(EUR|GBP|JPY|AUD|CAD|CHF)/i.test(symbol);
  const isTradFiAsset = /^(AAPL|TSLA|MSFT|GOOGL|AMZN|META|NVDA|NFLX|AMD|INTC|SPX|NAS100|DJI|RUT|XAU|XAG|UKOIL|BRENT|WTI)/i.test(symbol);
  const bybitCategory: 'spot' | 'linear' = (isForexPair || isTradFiAsset) ? 'linear' : 'spot';
  
  const normalizedBase = symbol.replace(/[^a-zA-Z0-9]/g, '');
  const bybitSymbol = (currencyInfo?.bybit_symbol || `${normalizedBase.toUpperCase()}USDT`).toUpperCase();
  const bybitRequestSymbol = (isForexPair && bybitSymbol.toUpperCase().endsWith('USDT'))
    ? bybitSymbol.toUpperCase().replace('USDT', 'USD')
    : bybitSymbol.toUpperCase();
  const bybitInterval = BYBIT_INTERVAL_MAP[timeframe as keyof typeof BYBIT_INTERVAL_MAP] || '1';

  return {
    bybitCategory,
    bybitRequestSymbol,
    bybitInterval,
  };
};

