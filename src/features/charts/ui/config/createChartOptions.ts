import { ChartOptions } from 'chart.js';
import { ChartTimeframe } from '../types';
import { GridManager } from '../../lib/GridManager';
import { formatPriceForAxis, formatPrice } from '../utils/priceFormatter';

let lastZoomCompleteValues: { min: number | null; max: number | null } = { min: null, max: null };

interface CreateChartOptionsParams {
  timeframe: ChartTimeframe;
  gridManager: GridManager;
  drawingStateRef?: React.MutableRefObject<any>;
  chartRef: React.RefObject<any>;
  tempCandles: React.RefObject<any[]>;
  isPanningRef: React.RefObject<boolean>;
  isZoomingRef: React.RefObject<boolean>;
  isLoadingHistoryRef: React.RefObject<boolean>;
  oldestLoadedCandleRef: React.RefObject<number | null>;
  savedZoomBeforeHistoryLoadRef: React.RefObject<{ min: number; max: number } | null>;
  fetchCandles: (params: { limit?: number; endTime?: number; signal?: AbortSignal }) => Promise<any[]>;
  syncCandlesState: (candles?: any[]) => void;
  setLoadingHistory: (loading: boolean) => void;
  lastPanCheckRef: React.RefObject<number>;
  lastChartUpdateRef: React.RefObject<number>;
  autoFollowRef: React.RefObject<boolean>;
  userInteractedRef: React.RefObject<boolean>;
  previousZoomRangeRef: React.RefObject<number | null>;
  isZoomLimitApplyingRef: React.RefObject<boolean>;
  justCompletedZoomRef: React.RefObject<boolean>;
  savedZoomAfterCompleteRef: React.RefObject<{ min: number; max: number } | null>;
  appendDebugLog: (message: string) => void;
  loadMoreHistory: (chartInstance: any, savedVisibleRange: { min: number; max: number } | null) => Promise<void>;
  scheduleChartUpdate?: (options?: { force?: boolean; alignLatest?: boolean; adjustY?: boolean; syncState?: boolean }) => void;
  candles?: any[];
  yScaleAnimationRef: React.RefObject<number | null>;
  currentPrice?: number | null;
  savedVisibleRangeRef?: React.RefObject<{ min: number; max: number } | null>;
  panMouseXRef?: React.RefObject<number | null>;
  panStartBoundaryRef?: React.RefObject<{ lastCandleTime: number; lastCandleCenter: number } | null>;
  lastUserInteractionTimeRef?: React.RefObject<number>;
  lastPanTimeRef?: React.RefObject<number>;
}

