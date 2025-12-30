import { useRef, useCallback, useEffect, useState } from 'react';
import { Candle } from '../types';
import { ChartTimeframe } from '../types';

interface UseChartInitializationParams {
  selectedBase: string;
  symbol: string;
  bybitSymbol: string;
  bybitRequestSymbol: string;
  timeframe: ChartTimeframe;
  apiUrl: string;
  bybitInterval: string;
  currencyChangeKey: number;
  isUnmountedRef: React.MutableRefObject<boolean>;
  fetchHistoricalData: (apiUrl: string, symbol: string, interval: string) => Promise<Candle[]>;
  connectWebSocket: () => void;
  initCandleManager: () => void;
  resetCandlesState: () => void;
  forceChartUpdate: () => void;
  setLoading: (loading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  appendDebugLog: (message: string) => void;
}

export const useChartInitialization = ({
  selectedBase,
  symbol,
  bybitSymbol,
  bybitRequestSymbol,
  timeframe,
  apiUrl,
  bybitInterval,
  currencyChangeKey,
  isUnmountedRef,
  fetchHistoricalData,
  connectWebSocket,
  initCandleManager,
  resetCandlesState,
  forceChartUpdate,
  setLoading: setLoadingProp,
  setErrorMessage,
  appendDebugLog,
}: UseChartInitializationParams) => {
  const [loadingState, setLoadingStateInternal] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const initializationAttemptRef = useRef<number>(0);
  
  // Используем переданный setLoading, если он есть, иначе внутренний
  const setLoading = useCallback((value: boolean) => {
    appendDebugLog(`[setLoading] Устанавливаем loading=${value}, setLoadingProp=${!!setLoadingProp}`);
    if (setLoadingProp) {
      setLoadingProp(value);
    }
    setLoadingStateInternal(value);
  }, [setLoadingProp, appendDebugLog]);

  const init = useCallback(async () => {
    initializationAttemptRef.current++;
    const attempt = initializationAttemptRef.current;
    
    appendDebugLog(`[init] ========== НАЧАЛО ИНИЦИАЛИЗАЦИИ (попытка ${attempt}) ==========`);
    appendDebugLog(`[init] Валюта: ${selectedBase}, symbol=${symbol}, bybitSymbol=${bybitSymbol}, currencyChangeKey=${currencyChangeKey}`);
    
    // Проверяем, не размонтирован ли компонент
    if (isUnmountedRef.current) {
      appendDebugLog(`[init] Компонент размонтирован, прерываем инициализацию`);
      return;
    }

    // Сбрасываем состояние
    isUnmountedRef.current = false;
    setLoading(true);
    setLoadingHistory(false);
    setErrorMessage(null);
    resetCandlesState();
    
    appendDebugLog(`[init] Состояние UI сброшено`);
    
    // Инициализируем CandleManager ПЕРЕД загрузкой данных
    initCandleManager();
    appendDebugLog(`[init] CandleManager инициализирован`);

    // Таймаут для гарантии снятия loading
    const loadingTimeout = setTimeout(() => {
      if (!isUnmountedRef.current) {
        appendDebugLog('[init] Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 35000);

    try {
      // Загружаем исторические данные
      appendDebugLog(`[init] Начинаем загрузку исторических данных: apiUrl=${apiUrl}, symbol=${bybitRequestSymbol}, interval=${bybitInterval}`);
      setLoadingHistory(true);
      
      const loadedCandles = await fetchHistoricalData(apiUrl, bybitRequestSymbol, bybitInterval);
      
      setLoadingHistory(false);
      appendDebugLog(`[init] Исторические данные загружены: ${loadedCandles.length} свечей`);

      if (isUnmountedRef.current) {
        appendDebugLog(`[init] Компонент размонтирован после загрузки данных`);
        clearTimeout(loadingTimeout);
        return;
      }

      // Подключаем WebSocket
      try {
        appendDebugLog(`[init] Подключаем WebSocket`);
        connectWebSocket();
      } catch (wsError) {
        appendDebugLog(`[init] Ошибка подключения WebSocket: ${wsError}`);
        const wsErrorMessage = wsError instanceof Error ? wsError.message : 'Unknown error';
        let friendlyMessage = 'Ошибка подключения к серверу';
        if (wsErrorMessage.includes('NETWORK_ERROR') || wsErrorMessage.includes('Failed to fetch')) {
          friendlyMessage = 'Ошибка сети. Проверьте подключение к интернету.';
        }
        console.error(friendlyMessage);
      }
      
      // Принудительно обновляем график
      appendDebugLog(`[init] Принудительное обновление графика`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isUnmountedRef.current) {
            forceChartUpdate();
          }
        });
      });
      
      // Снимаем loading после успешной загрузки
      appendDebugLog(`[init] Снимаем loading состояние`);
      setLoading(false);
      appendDebugLog(`[init] ========== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА, loading=${false} ==========`);
    } catch (err) {
      appendDebugLog(`[init] ОШИБКА при инициализации: ${err}`);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      let friendlyMessage = 'Не удалось загрузить данные графика';
      if (errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('Failed to fetch')) {
        friendlyMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (errorMessage !== 'Unknown error') {
        friendlyMessage = `Ошибка загрузки данных: ${errorMessage}`;
      }
      console.error(friendlyMessage);
      }
      setLoading(false);
      setLoadingHistory(false);
    } finally {
      clearTimeout(loadingTimeout);
    }
  }, [
    selectedBase,
    symbol,
    bybitSymbol,
    bybitRequestSymbol,
    timeframe,
    apiUrl,
    bybitInterval,
    currencyChangeKey,
    isUnmountedRef,
    fetchHistoricalData,
    connectWebSocket,
    initCandleManager,
    resetCandlesState,
    forceChartUpdate,
    setErrorMessage,
    appendDebugLog,
  ]);

  useEffect(() => {
    let cancelled = false;
    isUnmountedRef.current = false;
    
    appendDebugLog(`[useEffect] Запуск инициализации для ${selectedBase}, timeframe=${timeframe}, bybitSymbol=${bybitSymbol}, currencyChangeKey=${currencyChangeKey}`);
    
    const runInit = async () => {
      // Небольшая задержка для гарантии, что предыдущий cleanup выполнился
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Проверяем, не отменен ли эффект перед запуском
      if (cancelled || isUnmountedRef.current) {
        appendDebugLog(`[runInit] Инициализация отменена (cancelled=${cancelled}, isUnmounted=${isUnmountedRef.current})`);
        return;
      }
      
      await init();
    };
    
    // Запускаем инициализацию
    runInit();

    return () => {
      cancelled = true;
      appendDebugLog(`[cleanup] Cleanup для ${selectedBase}, currencyChangeKey=${currencyChangeKey} (cancelled=true)`);
      // НЕ устанавливаем isUnmountedRef.current = true здесь, так как это может быть просто перезапуск эффекта
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBase, timeframe, bybitSymbol, bybitRequestSymbol, currencyChangeKey]);

  return {
    loading: loadingState,
    loadingHistory,
    setLoading: setLoadingStateInternal,
  };
};

