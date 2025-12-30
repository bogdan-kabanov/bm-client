import { useEffect, useRef, useCallback } from 'react';

interface UseChartReconnectionProps {
  wsSendMessage: ((message: any) => void) | null;
  isConnected: boolean;
  selectedBase: string;
  timeframe: string;
  currentPrice: number | null;
  currencyId?: number | null;
  onReconnect?: () => void;
  onReloadData?: () => void;
}

/**
 * Хук для управления переподключением графика и проверкой его работоспособности
 * Отслеживает видимость страницы, проверяет получение обновлений цен и переподключает подписки
 */
export const useChartReconnection = ({
  wsSendMessage,
  isConnected,
  selectedBase,
  timeframe,
  currentPrice,
  currencyId,
  onReconnect,
  onReloadData,
}: UseChartReconnectionProps) => {
  const lastPriceUpdateTimeRef = useRef<number>(Date.now());
  const lastPriceValueRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibilityChangeTimeRef = useRef<number>(Date.now());
  const isReconnectingRef = useRef(false);
  
  // Минимальный интервал между обновлениями цены (в миллисекундах)
  // Если цена не обновлялась дольше этого времени, считаем что график не работает
  const MAX_PRICE_UPDATE_INTERVAL = 60000; // 60 секунд
  
  // Интервал проверки работоспособности (heartbeat)
  const HEARTBEAT_CHECK_INTERVAL = 30000; // 30 секунд
  
  // Минимальное время отсутствия на странице для перезагрузки данных
  const MIN_ABSENCE_TIME_FOR_RELOAD = 300000; // 5 минут

  // Обновляем время последнего обновления цены
  useEffect(() => {
    if (currentPrice !== null && currentPrice !== lastPriceValueRef.current) {
      lastPriceUpdateTimeRef.current = Date.now();
      lastPriceValueRef.current = currentPrice;
    }
  }, [currentPrice]);

  // Функция переподключения подписок на котировки
  const reconnectSubscriptions = useCallback(() => {
    if (!isConnected || !wsSendMessage || isReconnectingRef.current) {
      return;
    }

    // Используем id вместо symbol
    if (!currencyId) {
      console.warn('[useChartReconnection] Не удалось переподключить подписки: id отсутствует');
      return;
    }

    isReconnectingRef.current = true;
    
    try {
      // Подписываемся на котировки для текущей валютной пары по ID
      wsSendMessage({ 
        type: 'subscribe-custom-quotes', 
        id: currencyId, 
        timeframe 
      } as any);
      
      // Вызываем колбэк переподключения
      if (onReconnect) {
        onReconnect();
      }
    } catch (error) {
      console.error('[useChartReconnection] Ошибка переподключения подписок:', error);
    } finally {
      // Сбрасываем флаг через небольшую задержку
      setTimeout(() => {
        isReconnectingRef.current = false;
      }, 1000);
    }
  }, [isConnected, wsSendMessage, currencyId, timeframe, onReconnect]);

  // Функция проверки работоспособности графика
  const checkChartHealth = useCallback(() => {
    if (!isConnected) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastPriceUpdateTimeRef.current;
    
    // Если цена не обновлялась слишком долго, переподключаем подписки
    if (timeSinceLastUpdate > MAX_PRICE_UPDATE_INTERVAL) {
      reconnectSubscriptions();
    }
  }, [isConnected, selectedBase, timeframe, reconnectSubscriptions]);

  // Настройка heartbeat для проверки работоспособности
  useEffect(() => {
    if (!isConnected) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    // Запускаем проверку работоспособности
    heartbeatIntervalRef.current = setInterval(() => {
      checkChartHealth();
    }, HEARTBEAT_CHECK_INTERVAL);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isConnected, checkChartHealth]);

  // Обработка видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      const isVisible = document.visibilityState === 'visible';
      
      if (isVisible) {
        const timeHidden = now - lastVisibilityChangeTimeRef.current;
        
        // Если страница была скрыта достаточно долго, перезагружаем данные
        if (timeHidden > MIN_ABSENCE_TIME_FOR_RELOAD && onReloadData) {
          setTimeout(() => {
            onReloadData();
          }, 500);
        }
        
        // Всегда переподключаем подписки при возврате на страницу
        if (isConnected && wsSendMessage) {
          // Отменяем предыдущий таймаут переподключения, если он был
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Переподключаем подписки с небольшой задержкой
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectSubscriptions();
          }, 1000);
        }
      } else {
        lastVisibilityChangeTimeRef.current = now;
      }
    };

    const handleFocus = () => {
      if (isConnected && wsSendMessage) {
        // Отменяем предыдущий таймаут переподключения, если он был
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Переподключаем подписки с небольшой задержкой
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectSubscriptions();
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isConnected, wsSendMessage, reconnectSubscriptions, onReloadData]);

  // Переподключение подписок при изменении валютной пары или таймфрейма
  useEffect(() => {
    if (isConnected && wsSendMessage) {
      // Небольшая задержка для избежания множественных переподключений
      const timeoutId = setTimeout(() => {
        reconnectSubscriptions();
      }, 500);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [selectedBase, timeframe, isConnected, wsSendMessage, reconnectSubscriptions]);

  // Переподключение при восстановлении соединения
  useEffect(() => {
    if (isConnected && wsSendMessage) {
      // Небольшая задержка для того, чтобы соединение полностью установилось
      const timeoutId = setTimeout(() => {
        reconnectSubscriptions();
      }, 1000);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [isConnected, wsSendMessage, reconnectSubscriptions]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);
};

