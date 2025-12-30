import { useCallback, RefObject } from 'react';
import { Candle } from '../types';
import { ChartTimeframe } from '../types';
import { syntheticQuotesApi } from '@src/shared/api';
import { createCurrencyPairSymbol } from '@src/shared/lib/currencyPairUtils';
import { getTimeframeDurationMs } from '../utils';

// Простая версия функции aggregateCandlesFrom15s
function aggregateCandlesFrom15s(candles15s: Candle[], targetTimeframe: ChartTimeframe): Candle[] {
  // Если таймфрейм 15s, возвращаем как есть
  if (targetTimeframe === '15s') {
    return candles15s;
  }
  
  // Простая агрегация - группируем по таймфрейму
  const duration = getTimeframeDurationMs(targetTimeframe) || 60000;
  const grouped = new Map<number, Candle[]>();
  
  candles15s.forEach((candle) => {
    const alignedTimestamp = Math.floor(candle.x / duration) * duration;
    if (!grouped.has(alignedTimestamp)) {
      grouped.set(alignedTimestamp, []);
    }
    grouped.get(alignedTimestamp)!.push(candle);
  });
  
  const aggregated: Candle[] = [];
  grouped.forEach((group, alignedTimestamp) => {
    if (group.length === 0) return;
    
    const sortedGroup = group.sort((a, b) => a.x - b.x);
    const firstCandle = sortedGroup[0];
    const lastCandle = sortedGroup[sortedGroup.length - 1];
    
    aggregated.push({
      x: alignedTimestamp,
      o: firstCandle.o,
      h: Math.max(...sortedGroup.map(c => c.h)),
      l: Math.min(...sortedGroup.map(c => c.l)),
      c: lastCandle.c,
    });
  });
  
  return aggregated.sort((a, b) => a.x - b.x);
}

import { getTimeframeDurationMs } from '../utils';

interface UseChartDataParams {
  selectedBase: string;
  timeframe: ChartTimeframe;
  tempCandles: RefObject<Candle[]>;
  lastCandleRef: RefObject<Candle | null>;
  oldestLoadedCandleRef: RefObject<number | null>;
  currentPriceRef: RefObject<number | null>;
  onPriceUpdate?: (data: { open: number; high: number; low: number; close: number }) => void;
  syncCandlesState: (candles?: Candle[]) => void;
  setLoading: (loading: boolean) => void;
  setErrorMessage: (error: string | null) => void;
  isUnmountedRef: RefObject<boolean>;
  getCurrencyInfo?: (baseCurrency: string) => { quote_currency?: string } | undefined;
}

