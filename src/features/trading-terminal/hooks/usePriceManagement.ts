import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import {
  setCurrentPrice,
  setCurrentMarketPrice,
  setPrices,
} from '@src/entities/trading/model/slice';
import {
  selectCurrentPrice,
  selectTradingMode,
} from '@src/entities/trading/model/selectors';

interface UsePriceManagementProps {
  tradingMode: 'automatic' | 'manual' | 'demo';
  spreadPercent: number;
  setSpreadPercent: (value: number) => void;
}

export const usePriceManagement = ({
  tradingMode,
  spreadPercent,
  setSpreadPercent,
}: UsePriceManagementProps) => {
  const dispatch = useAppDispatch();
  const currentPrice = useAppSelector(selectCurrentPrice);
  
  const priceUpdateStatsRef = useRef<{
    count: number;
    lastUpdateTime: number;
    lastPrice: number | null;
    intervals: number[];
  }>({
    count: 0,
    lastUpdateTime: Date.now(),
    lastPrice: null,
    intervals: []
  });

  const price1 = tradingMode === 'automatic' && currentPrice ? currentPrice * (1 + spreadPercent / 100) : null;
  const price2 = tradingMode === 'automatic' && currentPrice ? currentPrice * (1 - spreadPercent / 100) : null;
  const priceDiff = (price1 && price2) ? (price1 - price2) : 0;
  const priceDiffPercent = (price2 && price2 > 0) ? (priceDiff / price2) * 100 : 0;
  
  useEffect(() => {
    dispatch(setPrices({
      price1,
      price2,
      priceDiff,
      priceDiffPercent,
      spreadPercent,
    }));
  }, [dispatch, price1, price2, priceDiff, priceDiffPercent, spreadPercent]);

  const handlePriceUpdate = useCallback((data: {
    open: number;
    high: number;
    low: number;
    close: number;
    timestamp?: number;
  }) => {
    try {
      const now = Date.now();
      const stats = priceUpdateStatsRef.current;
      
      // Валидация данных
      if (!data || typeof data.close !== 'number' || !Number.isFinite(data.close) || data.close <= 0) {
        console.error('[usePriceManagement] ❌ Невалидные данные котировки', {
          timestamp: now,
          data: data
        });
        return;
      }
      
      const previousPrice = currentPrice;
      
      const priceChanged = previousPrice === null || Math.abs(data.close - (previousPrice || 0)) > 0.00000001;
      
      stats.count++;
      if (stats.lastUpdateTime > 0) {
        const interval = now - stats.lastUpdateTime;
        stats.intervals.push(interval);
        if (stats.intervals.length > 100) {
          stats.intervals.shift();
        }
      }
      
      stats.lastUpdateTime = now;
      stats.lastPrice = data.close;
      
      // Обновляем цену в Redux для активных сделок, чтобы они реагировали на изменения цены
      // ВАЖНО: Обновляем БЕЗ startTransition для немедленного обновления UI активных сделок
      // Это гарантирует, что расчеты выигрыша/проигрыша выполняются при каждом тике цены
      if (priceChanged && data.close > 0 && Number.isFinite(data.close)) {
        // Обновляем синхронно для немедленного эффекта
        dispatch(setCurrentPrice(data.close));
        dispatch(setCurrentMarketPrice(data.close));
      }
    } catch (error) {
      console.error('[usePriceManagement] ❌ Ошибка обработки обновления цены', {
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        data: data
      });
    }
  }, [dispatch, currentPrice]);

  useEffect(() => {
    if (tradingMode !== 'automatic') {
      return;
    }

    const updateSpread = () => {
      const newSpread = 0.05 + Math.random() * 0.25;
      setSpreadPercent(Number(newSpread.toFixed(3)));
    };

    const scheduleNextUpdate = () => {
      const delay = 3000 + Math.random() * 5000;
      return setTimeout(() => {
        updateSpread();
        timeoutRef.current = scheduleNextUpdate();
      }, delay);
    };

    const timeoutRef = { current: scheduleNextUpdate() } as { current: NodeJS.Timeout };

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [tradingMode, setSpreadPercent]);

  return {
    handlePriceUpdate,
  };
};

