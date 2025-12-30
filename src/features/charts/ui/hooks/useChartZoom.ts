import { useRef, useCallback, RefObject } from 'react';
import { Candle } from '../types';
import { ChartTimeframe } from '../types';
import { getServerTime } from '@src/shared/lib/serverTime';
import { getTimeframeDurationMs } from '../utils';

interface UseChartZoomParams {
  chartRef: RefObject<any>;
  tempCandles: RefObject<Candle[]>;
  timeframe: ChartTimeframe;
  autoFollowRef: RefObject<boolean>;
  oldestLoadedCandleRef: RefObject<number | null>;
  isLoadingHistoryRef: RefObject<boolean>;
  fetchCandles: (params: { limit?: number; endTime?: number; signal?: AbortSignal }) => Promise<Candle[]>;
  syncCandlesState: (candles?: Candle[]) => void;
  setLoadingHistory: (loading: boolean) => void;
  lastPanCheckRef: RefObject<number>;
  savedZoomBeforeHistoryLoadRef: RefObject<{ min: number; max: number } | null>;
  lastChartUpdateRef: RefObject<number>;
}

export const useChartZoom = ({
  chartRef,
  tempCandles,
  timeframe,
  autoFollowRef,
  oldestLoadedCandleRef,
  isLoadingHistoryRef,
    fetchCandles,
  syncCandlesState,
  setLoadingHistory,
  lastPanCheckRef,
  savedZoomBeforeHistoryLoadRef,
  lastChartUpdateRef,
}: UseChartZoomParams) => {
  const scrollToLatestCandle = useCallback((adjustY: boolean = false) => {
    if (!chartRef.current || !autoFollowRef.current || tempCandles.current.length === 0) {
      return;
    }

    try {
      const chart = chartRef.current;
      const xScale = chart.scales?.x;
      const yScale = chart.scales?.y;
      if (!xScale) return;

      const lastCandle = tempCandles.current[tempCandles.current.length - 1];
      if (!lastCandle || typeof lastCandle.x !== 'number') return;

      const lastCandleTime = lastCandle.x;
      const currentXMax = xScale.max;
      const currentXMin = xScale.min;
      const currentXRange = currentXMax - currentXMin;

      const candleInterval = getTimeframeDurationMs(timeframe) || 60 * 1000;
      const firstCandle = tempCandles.current[0];
      const firstCandleTime = firstCandle?.x;
      
      if (!firstCandleTime) return;

      let needsXUpdate = false;
      let newXMin = currentXMin;
      let newXMax = currentXMax;
      
      const maxAllowedOffset = 20 * candleInterval;
      const minAllowedTime = firstCandleTime - maxAllowedOffset;
      const maxAllowedTime = lastCandleTime + currentXRange / 2;
      
      const rightPadding = currentXRange * 0.1;
      const targetMax = lastCandleTime + rightPadding;
      const targetMin = targetMax - currentXRange;
      
      if (targetMax > currentXMax || targetMin < currentXMin) {
        newXMax = Math.min(targetMax, maxAllowedTime);
        newXMin = newXMax - currentXRange;
        
        if (newXMin < minAllowedTime) {
          newXMin = minAllowedTime;
          newXMax = newXMin + currentXRange;
        }
        
        needsXUpdate = true;
      }

      let needsYUpdate = false;
      let newYMin = yScale?.min;
      let newYMax = yScale?.max;
      
      if (adjustY && yScale) {
        const candleHigh = lastCandle.h;
        const candleLow = lastCandle.l;
        const currentYMax = yScale.max;
        const currentYMin = yScale.min;
        const currentYRange = currentYMax - currentYMin;
        
        const yMargin = currentYRange * 0.1;
        
        if (candleHigh > currentYMax - yMargin || candleLow < currentYMin + yMargin) {
          needsYUpdate = true;
          
          const minY = Math.min(candleLow, currentYMin);
          const maxY = Math.max(candleHigh, currentYMax);
          const requiredRange = maxY - minY;
          
          const padding = requiredRange * 0.1;
          newYMin = minY - padding;
          newYMax = maxY + padding;
          
          const newRange = newYMax - newYMin;
          if (newRange < currentYRange) {
            const candleCenter = (candleHigh + candleLow) / 2;
            newYMin = candleCenter - currentYRange / 2;
            newYMax = candleCenter + currentYRange / 2;
            
            if (candleHigh > newYMax - yMargin) {
              const diff = candleHigh - (newYMax - yMargin);
              newYMax += diff;
            }
            if (candleLow < newYMin + yMargin) {
              const diff = (newYMin + yMargin) - candleLow;
              newYMin -= diff;
            }
          }
        }
      }

      if (needsXUpdate || needsYUpdate) {
        requestAnimationFrame(() => {
          try {
            if (needsXUpdate && xScale.options) {
              xScale.options.min = newXMin;
              xScale.options.max = newXMax;
              xScale.min = newXMin;
              xScale.max = newXMax;
            }
            
            if (needsYUpdate && yScale?.options) {
              yScale.options.min = newYMin;
              yScale.options.max = newYMax;
              yScale.min = newYMin;
              yScale.max = newYMax;
            }
            
          } catch (error) {
          }
        });
      }
    } catch (error) {
    }
  }, [chartRef, tempCandles, timeframe, autoFollowRef]);

  const loadMoreHistory = useCallback(async (
    chartInstance: any,
    savedVisibleRange: { min: number; max: number } | null
  ) => {
    if (isLoadingHistoryRef.current || !oldestLoadedCandleRef.current) {
      console.log('[loadMoreHistory] Пропуск загрузки: isLoading=', isLoadingHistoryRef.current, 'oldestLoaded=', oldestLoadedCandleRef.current);
      return;
    }
    
    if (savedVisibleRange) {
      savedZoomBeforeHistoryLoadRef.current = savedVisibleRange;
    }
    
    isLoadingHistoryRef.current = true;
    console.log('[loadMoreHistory] Начинаем загрузку свечей. oldestLoadedCandleRef.current=', oldestLoadedCandleRef.current);
    
    try {
      const endTime = oldestLoadedCandleRef.current! - 1;
      console.log('[loadMoreHistory] Запрашиваем 200 свечей до времени:', new Date(endTime).toISOString(), 'endTime=', endTime);
      const newCandles = await fetchCandles({ limit: 200, endTime });
      console.log('[loadMoreHistory] Получено свечей:', newCandles.length);

      if (newCandles.length === 0) {
        console.log('[loadMoreHistory] Нет новых свечей для загрузки');
        isLoadingHistoryRef.current = false;
        return;
      }
      
      const oldestExistingTime = tempCandles.current[0]?.x;
      if (!oldestExistingTime) {
        console.log('[loadMoreHistory] Нет oldestExistingTime, пропуск');
        isLoadingHistoryRef.current = false;
        return;
      }
      
      console.log('[loadMoreHistory] Текущее количество свечей:', tempCandles.current.length, 'oldestExistingTime:', new Date(oldestExistingTime).toISOString());
      
      const existingTimes = new Set(tempCandles.current.map(c => c.x));
      const uniqueNewCandles = newCandles.filter(c => c.x < oldestExistingTime && !existingTimes.has(c.x));
      console.log('[loadMoreHistory] Уникальных новых свечей после фильтрации:', uniqueNewCandles.length);
      
      if (uniqueNewCandles.length > 0) {
        const oldestNewCandle = uniqueNewCandles[0].x;
        const newestNewCandle = uniqueNewCandles[uniqueNewCandles.length - 1].x;
        const timeframeDuration = getTimeframeDurationMs(timeframe) || 60 * 1000;
        
        const gapBetweenNewAndExisting = oldestExistingTime - newestNewCandle;
        const maxAllowedGap = timeframeDuration * 2;
        
        if (gapBetweenNewAndExisting > maxAllowedGap) {
          const gapEndTime = oldestExistingTime - 1;
          const gapStartTime = newestNewCandle + timeframeDuration;
          
          try {
            const gapCandles = await fetchCandles({ 
              limit: Math.min(200, Math.ceil(gapBetweenNewAndExisting / timeframeDuration) + 10), 
              endTime: gapEndTime 
            });
            
            if (gapCandles.length > 0) {
              const gapCandlesFiltered = gapCandles.filter(c => 
                c.x >= gapStartTime && 
                c.x < oldestExistingTime && 
                !existingTimes.has(c.x)
              );
              
              if (gapCandlesFiltered.length > 0) {
                uniqueNewCandles.push(...gapCandlesFiltered);
                uniqueNewCandles.sort((a, b) => a.x - b.x);
              }
            }
          } catch (error) {

          }
        }
        
        oldestLoadedCandleRef.current = oldestNewCandle;
        console.log('[loadMoreHistory] Обновляем oldestLoadedCandleRef на:', new Date(oldestNewCandle).toISOString());
        tempCandles.current = [...uniqueNewCandles, ...tempCandles.current];
        tempCandles.current.sort((a, b) => a.x - b.x);
        console.log('[loadMoreHistory] Итоговое количество свечей:', tempCandles.current.length);
        
        const currentChart = chartRef.current || chartInstance;
        if (savedVisibleRange && currentChart?.scales?.x && currentChart.data?.datasets?.[0]) {
          const fixedMin = savedVisibleRange.min;
          const fixedMax = savedVisibleRange.max;
          
          currentChart.data.datasets[0].data = [...tempCandles.current];
          
          currentChart.scales.x.options.min = fixedMin;
          currentChart.scales.x.options.max = fixedMax;
          currentChart.scales.x.min = fixedMin;
          currentChart.scales.x.max = fixedMax;
          
          
          const now = getServerTime();
          if (!lastChartUpdateRef.current || now - lastChartUpdateRef.current >= 1000) {
            syncCandlesState();
            lastChartUpdateRef.current = now;
          }
        } else {
          const now = getServerTime();
          if (!lastChartUpdateRef.current || now - lastChartUpdateRef.current >= 1000) {
            syncCandlesState();
            lastChartUpdateRef.current = now;
          }
        }
        
      } else {
        console.log('[loadMoreHistory] Нет уникальных новых свечей для добавления');
      }
    } catch (error) {
      console.error('[loadMoreHistory] Ошибка при загрузке истории:', error);
    } finally {
      isLoadingHistoryRef.current = false;
      console.log('[loadMoreHistory] Загрузка завершена');
    }
  }, [
    isLoadingHistoryRef,
    oldestLoadedCandleRef,
    fetchCandles,
    tempCandles,
    chartRef,
    syncCandlesState,
    setLoadingHistory,
    savedZoomBeforeHistoryLoadRef,
    lastChartUpdateRef,
  ]);

  return {
    scrollToLatestCandle,
    loadMoreHistory,
  };
};

