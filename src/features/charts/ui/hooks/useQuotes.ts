import { useEffect, useRef, useCallback } from 'react';
import { Candle } from '../types';
import { ChartTimeframe } from '../types';
import { getTimeframeDurationMs } from '../utils';
import { getServerTime, syncServerTimeFromWebSocket } from '@src/shared/lib/serverTime';
import { websocketStore } from '@src/entities/websoket/websocket.store';
import { createCurrencyPairSymbol, normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';

// Optimized version of normalizeCandlesArray that handles duplicates and ensures continuity
function normalizeCandlesArray(candlesArray: Candle[], timeframe: ChartTimeframe, customCandlesTimestamps: React.MutableRefObject<Set<number>>): Candle[] {
  const timeline = new Map<number, Candle>();
  
  candlesArray.forEach((rawCandle) => {
    if (!rawCandle || !Number.isFinite(rawCandle.x)) {
      return;
    }
    
    if (!Number.isFinite(rawCandle.o) || !Number.isFinite(rawCandle.h) || 
        !Number.isFinite(rawCandle.l) || !Number.isFinite(rawCandle.c)) {
      return;
    }
    
    if (rawCandle.o <= 0 || rawCandle.h <= 0 || rawCandle.l <= 0 || rawCandle.c <= 0) {
      return;
    }
    
    if (rawCandle.h < rawCandle.l || rawCandle.h < rawCandle.o || rawCandle.h < rawCandle.c ||
        rawCandle.l > rawCandle.o || rawCandle.l > rawCandle.c) {
      return;
    }
    
    const existing = timeline.get(rawCandle.x);
    if (!existing) {
      timeline.set(rawCandle.x, rawCandle);
    } else {
      // Check if existing candle is flat (temporary placeholder)
      const isFlatCandle = (c: Candle) => {
        const range = c.h - c.l;
        const priceScale = Math.max(1e-12, Math.abs(c.c || 1));
        const relativeRange = range / priceScale;
        return relativeRange < 1e-10 && Math.abs(c.o - c.c) < 1e-10;
      };
      
      const existingIsFlat = isFlatCandle(existing);
      const newIsFlat = isFlatCandle(rawCandle);
      
      // Always prefer non-flat candles over flat ones
      if (existingIsFlat && !newIsFlat) {
        // Replace flat temporary candle with real one
        timeline.set(rawCandle.x, rawCandle);
      } else if (!existingIsFlat && newIsFlat) {
        // Keep existing real candle, ignore flat new one
        // (don't update timeline)
      } else if (!existingIsFlat && !newIsFlat) {
        // Both are real candles - prefer newer data (higher volume or more recent)
        // Use the candle with more complete data (higher volume indicates more ticks processed)
        const useNew = (rawCandle.h - rawCandle.l) > (existing.h - existing.l) || 
                       Math.abs(rawCandle.c - rawCandle.o) > Math.abs(existing.c - existing.o);
        
        if (useNew) {
          timeline.set(rawCandle.x, rawCandle);
        } else {
          // Merge: keep existing open, use max high, min low, new close
          timeline.set(rawCandle.x, {
            x: existing.x,
            o: existing.o,
            h: Math.max(existing.h, rawCandle.h),
            l: Math.min(existing.l, rawCandle.l),
            c: rawCandle.c,
          });
        }
      } else {
        // Both are flat - use the new one (shouldn't happen often)
        timeline.set(rawCandle.x, rawCandle);
      }
    }
  });
  
  return Array.from(timeline.values()).sort((a, b) => a.x - b.x);
}

// Глобальный счетчик для ограничения частоты логирования
let lastGapWarningTime = 0;
const GAP_WARNING_THROTTLE = 5000;
let lastLowChangeWarningTime = 0;
const LOW_CHANGE_WARNING_THROTTLE = 5000;
let lastPriceJumpWarningTime = 0;
let lastPriceJumpTimestamp = 0;
const PRICE_JUMP_WARNING_THROTTLE = 5000;

export interface UseQuotesParams {
  selectedBase: string;
  timeframe: ChartTimeframe;
  sendWebSocketMessageRef: React.MutableRefObject<((message: any) => void) | null>;
  subscribedSymbolRef: React.MutableRefObject<string | null>;
  subscribedTimeframeRef: React.MutableRefObject<string | null>;
  subscriptionTimestampRef: React.MutableRefObject<number>;
  onWebSocketMessage?: (event: string, callback: (message: any) => void) => (() => void) | void;
  customCandlesTimestamps: React.MutableRefObject<Set<number>>;
  tempCandles: React.MutableRefObject<Candle[]>;
  lastCandleRef: React.MutableRefObject<Candle | null>;
  currentPriceRef: React.MutableRefObject<number | null>;
  onPriceUpdate?: (price: { open: number; high: number; low: number; close: number }) => void;
  scheduleChartUpdate: (options?: { force?: boolean; alignLatest?: boolean; adjustY?: boolean; syncState?: boolean }) => void;
  alignTimestampToTimeframeFn: (timestamp: number) => number;
  onTradeStart?: () => void;
  appendDebugLog: (message: string) => void;
  lastCustomPriceRef?: React.MutableRefObject<number | null>;
  chartRef?: React.MutableRefObject<any>;
  isConnected?: boolean;
  wsSendMessage: (message: any) => void;
  getCurrentTime?: () => number; // Функция для получения времени из Redux
  getCurrencyInfo?: (baseCurrency: string) => { quote_currency?: string; id?: number } | undefined; // Функция для получения информации о валюте
  onCandleUpdate?: (candle: Candle) => void; // Callback для обновления активной свечи
}

export const useQuotes = (params: UseQuotesParams) => {
  const {
    selectedBase,
    timeframe,
    sendWebSocketMessageRef,
    subscribedSymbolRef,
    subscribedTimeframeRef,
    subscriptionTimestampRef,
    onWebSocketMessage,
    customCandlesTimestamps,
    tempCandles,
    lastCandleRef,
    currentPriceRef,
    onPriceUpdate,
    scheduleChartUpdate,
    alignTimestampToTimeframeFn,
    onTradeStart,
    appendDebugLog,
    isConnected = true,
    wsSendMessage,
    getCurrencyInfo,
    chartRef,
    onCandleUpdate,
  } = params;

  // Используем ref'ы для стабилизации функций
  const onWebSocketMessageRef = useRef(onWebSocketMessage);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const scheduleChartUpdateRef = useRef(scheduleChartUpdate);
  const alignTimestampToTimeframeFnRef = useRef(alignTimestampToTimeframeFn);
  const onTradeStartRef = useRef(onTradeStart);
  const appendDebugLogRef = useRef(appendDebugLog);
  const isConnectedRef = useRef(isConnected);
  const selectedBaseRef = useRef(selectedBase);
  const periodCheckIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const chartRefRef = useRef(chartRef);
  const onCandleUpdateRef = useRef(onCandleUpdate);

  // Обновляем ref'ы при изменении функций
  onWebSocketMessageRef.current = onWebSocketMessage;
  onPriceUpdateRef.current = onPriceUpdate;
  scheduleChartUpdateRef.current = scheduleChartUpdate;
  alignTimestampToTimeframeFnRef.current = alignTimestampToTimeframeFn;
  onTradeStartRef.current = onTradeStart;
  appendDebugLogRef.current = appendDebugLog;
  isConnectedRef.current = isConnected;
  selectedBaseRef.current = selectedBase;
  chartRefRef.current = chartRef;
  onCandleUpdateRef.current = onCandleUpdate;

  // Нормализует символ валютной пары для подписки
  // Учитывает quote_currency из информации о валюте, а не только USDT
  const normalizeSymbol = useCallback((base: string): string => {
    // Проверяем, содержит ли base уже полную пару (например, "EUR_USD" или "RUB_CNY")
    if (base.includes('_') || base.includes('/')) {
      return normalizeCurrencyPair(base);
    }
    
    // Если base - это только базовая валюта, получаем quote_currency из информации о валюте
    const currencyInfo = getCurrencyInfo?.(base);
    const quoteCurrency = currencyInfo?.quote_currency || 'USDT';
    
    // Формируем символ в формате BASE_QUOTE
    return createCurrencyPairSymbol(base, quoteCurrency);
  }, [getCurrencyInfo]);

  // Подписывается на котировки
  const subscribe = useCallback(() => {
    if (!isConnected) {
      // Пропуск подписки - WebSocket не подключен
      return;
    }

    const sendMessage = sendWebSocketMessageRef.current;
    if (!sendMessage) {
      console.warn('[useQuotes] ⚠️ Пропуск подписки - sendMessage недоступен', {
        timestamp: params.getCurrentTime ? params.getCurrentTime() : getServerTime(),
        selectedBase,
        timeframe
      });
      return;
    }

    // Получаем id для текущей валютной пары
    const currencyId = getCurrencyId(selectedBase);
    
    if (!currencyId) {
      console.warn('[useQuotes] ⚠️ Не удалось получить id для подписки:', selectedBase);
      return;
    }

    // Проверяем, не подписаны ли мы уже на этот id и таймфрейм
    if (
      subscribedCurrencyIdRef.current === currencyId && 
      subscribedTimeframeRef.current === timeframe
    ) {
      // Уже подписаны на этот id и таймфрейм
      return;
    }

    // Отписываемся от предыдущей подписки, если она была
    const currentCurrencyId = subscribedCurrencyIdRef.current;
    const currentTimeframe = subscribedTimeframeRef.current;
    const subscriptionAge = subscriptionTimestampRef.current > 0 
      ? getServerTime() - subscriptionTimestampRef.current 
      : Infinity;

    // Отписываемся, если id или таймфрейм изменились
    const hadUnsubscribe = currentCurrencyId && currentTimeframe && (currentCurrencyId !== currencyId || currentTimeframe !== timeframe);
    
    if (hadUnsubscribe) {
      try {
        // Отписка от предыдущей подписки
        // Сбрасываем refs перед отпиской, чтобы фильтровать старые сообщения
        subscribedCurrencyIdRef.current = null;
        subscribedTimeframeRef.current = null;
        subscribedSymbolRef.current = null; // Для обратной совместимости
        
        sendMessage({ 
          type: 'unsubscribe-custom-quotes', 
          id: currentCurrencyId, 
          timeframe: currentTimeframe 
        } as any);
      } catch (error) {
        console.error('[useQuotes] ❌ Ошибка отписки', {
          timestamp: params.getCurrentTime ? params.getCurrentTime() : getServerTime(),
          error: error instanceof Error ? error.message : String(error),
          id: currentCurrencyId,
          timeframe: currentTimeframe
        });
      }
    }

    // Подписываемся на котировки
    // Если была отписка, добавляем задержку, чтобы сервер успел обработать отписку
    const doSubscribe = () => {
      try {
        sendMessage({ 
          type: 'subscribe-custom-quotes', 
          id: currencyId, 
          timeframe 
        } as any);
        
        // Обновляем refs только после успешной отправки запроса подписки
        subscribedCurrencyIdRef.current = currencyId;
        subscribedTimeframeRef.current = timeframe;
        subscriptionTimestampRef.current = getServerTime();
      } catch (error) {
        console.error('[useQuotes] ❌ Ошибка подписки', {
          timestamp: params.getCurrentTime ? params.getCurrentTime() : getServerTime(),
          error: error instanceof Error ? error.message : String(error),
          id: currencyId,
          timeframe
        });
        
        // Восстанавливаем предыдущие значения при ошибке
        subscribedCurrencyIdRef.current = currentCurrencyId;
        subscribedTimeframeRef.current = currentTimeframe;
      }
    };
    
    if (hadUnsubscribe) {
      // Увеличиваем задержку до 100ms для обработки отписки на сервере
      setTimeout(doSubscribe, 100);
    } else {
      // Если отписки не было, обновляем refs сразу
      subscribedCurrencyIdRef.current = currencyId;
      subscribedTimeframeRef.current = timeframe;
      subscriptionTimestampRef.current = getServerTime();
      doSubscribe();
    }
  }, [
    selectedBase,
    timeframe,
    isConnected,
    sendWebSocketMessageRef,
    subscribedTimeframeRef,
    subscriptionTimestampRef,
    getCurrencyId
  ]);

  // Полный сброс состояния при переключении валютной пары
  useEffect(() => {
    const prevBase = selectedBaseRef.current;
    // Обновляем ref сразу, чтобы он был актуальным
    selectedBaseRef.current = selectedBase;
    
    // Если валютная пара изменилась, выполняем полный сброс
    if (prevBase !== selectedBase && prevBase !== undefined) {
      // Агрессивная очистка интервала - очищаем несколько раз для надежности
      if (periodCheckIntervalIdRef.current) {
        const intervalId = periodCheckIntervalIdRef.current;
        clearInterval(intervalId);
        periodCheckIntervalIdRef.current = null;
        // Дополнительная очистка через небольшую задержку на случай, если интервал еще не успел остановиться
        setTimeout(() => {
          if (periodCheckIntervalIdRef.current === intervalId) {
            clearInterval(intervalId);
            periodCheckIntervalIdRef.current = null;
          }
        }, 50);
      }
      
      // Отписываемся от предыдущей валютной пары
      const prevCurrencyId = subscribedCurrencyIdRef.current;
      const prevTimeframe = subscribedTimeframeRef.current;
      if (prevCurrencyId && prevTimeframe && sendWebSocketMessageRef.current) {
        try {
          sendWebSocketMessageRef.current({ 
            type: 'unsubscribe-custom-quotes', 
            id: prevCurrencyId, 
            timeframe: prevTimeframe 
          } as any);
        } catch (e) {
          console.error(`[useQuotes] ❌ Ошибка при отписке от предыдущей валютной пары:`, e);
        }
      }
      
      // Сбрасываем все refs при изменении валютной пары
      lastCandleRef.current = null;
      currentPriceRef.current = null;
      tempCandles.current = [];
      customCandlesTimestamps.current.clear();
      subscribedCurrencyIdRef.current = null;
      subscribedTimeframeRef.current = null;
      subscribedSymbolRef.current = null; // Для обратной совместимости
      subscriptionTimestampRef.current = 0;
    }
    
    // Обновляем ref текущей валютной пары
    selectedBaseRef.current = selectedBase;
  }, [selectedBase]);

  // Подписка на котировки при подключении WebSocket или изменении символа/таймфрейма
  useEffect(() => {
    if (isConnected) {
      subscribe();
    }

    return () => {
      const cleanupCurrencyId = subscribedCurrencyIdRef.current;
      const cleanupTimeframe = subscribedTimeframeRef.current;
      const subscriptionAge = getServerTime() - subscriptionTimestampRef.current;

      if (subscriptionAge < 100) {
        return;
      }

      if (cleanupCurrencyId && cleanupTimeframe) {
        const sendMessage = sendWebSocketMessageRef.current;
        if (sendMessage) {
          try {
            sendMessage({ 
              type: 'unsubscribe-custom-quotes', 
              id: cleanupCurrencyId, 
              timeframe: cleanupTimeframe 
            } as any);
          } catch (error) {
            // Игнорируем ошибки отписки
          }
        }

        if (
          subscribedCurrencyIdRef.current === cleanupCurrencyId && 
          subscribedTimeframeRef.current === cleanupTimeframe
        ) {
          subscribedCurrencyIdRef.current = null;
          subscribedTimeframeRef.current = null;
          subscribedSymbolRef.current = null; // Для обратной совместимости
          subscriptionTimestampRef.current = 0;
        }
      }
    };
  }, [subscribe, isConnected]);

  // Обработка переподключения WebSocket
  useEffect(() => {
    const handleWebSocketReconnected = () => {
      subscribedCurrencyIdRef.current = null;
      subscribedTimeframeRef.current = null;
      subscribedSymbolRef.current = null; // Для обратной совместимости
      subscriptionTimestampRef.current = 0;
      setTimeout(() => {
        subscribe();
      }, 100);
    };

    window.addEventListener('websocketReconnected', handleWebSocketReconnected);
    
    return () => {
      window.removeEventListener('websocketReconnected', handleWebSocketReconnected);
    };
  }, [subscribe]);

  // Cleanup при размонтировании компонента
  useEffect(() => {
    return () => {
      const currentSubscribedSymbol = subscribedSymbolRef.current;
      const currentSubscribedTimeframe = subscribedTimeframeRef.current;
      
      if (currentSubscribedSymbol && currentSubscribedTimeframe) {
        const subscriptionAge = subscriptionTimestampRef.current > 0 
          ? getServerTime() - subscriptionTimestampRef.current 
          : Infinity;
        
        if (subscriptionAge >= 100) {
          try {
            if (typeof wsSendMessage === 'function' && isConnected) {
              const currentCurrencyId = subscribedCurrencyIdRef.current;
              if (currentCurrencyId) {
                wsSendMessage({ 
                  type: 'unsubscribe-custom-quotes', 
                  id: currentCurrencyId,
                  timeframe: currentSubscribedTimeframe
                } as any);
              }
            }
          } catch (error) {
            // Игнорируем ошибки отписки
          }
        }
        
        subscribedCurrencyIdRef.current = null;
        subscribedSymbolRef.current = null; // Для обратной совместимости
        subscribedTimeframeRef.current = null;
        subscriptionTimestampRef.current = 0;
      }
    };
  }, [wsSendMessage, isConnected]);

  // Обработка входящих котировок
  // Регистрируем обработчик сразу, независимо от isConnected, чтобы не пропустить сообщения
  useEffect(() => {
    if (!onWebSocketMessage) {
      return;
    }
    
    appendDebugLogRef.current(`Регистрация обработчика котировок`);
    let messageCount = 0;
    
    const timeframeDuration = getTimeframeDurationMs(timeframe) ?? 60_000;
    // OPTIMIZATION: Check every 10ms for immediate candle creation exactly at 00:00
    const checkInterval = 10;
    
    const intervalSelectedBase = selectedBase; // Захватываем валютную пару на момент создания интервала для проверки
    
    // Очищаем предыдущий интервал, если он существует
    if (periodCheckIntervalIdRef.current) {
      const oldIntervalId = periodCheckIntervalIdRef.current;
      clearInterval(oldIntervalId);
      periodCheckIntervalIdRef.current = null;
    }
    
    if (isConnected) {
      // Сохраняем ID интервала для проверки актуальности
      const intervalId = setInterval(() => {
        // Проверяем, что этот интервал еще актуален (не был заменен другим)
        if (periodCheckIntervalIdRef.current !== intervalId) {
          // Интервал остановлен: intervalId не совпадает
          clearInterval(intervalId);
          return;
        }
        
        if (!isConnectedRef.current) {
          return;
        }
        
        // Проверяем, что валютная пара не изменилась (используем ref для актуального значения)
        const currentSelectedBase = selectedBaseRef.current;
        if (intervalSelectedBase !== currentSelectedBase) {
          // Валютная пара изменилась - очищаем интервал и прекращаем выполнение
          // Интервал остановлен: валютная пара изменилась
          clearInterval(intervalId);
          if (periodCheckIntervalIdRef.current === intervalId) {
            periodCheckIntervalIdRef.current = null;
          }
          return;
        }
        
        if (tempCandles.current.length > 0) {
          // ВСЕГДА используем время из Redux, а не локальное время
          const now = params.getCurrentTime ? params.getCurrentTime() : getServerTime();
          const lastCandle = tempCandles.current[tempCandles.current.length - 1];
          const lastCandleEnd = lastCandle.x + timeframeDuration;
          const expectedNextCandleTime = lastCandle.x + timeframeDuration;
          const alignedCurrentTime = alignTimestampToTimeframeFnRef.current(now);
          const timeUntilNewCandle = lastCandleEnd - now;
          
          // DISABLED: Create new candle immediately when period starts
          // This is disabled to test behavior without client-side candle creation
          // New candles will be created only when received from server via WebSocket
          const shouldCreateNewCandle = false; // DISABLED: (timeUntilNewCandle <= 200 || timeUntilNewCandle < 0) && alignedCurrentTime >= expectedNextCandleTime;
          
          if (shouldCreateNewCandle) {
            // Find the last REAL candle (not a flat temporary one)
            // A flat candle is one where open=close=high=low (temporary placeholder)
            const isFlatCandle = (c: Candle) => {
              const range = c.h - c.l;
              const priceScale = Math.max(1e-12, Math.abs(c.c || 1));
              const relativeRange = range / priceScale;
              return relativeRange < 1e-10 && Math.abs(c.o - c.c) < 1e-10;
            };
            
            // Find last non-flat candle to get the real close price
            let realLastCandle = lastCandle;
            for (let i = tempCandles.current.length - 1; i >= 0; i--) {
              if (!isFlatCandle(tempCandles.current[i])) {
                realLastCandle = tempCandles.current[i];
                break;
              }
            }
            
            // Используем только цену из последней РЕАЛЬНОЙ свечи текущей валютной пары
            // Не используем currentPriceRef, так как он может содержать цену от предыдущей валютной пары
            let startPrice = realLastCandle.c;
            
            // Проверяем, что цена валидна
            if (!Number.isFinite(startPrice) || startPrice <= 0) {
              // Если цена невалидна, используем текущую цену только если она разумна
              if (currentPriceRef.current !== null && currentPriceRef.current > 0 && Number.isFinite(currentPriceRef.current)) {
                const priceRatio = realLastCandle.c > 0 ? currentPriceRef.current / realLastCandle.c : 1;
                // Используем currentPriceRef только если соотношение цен разумное (не переключение валютной пары)
                if (priceRatio >= 0.1 && priceRatio <= 10) {
                  startPrice = currentPriceRef.current;
                }
              }
            }
            
            let newCandleOpenTime: number;
            if (alignedCurrentTime >= expectedNextCandleTime) {
              newCandleOpenTime = alignedCurrentTime;
            } else {
              newCandleOpenTime = expectedNextCandleTime;
            }
            
            const newCandleForNewPeriod: Candle = {
              x: newCandleOpenTime,
              o: startPrice,
              h: startPrice,
              l: startPrice,
              c: startPrice,
            };
            
            // OPTIMIZATION: Immediately add new candle to tempCandles and update chart
            // Check if candle already exists to avoid duplicates
            const existingCandleIndex = tempCandles.current.findIndex(
              (c) => alignTimestampToTimeframeFnRef.current(c.x) === newCandleOpenTime
            );
            
            if (existingCandleIndex === -1) {
              // Add new candle immediately
              const mergedWithNew = normalizeCandlesArray([...tempCandles.current, newCandleForNewPeriod], timeframe, customCandlesTimestamps);
              tempCandles.current = mergedWithNew.length > 200 ? mergedWithNew.slice(mergedWithNew.length - 200) : mergedWithNew;
              lastCandleRef.current = mergedWithNew[mergedWithNew.length - 1];
              currentPriceRef.current = mergedWithNew[mergedWithNew.length - 1].c;
              
              // Immediately update chart
              scheduleChartUpdateRef.current({ force: true, alignLatest: true });
            }
          }
        }
      }, checkInterval);
      
      // Сохраняем ID интервала в ref для возможности проверки актуальности
      periodCheckIntervalIdRef.current = intervalId;
    }
    
    const currentOnWebSocketMessage = onWebSocketMessageRef.current;
    if (!currentOnWebSocketMessage) {
      if (periodCheckIntervalIdRef.current) {
        clearInterval(periodCheckIntervalIdRef.current);
        periodCheckIntervalIdRef.current = null;
      }
      return;
    }
    
    // Захватываем текущую валютную пару на момент создания обработчика
    const handlerSelectedBase = selectedBase;
    
    const unsubscribe = currentOnWebSocketMessage('custom_quote', (message: any) => {
      const klineData = message.data || message;
      const topic = klineData?.topic || 'unknown';
      const topicParts = topic.split('.');
      const topicSymbol = topicParts.length >= 3 ? topicParts[2] : 'unknown';
      const quoteTimeframe = topicParts.length >= 2 ? topicParts[1] : 'unknown';
      
      if (!isConnectedRef.current) {
        return;
      }
      
      // Проверяем актуальность валютной пары
      const currentSelectedBase = selectedBaseRef.current;
      if (currentSelectedBase !== handlerSelectedBase) {
        return;
      }
      
      messageCount++;
      
      // Используем serverTime из WebSocket сообщения для установки серверного времени
      if (message.serverTime && typeof message.serverTime === 'number') {
        syncServerTimeFromWebSocket(message.serverTime);
      }
      
      if (!klineData || !klineData.topic || !klineData.topic.startsWith('kline.')) {
        return;
      }
      
      // Проверяем таймфрейм и валютную пару - обрабатываем только котировки для текущего таймфрейма и валютной пары
      if (topicParts.length < 3) {
        return;
      }
      
      // Используем subscribedSymbolRef, который содержит правильный нормализованный символ из подписки
      // Это гарантирует, что мы используем тот же символ, на который подписались
      const expectedSymbol = subscribedSymbolRef.current;
      
      // Если подписка еще не установлена (subscribedSymbolRef.current === null), пропускаем все сообщения
      // Это происходит сразу после переключения валютной пары, когда подписка еще не создана
      if (!expectedSymbol || topicSymbol !== expectedSymbol || quoteTimeframe !== timeframe) {
        return;
      }
      
      if (!Array.isArray(klineData.data) || klineData.data.length === 0) {
        return;
      }
      
      const kline = klineData.data[klineData.data.length - 1];
      
      const currentTime = getServerTime();
      if (kline.start > currentTime) {
        appendDebugLogRef.current(`Пропускаем свечу с timestamp в будущем: ${kline.start} (текущее время: ${currentTime})`);
        return;
      }
      
      const isConfirmed = kline.confirm === true;
      if (isConfirmed) {
        const alignedTimestamp = alignTimestampToTimeframeFnRef.current(kline.start);
        const existingIndex = tempCandles.current.findIndex(
          (c) => alignTimestampToTimeframeFnRef.current(c.x) === alignedTimestamp
        );
        
        if (existingIndex !== -1) {
          return;
        }
      }
      
      // Парсим базовые значения
      const openPrice = parseFloat(kline.open);
      const closePrice = parseFloat(kline.close);
      const highPrice = parseFloat(kline.high);
      const lowPrice = parseFloat(kline.low);
      
      // ВАЖНО: high и low должны быть разумными относительно open/close
      // Если high/low выходят за пределы разумного (более чем на 10% от open/close), 
      // используем безопасные значения
      const maxDeviation = Math.max(openPrice, closePrice) * 0.1; // 10% отклонение
      const minPrice = Math.min(openPrice, closePrice);
      const maxPrice = Math.max(openPrice, closePrice);
      
      // Проверяем разумность high/low
      let safeHigh = highPrice;
      let safeLow = lowPrice;
      
      // High должен быть >= max(open, close) и не слишком большим
      if (highPrice < maxPrice) {
        safeHigh = maxPrice; // High не может быть меньше max(open, close)
      } else if (highPrice > maxPrice + maxDeviation) {
        safeHigh = maxPrice + maxDeviation * 0.5; // Ограничиваем аномально большой high
      }
      
      // Low должен быть <= min(open, close) и не слишком маленьким
      if (lowPrice > minPrice) {
        safeLow = minPrice; // Low не может быть больше min(open, close)
      } else if (lowPrice < minPrice - maxDeviation) {
        safeLow = minPrice - maxDeviation * 0.5; // Ограничиваем аномально маленький low
      }
      
      // Гарантируем, что high >= low
      if (safeHigh < safeLow) {
        const avg = (safeHigh + safeLow) / 2;
        safeHigh = Math.max(avg, maxPrice);
        safeLow = Math.min(avg, minPrice);
      }
      
      const candle: Candle = {
        x: kline.start,
        o: openPrice,
        h: safeHigh,
        l: safeLow,
        c: closePrice,
      };

      // Проверка временного разрыва
      const MAX_TIME_GAP_MULTIPLIER = 10;
      
      if (tempCandles.current.length > 0) {
        const lastCandle = tempCandles.current[tempCandles.current.length - 1];
        const alignedCandleX = alignTimestampToTimeframeFnRef.current(candle.x);
        const alignedLastCandleX = alignTimestampToTimeframeFnRef.current(lastCandle.x);
        const timeGap = alignedCandleX - alignedLastCandleX;
        const maxAllowedGap = timeframeDuration * MAX_TIME_GAP_MULTIPLIER;
        
        if (timeGap > maxAllowedGap) {
          appendDebugLogRef.current(`⚠️ Обнаружен большой временной разрыв: ${timeGap}ms (макс: ${maxAllowedGap}ms). Возможен разрыв WebSocket.`);
          const now = getServerTime();
          if (now - lastGapWarningTime > GAP_WARNING_THROTTLE) {
            lastGapWarningTime = now;
          }
          
          if (lastCandle.c > 0 && candle.c > 0) {
            const MAX_PRICE_CHANGE_PERCENT = 0.05;
            const priceChange = Math.abs(candle.c - lastCandle.c);
            const priceChangePercent = (priceChange / lastCandle.c) * 100;
            
            if (priceChangePercent > MAX_PRICE_CHANGE_PERCENT * 100) {
              const direction = candle.c > lastCandle.c ? 1 : -1;
              const maxAllowedChange = lastCandle.c * MAX_PRICE_CHANGE_PERCENT;
              candle.c = lastCandle.c + direction * maxAllowedChange;
              candle.o = lastCandle.c;
              candle.h = Math.min(candle.h, candle.c * 1.1);
              candle.l = Math.max(candle.l, candle.c * 0.9);
              appendDebugLogRef.current(`Ограничены значения свечи из-за большого временного разрыва`);
            }
          }
        }
      }

      const alignedTimestamp = alignTimestampToTimeframeFnRef.current(candle.x);
      const wasAlreadyCustom = customCandlesTimestamps.current.has(alignedTimestamp);
      const isFirstCustomQuote = !wasAlreadyCustom;
      
      // Используем цену из последней свечи текущей валютной пары, а не из refs
      // Это предотвращает использование цены от предыдущей валютной пары
      const lastCandleFromArray = tempCandles.current.length > 0 ? tempCandles.current[tempCandles.current.length - 1] : null;
      const previousCandlePrice = lastCandleFromArray?.c || (lastCandleRef.current?.c && tempCandles.current.length > 0 ? lastCandleRef.current.c : null) || null;
      const isDifferentCandle = alignedTimestamp !== lastPriceJumpTimestamp;
      const throttleTime = getServerTime();
      
      let isAnomaly = false;
      let anomalyInfo: { type: 'price_jump' | 'time_gap' | 'large_wick' | 'price_spike'; reason: string; severity: 'low' | 'medium' | 'high' } | undefined;
      
      // Проверяем аномалию только если есть предыдущая свеча из текущей валютной пары
      if (
        previousCandlePrice && 
        previousCandlePrice > 0 &&
        isDifferentCandle &&
        Math.abs(candle.c - previousCandlePrice) / previousCandlePrice > 0.01 &&
        (throttleTime - lastPriceJumpWarningTime > PRICE_JUMP_WARNING_THROTTLE)
      ) {
        lastPriceJumpWarningTime = throttleTime;
        lastPriceJumpTimestamp = alignedTimestamp;
        const jumpPercent = (Math.abs(candle.c - previousCandlePrice) / previousCandlePrice) * 100;
        isAnomaly = true;
        anomalyInfo = {
          type: 'price_jump',
          reason: `Скачок цены при переходе между свечами: ${jumpPercent.toFixed(2)}%`,
          severity: jumpPercent > 5 ? 'high' : jumpPercent > 2 ? 'medium' : 'low',
        };
      }
      
      if (!wasAlreadyCustom && message.isCustom) {
        customCandlesTimestamps.current.add(alignedTimestamp);
        appendDebugLogRef.current('НАЧАЛО СТАВКИ');
        onTradeStartRef.current?.();
      }
      
      // ВСЕГДА используем время из Redux, а не локальное время
      const now = params.getCurrentTime ? params.getCurrentTime() : getServerTime();
      
      if (tempCandles.current.length > 0) {
        const lastCandle = tempCandles.current[tempCandles.current.length - 1];
        const lastCandleEnd = lastCandle.x + timeframeDuration;
        const expectedNextCandleTime = lastCandle.x + timeframeDuration;
        const alignedCurrentTime = alignTimestampToTimeframeFnRef.current(now);
        
        // DISABLED: Create new candle when period ends and new quote arrives
        // This is disabled to test behavior without client-side candle creation
        // New candles will be created only when received from server via WebSocket
        /*
        if (now >= lastCandleEnd && alignedCurrentTime >= expectedNextCandleTime) {
          // Используем только цену из последней свечи текущей валютной пары
          // Не используем candle.c напрямую, так как это может быть цена от другой валютной пары
          let startPrice = lastCandle.c;
          
          // Проверяем, что цена валидна
          if (!Number.isFinite(startPrice) || startPrice <= 0) {
            // Если цена невалидна, используем цену из новой котировки только если она разумна
            if (candle.c > 0 && Number.isFinite(candle.c)) {
              const priceRatio = lastCandle.c > 0 ? candle.c / lastCandle.c : 1;
              // Используем candle.c только если соотношение цен разумное (не переключение валютной пары)
              if (priceRatio >= 0.1 && priceRatio <= 10) {
                startPrice = candle.c;
              }
            }
          }
          
          let newCandleOpenTime: number;
          if (alignedCurrentTime >= expectedNextCandleTime) {
            newCandleOpenTime = alignedCurrentTime;
          } else {
            newCandleOpenTime = expectedNextCandleTime;
          }
          
          const newCandleForNewPeriod: Candle = {
            x: newCandleOpenTime,
            o: startPrice,
            h: startPrice,
            l: startPrice,
            c: startPrice,
          };
          
          const mergedWithNew = normalizeCandlesArray([...tempCandles.current, newCandleForNewPeriod], timeframe, customCandlesTimestamps);
          tempCandles.current = mergedWithNew.length > 200 ? mergedWithNew.slice(mergedWithNew.length - 200) : mergedWithNew;
          lastCandleRef.current = mergedWithNew[mergedWithNew.length - 1];
          currentPriceRef.current = mergedWithNew[mergedWithNew.length - 1].c;
          scheduleChartUpdateRef.current({ force: true, alignLatest: true });
        }
        */
      }
      
      // Определяем, является ли это обновлением активной (последней) свечи
      const lastCandle = tempCandles.current.length > 0 ? tempCandles.current[tempCandles.current.length - 1] : null;
      const isActiveCandleUpdate = lastCandle && 
        alignedTimestamp >= lastCandle.x && 
        alignedTimestamp < lastCandle.x + timeframeDuration;
      
      const existingIndex = tempCandles.current.findIndex(
        (c) => alignTimestampToTimeframeFnRef.current(c.x) === alignedTimestamp
      );
      
      if (existingIndex !== -1) {
        const existingCandle = tempCandles.current[existingIndex];
        
        // Check if existing candle is flat (temporary placeholder)
        const isFlatCandle = (c: Candle) => {
          const range = c.h - c.l;
          const priceScale = Math.max(1e-12, Math.abs(c.c || 1));
          const relativeRange = range / priceScale;
          return relativeRange < 1e-10 && Math.abs(c.o - c.c) < 1e-10;
        };
        
        const existingIsFlat = isFlatCandle(existingCandle);
        
        // OPTIMIZATION: If confirmed candle received, mark it and skip further updates
        if (isConfirmed) {
          // Always replace flat candles with confirmed data
          // Update the existing candle with confirmed data to ensure consistency
          tempCandles.current[existingIndex] = {
            ...existingCandle,
            o: openPrice,
            h: safeHigh,
            l: safeLow,
            c: closePrice,
          };
          // Normalize to remove duplicates and ensure continuity
          const normalized = normalizeCandlesArray(tempCandles.current, timeframe, customCandlesTimestamps);
          tempCandles.current = normalized.length > 200 ? normalized.slice(normalized.length - 200) : normalized;
          scheduleChartUpdateRef.current({ force: true });
          return;
        }
        
        const originalOpen = existingCandle.o;
        
        if (isFirstCustomQuote && message.isCustom) {
          // Используем цену из последней свечи текущей валютной пары
          const lastCandleFromArray = tempCandles.current.length > 0 ? tempCandles.current[tempCandles.current.length - 1] : null;
          let initialPrice = lastCandleFromArray?.c || null;
          
          // Если нет цены из массива свечей, используем refs только если они разумны
          if (!initialPrice || initialPrice <= 0) {
            if (lastCandleRef.current?.c && lastCandleRef.current.c > 0) {
              // Проверяем, что цена из ref разумна по сравнению с новой котировкой
              if (candle.c > 0) {
                const priceRatio = lastCandleRef.current.c / candle.c;
                if (priceRatio >= 0.1 && priceRatio <= 10) {
                  initialPrice = lastCandleRef.current.c;
                } else {
                  initialPrice = candle.c;
                }
              } else {
                initialPrice = lastCandleRef.current.c;
              }
            } else {
              initialPrice = candle.c;
            }
          } else {
            // Проверяем, что цена разумна по сравнению с новой котировкой
            if (candle.c > 0) {
              const priceRatio = initialPrice / candle.c;
              if (priceRatio > 2 || priceRatio < 0.5) {
                initialPrice = (initialPrice + candle.c) / 2;
              }
            }
          }
          
          existingCandle.o = initialPrice;
          existingCandle.h = initialPrice;
          existingCandle.l = initialPrice;
          existingCandle.c = initialPrice;
        } else {
          existingCandle.o = originalOpen;
          existingCandle.c = candle.c;
          
          // ВАЖНО: high/low должны обновляться только на основе реальных цен, которые были достигнуты
          // Не используем high/low из WebSocket сообщения напрямую, если они выходят за разумные пределы
          
          const currentPrice = candle.c;
          const existingHigh = existingCandle.h;
          const existingLow = existingCandle.l;
          
          // High должен быть >= max(open, close) и обновляться только если новая цена выше существующего high
          // ИЛИ если high из сообщения разумен (не более чем на 5% от текущей цены)
          const maxPriceDeviation = currentPrice * 0.05; // 5% отклонение для high/low
          const minPrice = Math.min(existingCandle.o, currentPrice);
          const maxPrice = Math.max(existingCandle.o, currentPrice);
          
          // Обновляем high только если:
          // 1. Текущая цена выше существующего high (реальная цена достигла нового максимума)
          // 2. ИЛИ high из сообщения разумен и выше текущей цены
          if (currentPrice > existingHigh) {
            // Реальная цена достигла нового максимума - обновляем
            existingCandle.h = currentPrice;
          } else if (candle.h > currentPrice && candle.h <= currentPrice + maxPriceDeviation) {
            // High из сообщения разумен - обновляем только если он выше существующего
            existingCandle.h = Math.max(existingCandle.h, Math.min(candle.h, currentPrice + maxPriceDeviation));
          }
          
          // Обновляем low только если:
          // 1. Текущая цена ниже существующего low (реальная цена достигла нового минимума)
          // 2. ИЛИ low из сообщения разумен и ниже текущей цены
          const lowBeforeMin = existingCandle.l;
          if (currentPrice < existingLow) {
            // Реальная цена достигла нового минимума - обновляем
            existingCandle.l = currentPrice;
          } else if (candle.l < currentPrice && candle.l >= currentPrice - maxPriceDeviation) {
            // Low из сообщения разумен - обновляем только если он ниже существующего
            existingCandle.l = Math.min(existingCandle.l, Math.max(candle.l, currentPrice - maxPriceDeviation));
          }
          
          // Гарантируем, что high >= max(open, close) и low <= min(open, close)
          if (existingCandle.h < maxPrice) {
            existingCandle.h = maxPrice;
          }
          if (existingCandle.l > minPrice) {
            existingCandle.l = minPrice;
          }
          
          // Гарантируем, что high >= low
          if (existingCandle.h < existingCandle.l) {
            const avg = (existingCandle.h + existingCandle.l) / 2;
            existingCandle.h = Math.max(avg, maxPrice);
            existingCandle.l = Math.min(avg, minPrice);
          }
          
          // Проверяем на аномально большие тени (wicks)
          const bodyRange = Math.abs(existingCandle.c - existingCandle.o);
          const totalRange = existingCandle.h - existingCandle.l;
          const wickRatio = bodyRange > 0 ? totalRange / bodyRange : 0;
          
          // Если тень больше чем в 5 раз больше тела свечи, это аномалия
          if (wickRatio > 5 && !isAnomaly) {
            isAnomaly = true;
            anomalyInfo = {
              type: 'large_wick',
              reason: `Аномально большая тень: ${wickRatio.toFixed(2)}x от тела свечи`,
              severity: wickRatio > 10 ? 'high' : wickRatio > 7 ? 'medium' : 'low',
            };
          }
          
          if (existingCandle.l !== lowBeforeMin && lowBeforeMin > 0) {
            const lowChangePercent = Math.abs((existingCandle.l - lowBeforeMin) / lowBeforeMin) * 100;
            if (lowChangePercent > 0.3) {
              const now = getServerTime();
              if (now - lastLowChangeWarningTime > LOW_CHANGE_WARNING_THROTTLE) {
                lastLowChangeWarningTime = now;
              }
            }
          }
        }
        
        lastCandleRef.current = { ...existingCandle };
        currentPriceRef.current = existingCandle.c;
        
        onPriceUpdateRef.current?.({
          open: existingCandle.o,
          high: existingCandle.h,
          low: existingCandle.l,
          close: existingCandle.c,
        });
        
        // Обновляем график после обновления активной свечи
        // Используем проверку isActiveCandleUpdate для определения активной свечи
        if (isActiveCandleUpdate && existingIndex === tempCandles.current.length - 1) {
          // Это активная свеча - обновляем график для отображения изменений
          // Проверяем, что значения действительно изменились перед обновлением
          const chartInstance = chartRefRef.current?.current;
          if (chartInstance && typeof chartInstance.upsertCandle === 'function') {
            // Получаем текущие свечи из графика для сравнения
            const chartCandles = chartInstance.getCandles?.() || [];
            const lastChartCandle = chartCandles.length > 0 ? chartCandles[chartCandles.length - 1] : null;
            
            // Проверяем, что это та же свеча (по времени) и значения действительно изменились
            // Используем более строгую проверку, чтобы избежать лишних обновлений
            const PRICE_THRESHOLD = 1e-6; // Порог для сравнения цен
            const isSameCandle = lastChartCandle && lastChartCandle.openTime === existingCandle.x;
            
            // Если это та же свеча, проверяем, что значения действительно изменились
            if (isSameCandle) {
              const closeDiff = Math.abs(lastChartCandle.close - existingCandle.c);
              const highDiff = Math.abs(lastChartCandle.high - existingCandle.h);
              const lowDiff = Math.abs(lastChartCandle.low - existingCandle.l);
              const openDiff = Math.abs(lastChartCandle.open - existingCandle.o);
              
              // Используем относительную проверку для цен
              const priceScale = Math.max(1e-12, Math.abs(existingCandle.c || 1));
              const relCloseDiff = closeDiff / priceScale;
              const relHighDiff = highDiff / priceScale;
              const relLowDiff = lowDiff / priceScale;
              
              // Если все изменения очень малы, не обновляем
              if (relCloseDiff < 1e-8 && relHighDiff < 1e-8 && relLowDiff < 1e-8 && openDiff < 1e-8) {
                // Значения уже совпадают - не обновляем
                return;
              }
            }
            
            // Конвертируем свечу из формата {x, o, h, l, c} в формат {openTime, open, high, low, close}
            const chartCandle = {
              openTime: existingCandle.x,
              open: existingCandle.o,
              high: existingCandle.h,
              low: existingCandle.l,
              close: existingCandle.c,
            };
            // upsertCandle обновляет внутреннее состояние CanvasChart и вызывает scheduleRender
            chartInstance.upsertCandle(chartCandle);
          }
          
          // Обновляем loadedCandles через callback для обновления CandlesCanvas
          onCandleUpdateRef.current?.(existingCandle);
          
          // scheduleChartUpdate с syncState: true синхронизирует tempCandles с loadedCandles в TradingTerminal
          scheduleChartUpdateRef.current({ force: false, syncState: true });
        }
        
        if (isAnomaly && anomalyInfo) {
          existingCandle.anomaly = anomalyInfo;
        }
      } else {
        if (isFirstCustomQuote && message.isCustom) {
          let initialPrice = lastCandleRef.current?.c || currentPriceRef.current;
          
          if (!initialPrice || initialPrice <= 0) {
            initialPrice = candle.c;
          } else {
            if (candle.c > 0) {
              const priceRatio = initialPrice / candle.c;
              if (priceRatio > 2 || priceRatio < 0.5) {
                initialPrice = (initialPrice + candle.c) / 2;
              }
            }
          }
          
          candle.o = initialPrice;
          candle.h = initialPrice;
          candle.l = initialPrice;
          candle.c = initialPrice;
        }
      }
    });

         return () => {
           // Cleanup useEffect
           if (unsubscribe) {
             unsubscribe();
           }
           if (periodCheckIntervalIdRef.current) {
             const cleanupIntervalId = periodCheckIntervalIdRef.current;
             // Cleanup: очистка интервала
             clearInterval(cleanupIntervalId);
             periodCheckIntervalIdRef.current = null;
           }
         };
  }, [
    isConnected,
    timeframe,
    selectedBase, // Добавляем selectedBase в зависимости, чтобы интервал пересоздавался при изменении валютной пары
    onWebSocketMessage,
  ]);
};