export const useChartData = ({
  selectedBase,
  timeframe,
  tempCandles,
  lastCandleRef,
  oldestLoadedCandleRef,
  currentPriceRef,
  onPriceUpdate,
  syncCandlesState,
  setLoading,
  setErrorMessage,
  isUnmountedRef,
  getCurrencyInfo,
}: UseChartDataParams) => {
  const normalizedBase = selectedBase.replace(/[^a-zA-Z0-9]/g, '');

  const fetchCandles = useCallback(async ({ limit = 500, endTime, signal }: { limit?: number; endTime?: number; signal?: AbortSignal }) => {
    try {
      // Get currency info to get currency_id
      const currencyInfo = getCurrencyInfo ? getCurrencyInfo(selectedBase) : null;
      if (!currencyInfo || !currencyInfo.id) {
        throw new Error('Currency info not found');
      }

      const currencyId = currencyInfo.id;

      const response = await syntheticQuotesApi.getCandlesHistory(currencyId, timeframe, limit, endTime);
      
      let candlesData: any[] = [];
      
      if (Array.isArray(response)) {
        candlesData = response;
      } else if (response && typeof response === 'object' && 'data' in response) {
        if (response.success === false) {
          throw new Error('Failed to fetch synthetic candles: server returned error');
        }
        if (Array.isArray(response.data)) {
          candlesData = response.data;
        } else {
          throw new Error('Failed to fetch synthetic candles: invalid response format - data is not array');
        }
      } else {
        throw new Error('Failed to fetch synthetic candles: invalid response format');
      }
      
      if (candlesData.length === 0) {
        return [];
      }

      const candles: Candle[] = candlesData.map((c, index) => {
        if (!c || typeof c !== 'object') {
          console.warn(`[useChartData] ⚠️ Некорректный объект свечи на индексе ${index}:`, c);
          return null;
        }
        const timestamp = typeof c.start === 'number' ? c.start : new Date(c.start).getTime();
        const open = parseFloat(c.open);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const close = parseFloat(c.close);
        
        if (!Number.isFinite(timestamp) || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
          console.warn(`[useChartData] ⚠️ Некорректные числовые значения на индексе ${index}:`, {
            timestamp,
            open,
            high,
            low,
            close,
            raw: c
          });
          return null;
        }
        
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
          console.warn(`[useChartData] ⚠️ Нулевые или отрицательные значения на индексе ${index}:`, {
            open,
            high,
            low,
            close
          });
          return null;
        }
        
        if (high < low || high < open || high < close || low > open || low > close) {
          console.warn(`[useChartData] ⚠️ Некорректные OHLC значения на индексе ${index} (high < low или другие нарушения):`, {
            open,
            high,
            low,
            close,
            violations: {
              highLessLow: high < low,
              highLessOpen: high < open,
              highLessClose: high < close,
              lowGreaterOpen: low > open,
              lowGreaterClose: low > close
            }
          });
          return null;
        }
        
        return {
          x: timestamp,
          o: open,
          h: high,
          l: low,
          c: close,
        };
      }).filter((c): c is Candle => c !== null);
      
      // Логируем статистику загруженных свечей
      if (candles.length !== candlesData.length) {
        console.warn(`[useChartData] ⚠️ Отфильтровано ${candlesData.length - candles.length} некорректных свечей из ${candlesData.length}`);
      }
      
      // Проверка на дубликаты и сортировку
      const sortedCandles = candles.sort((a, b) => a.x - b.x);
      const duplicates = sortedCandles.filter((candle, index, arr) => {
        return index > 0 && arr[index - 1].x === candle.x;
      });
      
      if (duplicates.length > 0) {
        console.warn(`[useChartData] ⚠️ Обнаружено ${duplicates.length} дубликатов свечей с одинаковым timestamp`);
      }
      
      // Проверка на аномальные скачки цены между соседними свечами
      const MAX_PRICE_CHANGE_PERCENT = 0.1; // 10% максимальное изменение между соседними свечами
      const filteredCandles: Candle[] = [];
      
      for (let i = 0; i < sortedCandles.length; i++) {
        const candle = sortedCandles[i];
        
        if (i === 0) {
          // Первая свеча всегда валидна
          filteredCandles.push(candle);
          continue;
        }
        
        const prevCandle = filteredCandles[filteredCandles.length - 1];
        const priceChange = Math.abs(candle.c - prevCandle.c);
        const priceChangePercent = (priceChange / prevCandle.c) * 100;
        
        if (priceChangePercent > MAX_PRICE_CHANGE_PERCENT * 100) {
          console.warn(`[useChartData] ⚠️ Обнаружен аномальный скачок цены между свечами: ${priceChangePercent.toFixed(2)}% (макс: ${MAX_PRICE_CHANGE_PERCENT * 100}%)`, {
            prevCandle: {
              x: new Date(prevCandle.x).toISOString(),
              c: prevCandle.c
            },
            currentCandle: {
              x: new Date(candle.x).toISOString(),
              c: candle.c
            },
            change: priceChange
          });
          
          // Ограничиваем изменение цены
          const direction = candle.c > prevCandle.c ? 1 : -1;
          const maxAllowedChange = prevCandle.c * MAX_PRICE_CHANGE_PERCENT;
          const adjustedCandle: Candle = {
            ...candle,
            c: prevCandle.c + direction * maxAllowedChange,
            o: prevCandle.c,
            h: Math.max(candle.h, candle.c),
            l: Math.min(candle.l, candle.c)
          };
          
          filteredCandles.push(adjustedCandle);
        } else {
          filteredCandles.push(candle);
        }
      }
      
      if (filteredCandles.length !== sortedCandles.length) {
        console.warn(`[useChartData] ⚠️ Отфильтровано ${sortedCandles.length - filteredCandles.length} свечей с аномальными скачками цены`);
      }

      return filteredCandles;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch synthetic candles: ${String(error)}`);
    }
  }, [selectedBase, timeframe]);

  const fetchHistoricalData = useCallback(async (): Promise<Candle[]> => {
    try {
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = attempt === 1 ? 15000 : attempt === 2 ? 20000 : 25000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          tempCandles.current = [];
          const candlesData = await fetchCandles({ limit: 500, signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (candlesData.length === 0) {
            const currentNormalizedBase = selectedBase.replace(/[^a-zA-Z0-9]/g, '');

            if (!isUnmountedRef.current) {
              setLoading(false);
            }
            return [];
          }
          
          tempCandles.current = candlesData;
          syncCandlesState(candlesData);
          
          if (candlesData.length > 0) {
            lastCandleRef.current = candlesData[candlesData.length - 1];
            oldestLoadedCandleRef.current = candlesData[0].x;
            currentPriceRef.current = lastCandleRef.current.c;
            
            onPriceUpdate?.({
              open: lastCandleRef.current.o,
              high: lastCandleRef.current.h,
              low: lastCandleRef.current.l,
              close: lastCandleRef.current.c,
              timestamp: lastCandleRef.current.x,
            });
          }
          
          if (!isUnmountedRef.current) {
            setLoading(false);
          }
          
          return candlesData;
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          if (fetchError?.name === 'AbortError' && attempt < maxRetries) {
            continue;
          }
          
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            continue;
          }
        }
      }
          
      if (lastError) {
        throw lastError;
      }
      
      return [];
    } catch (error) {
      const currentNormalizedBase = selectedBase.replace(/[^a-zA-Z0-9]/g, '');
      let friendlyMessage = `Не удалось загрузить данные для ${currentNormalizedBase}`;
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch synthetic candles')) {
          friendlyMessage = `Синтетические котировки для ${currentNormalizedBase} недоступны. Убедитесь, что валюта включена в админ-панели.`;
        } else if (error.message.includes('NETWORK_ERROR') || error.message.includes('Failed to fetch')) {
          friendlyMessage = 'Ошибка сети. Проверьте подключение к интернету.';
        } else {
          friendlyMessage = `Ошибка загрузки данных: ${error.message}`;
        }
      }
      console.error(friendlyMessage);
      throw error;
    }
  }, [
    fetchCandles,
    tempCandles,
    syncCandlesState,
    lastCandleRef,
    oldestLoadedCandleRef,
    currentPriceRef,
    onPriceUpdate,
    isUnmountedRef,
    setLoading,
    setErrorMessage,
    selectedBase,
  ]);

  return {
    fetchCandles,
    fetchHistoricalData,
  };
};
