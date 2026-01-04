import React, { useEffect, useRef, useState, useCallback } from 'react';
import { syntheticQuotesApi } from '@src/shared/api/synthetic-quotes/syntheticQuotesApi';
import { loadCandlesFromCache, saveCandlesToCache, clearCache } from '@src/shared/lib/utils/candlesCache';
import type { ChartTimeframe } from '../types';

interface Candle {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface ChartHistoryProps {
  selectedBase: string; // Только для отображения
  currencyId: number | null; // Основной идентификатор валютной пары
  timeframe: ChartTimeframe;
  onCandlesLoaded?: (candles: Candle[]) => void;
  onLoadMore?: (endTime: number) => Promise<Candle[]>;
  reloadTrigger?: number; // Триггер для принудительной перезагрузки данных
}

export const ChartHistory: React.FC<ChartHistoryProps> = ({
  selectedBase, // Только для отображения
  currencyId,
  timeframe,
  onCandlesLoaded,
  onLoadMore,
  reloadTrigger,
}) => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [oldestLoadedTime, setOldestLoadedTime] = useState<number | null>(null);
  const isLoadingMoreRef = useRef(false);
  const onCandlesLoadedRef = useRef(onCandlesLoaded);
  const lastLoadedCurrencyRef = useRef<string | null>(null);
  
  // Обновляем ref при изменении колбэка
  useEffect(() => {
    onCandlesLoadedRef.current = onCandlesLoaded;
  }, [onCandlesLoaded]);