export const createChartOptions = (params: CreateChartOptionsParams): ChartOptions<"line"> => {
  const {
    timeframe,
    gridManager,
    drawingStateRef,
    chartRef,
    tempCandles,
    isPanningRef,
    isZoomingRef,
    isLoadingHistoryRef,
    oldestLoadedCandleRef,
    savedZoomBeforeHistoryLoadRef,
    fetchCandles,
    syncCandlesState,
    setLoadingHistory,
    lastPanCheckRef,
    lastChartUpdateRef,
    autoFollowRef,
    userInteractedRef,
    previousZoomRangeRef,
    isZoomLimitApplyingRef,
    justCompletedZoomRef,
    savedZoomAfterCompleteRef,
    appendDebugLog,
    loadMoreHistory,
    scheduleChartUpdate,
    candles,
    yScaleAnimationRef,
    currentPrice,
    savedVisibleRangeRef,
    panMouseXRef,
    panStartBoundaryRef,
    lastUserInteractionTimeRef,
    lastPanTimeRef,
  } = params;

  const MANUAL_PAN_COOLDOWN = 500;

  const animateYScale = (chart: any, newMin: number, newMax: number, duration: number = 300) => {
    if (!chart?.scales?.y) return;
    
    if (yScaleAnimationRef.current !== null) {
      cancelAnimationFrame(yScaleAnimationRef.current);
    }
    
    const yScale = chart.scales.y;
    const startMin = Number.isFinite(yScale.min) ? yScale.min : newMin;
    const startMax = Number.isFinite(yScale.max) ? yScale.max : newMax;
    
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeInOutQuart = progress < 0.5
        ? 8 * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 4) / 2;
      
      const currentMin = startMin + (newMin - startMin) * easeInOutQuart;
      const currentMax = startMax + (newMax - startMax) * easeInOutQuart;
      
      if (chart.scales.y.options) {
        chart.scales.y.options.min = currentMin;
        chart.scales.y.options.max = currentMax;
      }
      yScale.min = currentMin;
      yScale.max = currentMax;
      chart.update('none');
      
      if (progress < 1) {
        yScaleAnimationRef.current = requestAnimationFrame(animate);
      } else {
        if (chart.scales.y.options) {
          chart.scales.y.options.min = newMin;
          chart.scales.y.options.max = newMax;
        }
        yScale.min = newMin;
        yScale.max = newMax;
        yScaleAnimationRef.current = null;
      }
    };
    
    yScaleAnimationRef.current = requestAnimationFrame(animate);
  };

  // Функция для мягкой нормализации viewport после pan/zoom
  // НЕ блокирует движение, только мягко корректирует границы
  const normalizeViewport = (chart: any, candlesArray: any[]): void => {
    if (!chart?.scales?.x || !candlesArray || candlesArray.length === 0) return;
    
    const xScale = chart.scales.x;
    let newMin = xScale.min as number;
    let newMax = xScale.max as number;
    
    // Вычисляем ширину свечи (candleSpacing) на основе реальных данных
    let candleSpacing: number;
    if (candlesArray.length >= 2) {
      const lastCandle = candlesArray[candlesArray.length - 1];
      const prevCandle = candlesArray[candlesArray.length - 2];
      if (lastCandle?.x && prevCandle?.x && typeof lastCandle.x === 'number' && typeof prevCandle.x === 'number') {
        candleSpacing = Math.abs(lastCandle.x - prevCandle.x);
      } else {
        candleSpacing = intervalMs[timeframe] || 60 * 1000;
      }
    } else {
      candleSpacing = intervalMs[timeframe] || 60 * 1000;
    }
    
    // Получаем первую и последнюю свечу
    const firstCandle = candlesArray[0];
    const lastCandle = candlesArray[candlesArray.length - 1];
    
    if (!firstCandle || !lastCandle || typeof firstCandle.x !== 'number' || typeof lastCandle.x !== 'number') {
      return;
    }
    
    const firstCandleX = firstCandle.x;
    const lastCandleX = lastCandle.x;
    
    // ПРАВОЕ ОГРАНИЧЕНИЕ: сохраняем ширину окна при упоре вправо
    const rightLimit = lastCandleX + candleSpacing * 0.5;
    if (newMax > rightLimit) {
      // сохраняем текущую ширину окна,
      // чтобы при упоре вправо пан НЕ превращался в "зум"
      const width = newMax - newMin;
      newMax = rightLimit;
      newMin = rightLimit - width;
    }
    
    // ЛЕВОЕ ОГРАНИЧЕНИЕ: простой clamp без изменения xMax
    const leftLimit = firstCandleX - candleSpacing * 0.5;
    if (newMin < leftLimit) {
      newMin = leftLimit;
    }
    
    // Применяем мягкую коррекцию только если значения изменились
    if (Math.abs(xScale.min - newMin) > 1 || Math.abs(xScale.max - newMax) > 1) {
      if (xScale.options) {
        xScale.options.min = newMin;
        xScale.options.max = newMax;
      }
      xScale.min = newMin;
      xScale.max = newMax;
    }
  };

  // Вычисляем начальный масштаб Y на основе загруженных данных
  let initialYMin: number | undefined = undefined;
  let initialYMax: number | undefined = undefined;
  
  // Вычисляем начальный масштаб X на основе последних свечей
  let initialXMin: number | undefined = undefined;
  let initialXMax: number | undefined = undefined;
  
  const intervalMs: Record<string, number> = {
    '15s': 15 * 1000,
    '30s': 30 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
  };
  const candleInterval = intervalMs[timeframe] || 60 * 1000;
  
  const currentCandles = candles && candles.length > 0 ? candles : (tempCandles.current || []);
  
  // Определяем референсную цену для форматирования оси Y
  // Используем текущую цену, последнюю свечу или среднее значение диапазона
  let referencePriceForFormatting: number | undefined = currentPrice ?? undefined;
  if (!referencePriceForFormatting && currentCandles.length > 0) {
    const lastCandle = currentCandles[currentCandles.length - 1];
    referencePriceForFormatting = lastCandle.c;
  }
  
  // Логируем только один раз при создании опций (не при каждом обновлении)
  // Убрано избыточное логирование для производительности
  
  // Не устанавливаем начальный диапазон, если пользователь уже взаимодействовал с графиком
  const hasSavedRange = savedVisibleRangeRef?.current;
  
  if (currentCandles.length > 0 && !hasSavedRange) {
    let boundaryCandle;
    if (currentCandles.length >= 2) {
      boundaryCandle = currentCandles[currentCandles.length - 2];
    } else {
      boundaryCandle = currentCandles[currentCandles.length - 1];
    }
    if (boundaryCandle && Number.isFinite(boundaryCandle.x)) {
      const initialRange = 15 * candleInterval;
      const rightPadding = initialRange * 0.1;
      const initialMax = boundaryCandle.x + rightPadding;
      const initialMin = initialMax - initialRange;
      
      if (Number.isFinite(initialMin) && Number.isFinite(initialMax)) {
        initialXMin = initialMin;
        initialXMax = initialMax;
        
        const visibleCandles = currentCandles.filter(candle => {
          return candle && Number.isFinite(candle.x) && candle.x >= initialMin && candle.x <= initialMax;
        });
        
        if (visibleCandles.length > 0) {
          let minPrice = Infinity;
          let maxPrice = -Infinity;
          
          for (const candle of visibleCandles) {
            if (candle && Number.isFinite(candle.l) && Number.isFinite(candle.h)) {
              minPrice = Math.min(minPrice, candle.l);
              maxPrice = Math.max(maxPrice, candle.h);
            }
          }
          
          if (Number.isFinite(minPrice) && Number.isFinite(maxPrice)) {
            // Если minPrice === maxPrice, создаем небольшой диапазон
            if (minPrice === maxPrice) {
              const epsilon = Math.abs(minPrice) * 0.001 || 0.01;
              minPrice -= epsilon;
              maxPrice += epsilon;
            }
            
            const priceRange = Math.max(maxPrice - minPrice, 1e-9);
            // Вычисляем центр диапазона для симметричного padding
            const centerPrice = (minPrice + maxPrice) / 2;
            // Увеличиваем padding до 15% от диапазона, чтобы свечи не были слишком близко к краям
            const padding = Math.max(priceRange * 0.15, priceRange * 0.1);
            // Применяем padding симметрично от центра
            initialYMin = centerPrice - (priceRange / 2) - padding;
            initialYMax = centerPrice + (priceRange / 2) + padding;
          }
        }
      }
    }
  }

  function centerLastCandleOnce(chart: any) {
    const xScale = chart.scales.x;
    if (!xScale) return;

    let xMin = xScale.min;
    let xMax = xScale.max;
    if (xMin == null || xMax == null) return;

    const width = xMax - xMin;
    if (width <= 0) return;

    const meta = chart.getDatasetMeta(0);
    const data = meta.data || [];
    if (!data.length) return;

    const lastPoint = data[data.length - 1];
    const ctx = lastPoint.$context;

    let rawX: number | null = null;
    if (ctx?.raw?.x != null) {
      rawX = ctx.raw.x;
    } else if (ctx?.parsed?.x != null) {
      rawX = ctx.parsed.x;
    }

    if (rawX == null) {
      const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chart.data?.datasets?.[0]?.data || []);
      if (candlesArray && candlesArray.length > 0) {
        const lastCandle = candlesArray[candlesArray.length - 1];
        if (lastCandle && typeof lastCandle.x === 'number') {
          rawX = lastCandle.x;
        }
      }
    }

    if (rawX == null) return;

    const lastX = xScale.parse ? xScale.parse(rawX) : rawX;

    const newMin = lastX - width / 2;
    const newMax = lastX + width / 2;

    if (xScale.options) {
      xScale.options.min = newMin;
      xScale.options.max = newMax;
    }
    xScale.min = newMin;
    xScale.max = newMax;
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    transitions: {
      active: {
        animation: {
          duration: 0,
        },
      },
      resize: {
        animation: {
          duration: 300,
          easing: 'easeInOutQuart',
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          threshold: 10,
          modifierKey: null,
          onPanStart: (context: any) => {
            try {
              if (drawingStateRef?.current?.isDrawing && drawingStateRef.current.mode) {
                return false;
              }
              
              if (isPanningRef) {
                isPanningRef.current = true;
              }
              if (userInteractedRef) {
                userInteractedRef.current = true;
              }
              if (autoFollowRef) {
                autoFollowRef.current = false;
              }
              
              // Обновляем время последнего взаимодействия пользователя
              if (lastUserInteractionTimeRef) {
                lastUserInteractionTimeRef.current = Date.now();
              }
              
              const chart = context?.chart || chartRef.current;
              if (!chart?.scales?.x) return true;
              
              const currentMax = chart.scales.x.max as number;
              const currentMin = chart.scales.x.min as number;
              
              if (savedZoomBeforeHistoryLoadRef) {
                savedZoomBeforeHistoryLoadRef.current = {
                  min: currentMin,
                  max: currentMax
                };
              }
              
              if (savedVisibleRangeRef) {
                savedVisibleRangeRef.current = {
                  min: currentMin,
                  max: currentMax
                };
              }
            } catch (error) {

            }
            return true;
          },
          onPan: (context: any) => {
            try {
              if (lastPanTimeRef) {
                lastPanTimeRef.current = Date.now();
              }
              
              const chart = context?.chart || chartRef.current;
              if (!chart?.scales?.x) {
                console.log('[onPan] Нет scales.x, пропуск');
                return;
              }

              const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chart.data?.datasets?.[0]?.data || []);
              if (!candlesArray || candlesArray.length === 0) {
                console.log('[onPan] Нет свечей в массиве, пропуск');
                return;
              }
              
              normalizeViewport(chart, candlesArray);
              
              const firstCandle = candlesArray[0];
              const oldestLoaded = oldestLoadedCandleRef?.current;
              
              console.log('[onPan] Начальная проверка:', {
                hasFirstCandle: !!firstCandle,
                firstCandleX: firstCandle?.x,
                oldestLoaded: oldestLoaded,
                candlesCount: candlesArray.length,
                currentMin: chart.scales.x.min ? new Date(chart.scales.x.min).toISOString() : 'нет'
              });
              
              if (firstCandle && typeof firstCandle.x === 'number' && oldestLoaded) {
                  const firstCandleTime = firstCandle.x;
                  const currentMin = chart.scales.x.min;
                  const candleInterval = intervalMs[timeframe] || 60 * 1000;
                  const maxAllowedOffset = 20 * candleInterval;
                  const thresholdCandles = 20;
                  const thresholdTime = thresholdCandles * candleInterval;
                  
                  const isViewingLeft = currentMin < firstCandleTime;
                  const distanceToFirstCandle = currentMin - firstCandleTime;
                  const isApproachingLeft = distanceToFirstCandle <= thresholdTime && distanceToFirstCandle >= 0;
                  
                  // Проверяем, достигли ли мы левого края загруженных данных
                  const isLoading = isLoadingHistoryRef?.current;
                  
                  // Если currentMin близок к firstCandleTime (в пределах порога) или меньше её, загружаем
                  const isAtLeftEdge = distanceToFirstCandle <= thresholdTime * 2;
                  
                  // Проверяем, что мы ещё можем загружать (currentMin больше oldestLoaded с отступом)
                  const oldestLoadedBoundary = oldestLoaded - maxAllowedOffset;
                  const canLoadMore = currentMin >= oldestLoadedBoundary - thresholdTime;
                  
                  const shouldLoadMoreHistory = isAtLeftEdge && canLoadMore && !isLoading && oldestLoaded;
                  
                    console.log('[onPan] Проверка загрузки истории при прокрутке влево:', {
                      isViewingLeft,
                      isApproachingLeft,
                      currentMin: new Date(currentMin).toISOString(),
                      firstCandleTime: new Date(firstCandleTime).toISOString(),
                      oldestLoaded: new Date(oldestLoaded).toISOString(),
                      distanceToFirstCandle,
                      thresholdTime: thresholdTime * 2,
                      isAtLeftEdge,
                      canLoadMore,
                      oldestLoadedBoundary: new Date(oldestLoadedBoundary).toISOString(),
                      isLoading,
                      shouldLoadMoreHistory
                    });
                  
                    if (shouldLoadMoreHistory) {
                      console.log('[onPan] ✅ Запускаем загрузку 200 свечей при прокрутке влево');
                      const savedVisibleRange = chart?.scales?.x ? {
                        min: chart.scales.x.min,
                        max: chart.scales.x.max
                      } : null;
                      
                      if (savedVisibleRange && savedZoomBeforeHistoryLoadRef) {
                        savedZoomBeforeHistoryLoadRef.current = savedVisibleRange;
                      }
                      
                      loadMoreHistory(chart, savedVisibleRange);
                    } else if (!isLoading) {
                      console.log('[onPan] ⚠️ Загрузка не запущена:', {
                        reason: isLoading ? 'уже загружается' : (!canLoadMore ? `достигнут предел (currentMin=${new Date(currentMin).toISOString()} < boundary=${new Date(oldestLoadedBoundary - thresholdTime).toISOString()})` : (!isAtLeftEdge ? `не достигнут порог (distance=${distanceToFirstCandle} > threshold=${thresholdTime * 2})` : (!oldestLoaded ? 'нет oldestLoaded' : 'неизвестная причина'))),
                        isAtLeftEdge,
                        canLoadMore
                      });
                    }
              } else {
                console.log('[onPan] Условие не выполнено для загрузки:', {
                  hasFirstCandle: !!firstCandle,
                  firstCandleXType: typeof firstCandle?.x,
                  oldestLoaded: oldestLoaded
                });
              }
            }
            } catch (error) {

            }
          },
          onPanComplete: (context: any) => {
            try {
              if (isPanningRef) {
                isPanningRef.current = false;
              }
              
              const chart = context?.chart || chartRef.current;
              if (!chart?.scales?.x) return;
              
              const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chart.data?.datasets?.[0]?.data || []);
              if (!candlesArray || candlesArray.length === 0) return;
              
              // Финальная нормализация viewport после завершения pan
              normalizeViewport(chart, candlesArray);
              
              const currentMin = chart.scales.x.min;
              const currentMax = chart.scales.x.max;
              
              if (savedVisibleRangeRef) {
                savedVisibleRangeRef.current = {
                  min: currentMin,
                  max: currentMax
                };
              }
              
              // Адаптация Y-масштаба для видимых свечей
              if (chart.scales?.y) {
                const visibleCandles = candlesArray.filter((candle: any) => {
                  const candleTime = candle.x;
                  return candleTime >= currentMin && candleTime <= currentMax;
                });
                
                if (visibleCandles.length > 0) {
                  let minPrice = Infinity;
                  let maxPrice = -Infinity;
                  
                  visibleCandles.forEach((candle: any) => {
                    if (Number.isFinite(candle.l) && Number.isFinite(candle.h)) {
                      minPrice = Math.min(minPrice, candle.l);
                      maxPrice = Math.max(maxPrice, candle.h);
                    }
                  });
                  
                  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice !== maxPrice) {
                    const priceRange = maxPrice - minPrice;
                    const centerPrice = (minPrice + maxPrice) / 2;
                    const padding = Math.max(priceRange * 0.15, priceRange * 0.1);
                    const newMin = centerPrice - (priceRange / 2) - padding;
                    const newMax = centerPrice + (priceRange / 2) + padding;
                    
                    animateYScale(chart, newMin, newMax);
                  }
                }
              }
              
              const firstCandle = candlesArray[0];
              const oldestLoaded = oldestLoadedCandleRef?.current;
              if (firstCandle && typeof firstCandle.x === 'number' && oldestLoaded) {
                const firstCandleTime = firstCandle.x;
                const candleInterval = intervalMs[timeframe] || 60 * 1000;
                const maxAllowedOffset = 20 * candleInterval;
                const thresholdCandles = 20;
                const thresholdTime = thresholdCandles * candleInterval;
                
                const isViewingLeft = currentMin < firstCandleTime;
                const distanceToFirstCandle = currentMin - firstCandleTime;
                const isApproachingLeft = distanceToFirstCandle <= thresholdTime && distanceToFirstCandle >= 0;
                
                if (isViewingLeft || isApproachingLeft) {
                  const isLoading = isLoadingHistoryRef?.current;
                  const distanceToOldestLoaded = currentMin - (oldestLoaded - maxAllowedOffset);
                  const shouldLoadMoreHistory = distanceToOldestLoaded <= thresholdTime && !isLoading && oldestLoaded;
                
                  if (shouldLoadMoreHistory) {
                    const savedVisibleRange = chart?.scales?.x ? {
                      min: chart.scales.x.min,
                      max: chart.scales.x.max
                    } : null;
                    
                    if (savedVisibleRange && savedZoomBeforeHistoryLoadRef) {
                      savedZoomBeforeHistoryLoadRef.current = savedVisibleRange;
                    }
                    
                    loadMoreHistory(chart, savedVisibleRange);
                  }
                }
              }
            } catch (error) {

            }
          },
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.05,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
          onZoomStart: (context: any) => {
            try {
              if (isZoomingRef) {
              isZoomingRef.current = true;
              }
              if (userInteractedRef) {
                userInteractedRef.current = true;
              }
              if (autoFollowRef) {
                autoFollowRef.current = false;
              }
              
              // Обновляем время последнего взаимодействия пользователя
              if (lastUserInteractionTimeRef) {
                lastUserInteractionTimeRef.current = Date.now();
              }
              
              if (panMouseXRef) {
                panMouseXRef.current = null;
              }
              
              if (panStartBoundaryRef) {
                panStartBoundaryRef.current = null;
              }
              
              const chart = context?.chart;
              if (!chart?.scales?.x) return true;
              
              const currentMax = chart.scales.x.max as number;
              const currentMin = chart.scales.x.min as number;
              const currentRange = currentMax - currentMin;
              
              if (previousZoomRangeRef) {
              previousZoomRangeRef.current = currentRange;
              }
              if (savedZoomBeforeHistoryLoadRef) {
              savedZoomBeforeHistoryLoadRef.current = {
                min: currentMin,
                max: currentMax
              };
              }
              
              if (savedVisibleRangeRef) {
                savedVisibleRangeRef.current = {
                  min: currentMin,
                  max: currentMax
                };
              }
            } catch (error) {

            }
            return true;
          },
          onZoom: (context: any) => {
            if (userInteractedRef) {
              userInteractedRef.current = true;
            }
            try {
              const chart = context?.chart;
              if (!chart?.scales?.x) return;
              
              const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chart.data?.datasets?.[0]?.data || []);
              if (!candlesArray || candlesArray.length === 0) return;
              
              // Chart.js уже обновил viewport, выполняем мягкую нормализацию
              normalizeViewport(chart, candlesArray);
              
              // Вычисляем candleSpacing для проверки лимитов zoom
              let candleSpacing: number;
              if (candlesArray.length >= 2) {
                const lastCandle = candlesArray[candlesArray.length - 1];
                const prevCandle = candlesArray[candlesArray.length - 2];
                if (lastCandle?.x && prevCandle?.x && typeof lastCandle.x === 'number' && typeof prevCandle.x === 'number') {
                  candleSpacing = Math.abs(lastCandle.x - prevCandle.x);
                } else {
                  candleSpacing = intervalMs[timeframe] || 60 * 1000;
                }
              } else {
                candleSpacing = intervalMs[timeframe] || 60 * 1000;
              }
              
              const currentMax = chart.scales.x.max;
              const currentMin = chart.scales.x.min;
              const currentRange = currentMax - currentMin;
              
              // Мягкая коррекция лимитов zoom (min/max range)
              const minRange = candleSpacing * 5;
              const maxRange = candleSpacing * 800;
              
              if (currentRange > maxRange) {
                const center = (currentMin + currentMax) / 2;
                const newMin = center - maxRange / 2;
                const newMax = center + maxRange / 2;
                
                if (chart.scales.x.options) {
                  chart.scales.x.options.min = newMin;
                  chart.scales.x.options.max = newMax;
                }
                chart.scales.x.min = newMin;
                chart.scales.x.max = newMax;
              } else if (currentRange < minRange) {
                const center = (currentMin + currentMax) / 2;
                const newMin = center - minRange / 2;
                const newMax = center + minRange / 2;
                
                if (chart.scales.x.options) {
                  chart.scales.x.options.min = newMin;
                  chart.scales.x.options.max = newMax;
                }
                chart.scales.x.min = newMin;
                chart.scales.x.max = newMax;
              }
              
              // Повторная нормализация после коррекции лимитов
              normalizeViewport(chart, candlesArray);
              
              // Сохраняем текущий диапазон
              if (previousZoomRangeRef) {
                previousZoomRangeRef.current = chart.scales.x.max - chart.scales.x.min;
              }
              
              if (savedVisibleRangeRef) {
                savedVisibleRangeRef.current = {
                  min: chart.scales.x.min,
                  max: chart.scales.x.max
                };
              }
              
              // Адаптация Y-масштаба для видимых свечей
              if (chart.scales?.y) {
                const visibleCandles = candlesArray.filter((candle: any) => {
                  const candleTime = candle.x;
                  return candleTime >= chart.scales.x.min && candleTime <= chart.scales.x.max;
                });
                
                if (visibleCandles.length > 0) {
                  let minPrice = Infinity;
                  let maxPrice = -Infinity;
                  
                  visibleCandles.forEach((candle: any) => {
                    if (Number.isFinite(candle.l) && Number.isFinite(candle.h)) {
                      minPrice = Math.min(minPrice, candle.l);
                      maxPrice = Math.max(maxPrice, candle.h);
                    }
                  });
                  
                  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice !== maxPrice) {
                    const priceRange = maxPrice - minPrice;
                    const centerPrice = (minPrice + maxPrice) / 2;
                    const padding = Math.max(priceRange * 0.15, priceRange * 0.1);
                    const newMin = centerPrice - (priceRange / 2) - padding;
                    const newMax = centerPrice + (priceRange / 2) + padding;
                    
                    animateYScale(chart, newMin, newMax);
                  }
                }
              }
              
              // Загрузка истории при приближении к левому краю
              const firstCandle = candlesArray[0];
              const oldestLoaded = oldestLoadedCandleRef?.current;
              if (firstCandle && typeof firstCandle.x === 'number' && oldestLoaded) {
                const firstCandleTime = firstCandle.x;
                const candleInterval = intervalMs[timeframe] || 60 * 1000;
                const maxAllowedOffset = 20 * candleInterval;
                const thresholdCandles = 20;
                const thresholdTime = thresholdCandles * candleInterval;
                
                const isViewingLeft = chart.scales.x.min < firstCandleTime;
                const distanceToFirstCandle = chart.scales.x.min - firstCandleTime;
                const isApproachingLeft = distanceToFirstCandle <= thresholdTime && distanceToFirstCandle >= 0;
                
                if (isViewingLeft || isApproachingLeft) {
                  const isLoading = isLoadingHistoryRef?.current;
                  const distanceToOldestLoaded = chart.scales.x.min - (oldestLoaded - maxAllowedOffset);
                  const shouldLoadMoreHistory = distanceToOldestLoaded <= thresholdTime && !isLoading && oldestLoaded;
                
                  if (shouldLoadMoreHistory) {
                    const savedVisibleRange = chart?.scales?.x ? {
                      min: chart.scales.x.min,
                      max: chart.scales.x.max
                    } : null;
                    
                    if (savedVisibleRange && savedZoomBeforeHistoryLoadRef) {
                      savedZoomBeforeHistoryLoadRef.current = savedVisibleRange;
                    }
                    
                    loadMoreHistory(chart, savedVisibleRange);
                  }
                }
              }
            } catch (error) {

            }
          },
          onZoomComplete: (chart: any) => {
            const chartInstance = chartRef.current || chart;
            const finalMin = chartInstance?.scales?.x?.min;
            const finalMax = chartInstance?.scales?.x?.max;
            
            if (finalMin === null || finalMin === undefined || finalMax === null || finalMax === undefined) {
              return;
            }
            
            if (lastZoomCompleteValues.min === finalMin && lastZoomCompleteValues.max === finalMax) {
              return;
            }
            
            lastZoomCompleteValues.min = finalMin;
            lastZoomCompleteValues.max = finalMax;
            
            if (previousZoomRangeRef) {
            previousZoomRangeRef.current = finalMax - finalMin;
            }
            if (savedZoomAfterCompleteRef) {
            savedZoomAfterCompleteRef.current = { min: finalMin, max: finalMax };
            }
            if (justCompletedZoomRef) {
            justCompletedZoomRef.current = true;
            }
            if (isZoomingRef) {
            isZoomingRef.current = false;
            }
            
            if (panMouseXRef) {
              panMouseXRef.current = null;
            }
            
            if (panStartBoundaryRef) {
              panStartBoundaryRef.current = null;
            }
            
            if (savedVisibleRangeRef) {
              savedVisibleRangeRef.current = {
                min: finalMin,
                max: finalMax
              };
            }
            
            // Восстанавливаем зум сразу, чтобы он не сбросился при следующем обновлении
            if (chartInstance?.scales?.x) {
              chartInstance.scales.x.options.min = finalMin;
              chartInstance.scales.x.options.max = finalMax;
              chartInstance.scales.x.min = finalMin;
              chartInstance.scales.x.max = finalMax;
              chartInstance.update('none');
              
              // Сбрасываем флаг через requestAnimationFrame, чтобы дать время первому обновлению графика
              requestAnimationFrame(() => {
                // Еще один кадр, чтобы убедиться, что зум восстановлен
                requestAnimationFrame(() => {
                  if (justCompletedZoomRef) {
                  justCompletedZoomRef.current = false;
                  }
                  if (savedZoomAfterCompleteRef) {
                  savedZoomAfterCompleteRef.current = null;
                  }
                });
              });
            }
            if (autoFollowRef?.current) {
              // setAutoFollow будет вызван из компонента
            }
            
            try {
              if (!chartInstance?.scales?.x) return;
              
              const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chartInstance.data?.datasets?.[0]?.data || []);
              if (!candlesArray || candlesArray.length === 0) return;
              
              const firstCandle = candlesArray[0];
              const oldestLoaded = oldestLoadedCandleRef?.current;
              if (!firstCandle || typeof firstCandle.x !== 'number' || !oldestLoaded) return;
              
              const firstCandleTime = firstCandle.x;
              const currentMin = chartInstance.scales.x.min;
              
              const candleInterval = intervalMs[timeframe] || 60 * 1000;
              const maxAllowedOffset = 20 * candleInterval;
              const minAllowedTime = firstCandleTime - maxAllowedOffset;
              const thresholdCandles = 20;
              const thresholdTime = thresholdCandles * candleInterval;
              
              const isViewingLeft = currentMin < firstCandleTime;
              const distanceToFirstCandle = currentMin - firstCandleTime;
              const isApproachingLeft = distanceToFirstCandle <= thresholdTime && distanceToFirstCandle >= 0;
              
              if (isViewingLeft || isApproachingLeft) {
                const isLoading = isLoadingHistoryRef?.current;
                const distanceToOldestLoaded = currentMin - (oldestLoaded - maxAllowedOffset);
                const shouldLoadMoreHistory = distanceToOldestLoaded <= thresholdTime && !isLoading && oldestLoaded;
              
                if (shouldLoadMoreHistory) {
                  const savedVisibleRange = chartInstance?.scales?.x ? {
                    min: chartInstance.scales.x.min,
                    max: chartInstance.scales.x.max
                  } : null;
                  
                  if (savedVisibleRange && savedZoomBeforeHistoryLoadRef) {
                    savedZoomBeforeHistoryLoadRef.current = savedVisibleRange;
                  }
                  
                  loadMoreHistory(chartInstance, savedVisibleRange);
                }
              }
            } catch (error) {
              // Игнорируем ошибки
            }
            
            try {
              if (!chartInstance?.scales?.x) return;
              
              const candlesArray = tempCandles.current?.length > 0 ? tempCandles.current : (chartInstance.data?.datasets?.[0]?.data || []);
              
              if (!candlesArray || candlesArray.length === 0) return;
              
              let boundaryCandle;
              if (candlesArray.length >= 2) {
                boundaryCandle = candlesArray[candlesArray.length - 2];
              } else {
                boundaryCandle = candlesArray[candlesArray.length - 1];
              }
              
              const firstCandle = candlesArray[0];
              
              if (!boundaryCandle || !firstCandle || typeof boundaryCandle.x !== 'number' || typeof firstCandle.x !== 'number') {
                return;
              }
              
              const lastCandleTime = boundaryCandle.x;
              const firstCandleTime = firstCandle.x;
              const currentMax = chartInstance.scales.x.max;
              const currentMin = chartInstance.scales.x.min;
              const currentRange = currentMax - currentMin;
              
              const candleInterval = intervalMs[timeframe] || 60 * 1000;
              const minRange = 5 * candleInterval;
              const maxRange = 100 * candleInterval;
              
              if (currentRange > maxRange) {
                const center = (currentMin + currentMax) / 2;
                let newMin = center - maxRange / 2;
                let newMax = center + maxRange / 2;
                
                if (newMax > lastCandleTime) {
                  newMax = lastCandleTime;
                  newMin = newMax - maxRange;
                }
                if (newMin < firstCandleTime) {
                  newMin = firstCandleTime;
                  newMax = newMin + maxRange;
                }
                
                if (chartInstance.scales.x.options) {
                  chartInstance.scales.x.options.min = newMin;
                  chartInstance.scales.x.options.max = newMax;
                  chartInstance.update('none');
                }
                
                if (previousZoomRangeRef) {
                previousZoomRangeRef.current = maxRange;
                }
              } else if (currentRange < minRange) {
                const center = (currentMin + currentMax) / 2;
                let newMin = center - minRange / 2;
                let newMax = center + minRange / 2;
                
                if (newMax > lastCandleTime) {
                  newMax = lastCandleTime;
                  newMin = newMax - minRange;
                }
                if (newMin < firstCandleTime) {
                  newMin = firstCandleTime;
                  newMax = newMin + minRange;
                }
                
                if (chartInstance.scales.x.options) {
                  chartInstance.scales.x.options.min = newMin;
                  chartInstance.scales.x.options.max = newMax;
                  chartInstance.update('none');
                }
                
                if (previousZoomRangeRef) {
                previousZoomRangeRef.current = minRange;
                }
              } else {
                if (previousZoomRangeRef) {
                previousZoomRangeRef.current = currentRange;
                }
              }
              
              if (chart.scales?.y) {
                const visibleCandles = candlesArray.filter((candle: any) => {
                  const candleTime = candle.x;
                  return candleTime >= currentMin && candleTime <= currentMax;
                });
                
                if (visibleCandles.length > 0) {
                  let minPrice = Infinity;
                  let maxPrice = -Infinity;
                  
                  visibleCandles.forEach((candle: any) => {
                    if (Number.isFinite(candle.l) && Number.isFinite(candle.h)) {
                      minPrice = Math.min(minPrice, candle.l);
                      maxPrice = Math.max(maxPrice, candle.h);
                    }
                  });
                  
                  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice !== maxPrice) {
                    const priceRange = maxPrice - minPrice;
                    // Вычисляем центр диапазона для симметричного padding
                    const centerPrice = (minPrice + maxPrice) / 2;
                    // Увеличиваем padding до 15% от диапазона, чтобы свечи не были слишком близко к краям
                    const padding = Math.max(priceRange * 0.15, priceRange * 0.1);
                    // Применяем padding симметрично от центра
                    const newMin = centerPrice - (priceRange / 2) - padding;
                    const newMax = centerPrice + (priceRange / 2) + padding;
                    
                    animateYScale(chart, newMin, newMax);
                  }
                }
              }
            } catch (error) {
              appendDebugLog(`Error in onZoomComplete: ${error}`);
            }
          },
        },
        limits: {
          x: {},
          y: {},
        },
      },
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
        backgroundColor: "rgba(20, 22, 30, 0.98)",
        titleColor: "#fff",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "#2ECC71",
        borderWidth: 2,
        padding: 14,
        displayColors: false,
        titleFont: {
          size: 13,
          weight: 'bold',
          family: "'Inter', -apple-system, sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Courier New', monospace",
        },
        callbacks: {
          title: function(context) {
            const candle = context[0].raw as any;
            const date = new Date(candle.x);
            return date.toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          },
          label: function (context) {
            const candle = context.raw as any;
            return [
              `Open:  ${formatPrice(candle.o)}`,
              `High:  ${formatPrice(candle.h)}`,
              `Low:   ${formatPrice(candle.l)}`,
              `Close: ${formatPrice(candle.c)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        ...(hasSavedRange && savedVisibleRangeRef?.current ? {
          min: savedVisibleRangeRef.current.min,
          max: savedVisibleRangeRef.current.max,
        } : {
        min: initialXMin,
        max: initialXMax,
        }),
        time: {
          unit: "minute",
          displayFormats: {
            minute: "HH:mm",
          },
        },
        grid: gridManager.getXAxisGridConfig(),
        border: {
          display: false,
          color: "transparent",
          width: 0,
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
          font: {
            size: 11,
            family: "'Inter', -apple-system, sans-serif",
            weight: 500,
          },
          padding: 8,
          maxRotation: 0,
          autoSkip: true,
          display: false,
        },
      },
      y: {
        position: 'right',
        type: 'linear',
        beginAtZero: false,
        ...(initialYMin !== undefined && initialYMax !== undefined ? {
          min: initialYMin,
          max: initialYMax,
        } : {}),
        grid: gridManager.getYAxisGridConfig(),
        border: {
          display: false,
          color: "transparent",
          width: 0,
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
          font: {
            size: 11,
            family: "'Inter', -apple-system, sans-serif",
            weight: 500,
          },
          padding: 8,
          callback: function(value, index, ticks) {
            // Используем референсную цену для определения точности форматирования
            // Это гарантирует правильное количество знаков после запятой для всех значений на оси
            const referencePrice = referencePriceForFormatting && Number.isFinite(referencePriceForFormatting)
              ? referencePriceForFormatting
              : Number(value);
            
            return formatPriceForAxis(Number(value), referencePrice);
          }
        },
      },
    },
  };
};

