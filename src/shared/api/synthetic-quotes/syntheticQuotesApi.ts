import { apiClient } from '../client';
import type { SyntheticQuoteConfig, SyntheticCandle } from './types';

// Кеш для дедупликации запросов getActiveConfigs
let activeConfigsPromise: Promise<{ success: boolean; data: SyntheticQuoteConfig[] }> | null = null;

export const syntheticQuotesApi = {
  getActiveConfigs: async () => {
    // Если запрос уже выполняется, возвращаем существующий промис
    if (activeConfigsPromise) {
      return activeConfigsPromise;
    }

    // Создаем новый запрос
    activeConfigsPromise = (async () => {
      try {
        const response = await apiClient<{ success: boolean; data: SyntheticQuoteConfig[] } | SyntheticQuoteConfig[]>('/synthetic-quotes/config/active', {
          method: 'GET',
          noAuth: true,
        });
        if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
          return response as { success: boolean; data: SyntheticQuoteConfig[] };
        }
        if (Array.isArray(response)) {
          return { success: true, data: response };
        }
        if (response && typeof response === 'object' && 'data' in response) {
          return { success: true, data: (response as any).data };
        }
        return { success: false, data: [] };
      } finally {
        // Очищаем промис после завершения (успешного или с ошибкой)
        activeConfigsPromise = null;
      }
    })();

    return activeConfigsPromise;
  },

  getConfigBySymbol: (symbol: string) =>
    apiClient<{ success: boolean; data: SyntheticQuoteConfig }>(`/synthetic-quotes/config/${symbol}`, {
      method: 'GET',
      noAuth: true,
    }),

  getConfigById: (id: number) =>
    apiClient<{ success: boolean; data: SyntheticQuoteConfig }>(`/synthetic-quotes/config/id/${id}`, {
      method: 'GET',
      noAuth: true,
    }),

  getCandlesHistory: (id: number, timeframe: string = '15s', limit: number = 500, endTime?: number, startTime?: number, tradeId?: string) => {
    const params: Record<string, string> = { id: id.toString(), timeframe, limit: limit.toString() };
    if (endTime) {
      params.endTime = endTime.toString();
    }
    if (startTime) {
      params.start = startTime.toString();
    }
    if (tradeId) {
      params.tradeId = tradeId;
    }
    const queryString = new URLSearchParams(params).toString();
    return apiClient<{ success: boolean; data: SyntheticCandle[] }>(`/synthetic-quotes/candles?${queryString}`, {
      method: 'GET',
      noAuth: true,
    });
  },

  getCandlesByRange: (id: number, timeframe: string, startIndex: number, endIndex: number) => {
    const params = new URLSearchParams({
      id: id.toString(),
      timeframe,
      startIndex: startIndex.toString(),
      endIndex: endIndex.toString(),
    });
    return apiClient<{ success: boolean; data: SyntheticCandle[] }>(`/synthetic-quotes/candles?${params.toString()}`, {
      method: 'GET',
      noAuth: true,
    });
  },
};