  const fetchCandles = useCallback(async (limit: number = 500, endTime?: number): Promise<Candle[]> => {
    try {
      // Используем currencyId напрямую из пропсов
      if (!currencyId || currencyId <= 0) {
        console.warn('[ChartHistory] ⚠️ Currency ID не установлен или невалидный', {
          currencyId,
          selectedBase
        });
        return [];
      }

      // Сначала проверяем кеш (только если это не запрос с endTime - для диапазонов не используем кеш)
      // Минимальный таймфрейм 15s, поэтому кеш должен обновляться чаще
      if (!endTime) {
        const cachedCandles = loadCandlesFromCache(currencyId, timeframe, { maxAge: 10 * 1000 }); // 10 секунд (меньше минимального таймфрейма 15s)
        if (cachedCandles && cachedCandles.length > 0) {
          console.log(`[ChartHistory] ✅ Загружено из кеша: ${cachedCandles.length} свечей для id=${currencyId}:${timeframe}`);
          
          // Возвращаем ограниченное количество свечей, если запрошено меньше
          if (limit && cachedCandles.length > limit) {
            return cachedCandles.slice(-limit);
          }
          
          return cachedCandles;
        }
      }

      console.log(`[ChartHistory] 🔍 Запрос свечей с сервера: id=${currencyId}, timeframe=${timeframe}, limit=${limit}${endTime ? `, endTime=${new Date(endTime).toISOString()}` : ''}`);
      
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
        console.error('[ChartHistory] Неожиданный формат ответа:', response);
        throw new Error('Failed to fetch synthetic candles: invalid response format');
      }
      
      console.log(`[ChartHistory] ✅ Получено свечей с сервера: ${candlesData.length} для id=${currencyId}:${timeframe}`);
      
      if (candlesData.length === 0) {
        console.log(`[ChartHistory] ⚠️ В кеше нет свечей для id=${currencyId}:${timeframe}`);
        return [];
      }
      
      const processedCandles: Candle[] = [];
      const invalidCandles: Array<{ reason: string; data: any }> = [];
      const thinCandles: Array<{ time: string; high: number; low: number; range: number; rangePercent: number }> = [];
      
      candlesData.forEach((c, index) => {
        if (!c || typeof c !== 'object') {
          invalidCandles.push({ reason: 'Не объект или null', data: c });
          return;
        }
        
        // Сервер возвращает поле 'time', но может быть и 'start' для совместимости
        const timeValue = c.time !== undefined ? c.time : c.start;
        if (timeValue === undefined) {
          invalidCandles.push({ reason: 'Нет поля time/start', data: c });
          return;
        }
        
        const timestamp = typeof timeValue === 'number' ? timeValue : new Date(timeValue).getTime();
        const open = parseFloat(c.open);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const close = parseFloat(c.close);
        
        if (!Number.isFinite(timestamp) || !Number.isFinite(open) || !Number.isFinite(high) || 
            !Number.isFinite(low) || !Number.isFinite(close)) {
          invalidCandles.push({ reason: 'Нечисловые значения', data: { open, high, low, close, timestamp } });
          return;
        }
        
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
          invalidCandles.push({ reason: 'Отрицательные или нулевые значения', data: { open, high, low, close } });
          return;
        }
        
        if (high < low || high < open || high < close || low > open || low > close) {
          invalidCandles.push({ reason: 'Некорректные OHLC значения', data: { open, high, low, close } });
          return;
        }
        
        const range = high - low;
        const avgPrice = (high + low) / 2;
        const rangePercent = avgPrice > 0 ? (range / avgPrice) * 100 : 0;
        
        // Проверяем на "тонкие" свечи (диапазон меньше 0.001% от средней цены)
        if (rangePercent < 0.001) {
          thinCandles.push({
            time: new Date(timestamp).toISOString(),
            high,
            low,
            range,
            rangePercent
          });
          // Детальное логирование тонких свечей
          console.warn(`[ChartHistory] ⚠️ Тонкая свеча обнаружена:`, {
            time: new Date(timestamp).toISOString(),
            id: currencyId,
            timeframe,
            open,
            high,
            low,
            close,
            range,
            rangePercent: rangePercent.toFixed(8),
            avgPrice
          });
        }
        
        processedCandles.push({
          x: timestamp,
          o: open,
          h: high,
          l: low,
          c: close,
        });
      });
      
      // Сортируем по времени
      processedCandles.sort((a, b) => a.x - b.x);

      console.log(`[ChartHistory] ✅ Обработано свечей: ${processedCandles.length} для id=${currencyId}:${timeframe}${processedCandles.length > 0 ? `, первая: ${new Date(processedCandles[0].x).toISOString()}, последняя: ${new Date(processedCandles[processedCandles.length - 1].x).toISOString()}` : ''}`);
      
      if (invalidCandles.length > 0) {
        console.warn(`[ChartHistory] ⚠️ Найдено невалидных свечей: ${invalidCandles.length}`, invalidCandles.slice(0, 10));
      }
      
      if (thinCandles.length > 0) {
        console.warn(`[ChartHistory] ⚠️ Найдено тонких свечей (range < 0.001%): ${thinCandles.length}`, thinCandles.slice(0, 10));
      }
      
      // Логируем детали первых и последних свечей
      if (processedCandles.length > 0) {
        const firstCandle = processedCandles[0];
        const lastCandle = processedCandles[processedCandles.length - 1];
        console.log(`[ChartHistory] 📊 Детали загруженных свечей:`, {
          first: {
            time: new Date(firstCandle.x).toISOString(),
            o: firstCandle.o,
            h: firstCandle.h,
            l: firstCandle.l,
            c: firstCandle.c,
            range: firstCandle.h - firstCandle.l,
            rangePercent: ((firstCandle.h - firstCandle.l) / ((firstCandle.h + firstCandle.l) / 2)) * 100
          },
          last: {
            time: new Date(lastCandle.x).toISOString(),
            o: lastCandle.o,
            h: lastCandle.h,
            l: lastCandle.l,
            c: lastCandle.c,
            range: lastCandle.h - lastCandle.l,
            rangePercent: ((lastCandle.h - lastCandle.l) / ((lastCandle.h + lastCandle.l) / 2)) * 100
          },
          totalCount: processedCandles.length,
          thinCandlesCount: thinCandles.length
        });
      }

      // Сохраняем в кеш только если это не запрос с endTime (полный набор свечей)
      if (!endTime && processedCandles.length > 0) {
        saveCandlesToCache(currencyId, timeframe, processedCandles, { useLocalStorage: true });
        console.log(`[ChartHistory] 💾 Сохранено в кеш: ${processedCandles.length} свечей для id=${currencyId}:${timeframe}`);
      }

      return processedCandles;
    } catch (error) {
      console.error('[ChartHistory] Ошибка загрузки истории:', error);
      return [];
    }
  }, [currencyId, timeframe]);

  // Функция загрузки истории (вынесена для переиспользования)
  const loadInitialHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Проверяем, что currencyId установлен и валидный
      if (!currencyId || currencyId <= 0) {
        console.warn('[ChartHistory] ⚠️ Invalid currency ID', {
          currencyId,
          selectedBase
        });
        setIsLoading(false);
        setCandles([]);
        setOldestLoadedTime(null);
        onCandlesLoadedRef.current?.([]);
        return;
      }
      
      // Отмечаем, что мы загружаем данные для этой валютной пары
      lastLoadedCurrencyRef.current = `${currencyId}-${timeframe}`;
      
      console.log(`[ChartHistory] 🔄 Начало загрузки истории: id=${currencyId}, timeframe=${timeframe}`);
      
      const loadedCandles = await fetchCandles(500);
      
      console.log(`[ChartHistory] 📊 Загружено свечей: ${loadedCandles.length} для id=${currencyId}:${timeframe}`);
      
      if (loadedCandles.length > 0) {
        setCandles(loadedCandles);
        setOldestLoadedTime(loadedCandles[0].x);
        onCandlesLoadedRef.current?.(loadedCandles);
        console.log(`[ChartHistory] ✅ История загружена и установлена: ${loadedCandles.length} свечей для id=${currencyId}:${timeframe}, первая: ${new Date(loadedCandles[0].x).toISOString()}, последняя: ${new Date(loadedCandles[loadedCandles.length - 1].x).toISOString()}`);
      } else {
        setCandles([]);
        setOldestLoadedTime(null);
        onCandlesLoadedRef.current?.([]);
      }
    } catch (error) {
      console.error('[ChartHistory] Ошибка загрузки начальной истории:', error);
      setCandles([]);
      setOldestLoadedTime(null);
      onCandlesLoadedRef.current?.([]);
    } finally {
      setIsLoading(false);
    }
  }, [currencyId, timeframe, fetchCandles, selectedBase]);

  // Загрузка начальной истории
  useEffect(() => {
    let isMounted = true;
    
    // Очищаем старые данные при смене валютной пары или таймфрейма
    setCandles([]);
    setOldestLoadedTime(null);
    lastLoadedCurrencyRef.current = null;
    
    // Если currencyId не установлен, не загружаем историю
    if (!currencyId || currencyId <= 0) {
      console.log(`[ChartHistory] ⏳ Пропуск загрузки истории - currencyId не установлен`, { currencyId });
      return;
    }
    
    loadInitialHistory().then(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [currencyId, timeframe, loadInitialHistory]);

  // Очищаем кеш при смене валютной пары или таймфрейма (опционально, можно убрать если хотим сохранять кеш)
  // useEffect(() => {
  //   const currencyInfo = getCurrencyInfoRef.current ? getCurrencyInfoRef.current(selectedBase) : null;
  //   if (currencyInfo?.id) {
  //     // Не очищаем кеш, чтобы данные сохранялись при переключении
  //     // clearCache(currencyInfo.id, timeframe);
  //   }
  // }, [selectedBase, timeframe]);

  // Перезагрузка данных при изменении reloadTrigger
  useEffect(() => {
    if (reloadTrigger !== undefined && reloadTrigger > 0) {
      loadInitialHistory();
    }
  }, [reloadTrigger, loadInitialHistory]);


  // Функция для подгрузки дополнительной истории
  const loadMoreHistory = useCallback(async (endTime: number): Promise<Candle[]> => {
    if (isLoadingMoreRef.current) {
      console.log('[ChartHistory] loadMoreHistory: уже загружается, пропуск');
      return [];
    }

    isLoadingMoreRef.current = true;
    console.log('[ChartHistory] loadMoreHistory: начинаем загрузку 200 свечей до времени', new Date(endTime).toISOString());
    try {
      const newCandles = await fetchCandles(200, endTime);
      console.log('[ChartHistory] loadMoreHistory: получено свечей', newCandles.length);
      
      if (newCandles.length > 0) {
        setCandles((prev) => {
          const combined = [...newCandles, ...prev];
          const unique = combined.filter((candle, index, self) => 
            index === self.findIndex((c) => c.x === candle.x)
          );
          return unique.sort((a, b) => a.x - b.x);
        });
        
        const oldestNewCandle = newCandles[0];
        if (oldestNewCandle && (!oldestLoadedTime || oldestNewCandle.x < oldestLoadedTime)) {
          setOldestLoadedTime(oldestNewCandle.x);
        }
      }
      
      return newCandles;
    } catch (error) {
      console.error('[ChartHistory] Ошибка подгрузки истории:', error);
      return [];
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [fetchCandles, oldestLoadedTime]);

  // Экспортируем функцию подгрузки через ref
  useEffect(() => {
    if (onLoadMore) {
      // Сохраняем функцию в ref для доступа извне
      (window as any).__chartHistoryLoadMore = loadMoreHistory;
    }
    return () => {
      delete (window as any).__chartHistoryLoadMore;
    };
  }, [loadMoreHistory, onLoadMore]);

  return null; // Компонент не рендерит UI, только управляет данными
};

