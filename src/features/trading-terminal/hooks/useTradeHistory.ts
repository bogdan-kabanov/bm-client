import { useState, useEffect, useRef, useCallback } from 'react';
import { startTransition } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { setTradeHistory } from '@src/entities/trading/model/slice';
import { selectTradeHistoryByMode } from '@src/entities/trading/model/selectors';
import type { TradeHistoryEntry } from '../lib/TradeSyncManager';
import type { TradeMode } from '../lib/TradeSyncManager';

interface TradeCacheRecord {
  tradeHistory: TradeHistoryEntry[];
  loaded: boolean;
  activeTrades?: any[];
}

export const useTradeHistory = (tradingMode: 'automatic' | 'manual' | 'demo') => {
  const dispatch = useAppDispatch();
  const filteredTradeHistory = useAppSelector(selectTradeHistoryByMode);
  
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  
  const tradesCacheRef = useRef<Record<TradeMode, TradeCacheRecord>>({
    manual: { tradeHistory: [], loaded: false },
    demo: { tradeHistory: [], loaded: false },
    automatic: { tradeHistory: [], loaded: false },
  });
  
  const setTradeHistoryNonBlocking = useCallback((updater: React.SetStateAction<TradeHistoryEntry[]>) => {
    const currentHistory = filteredTradeHistory;
    startTransition(() => {
      const next = typeof updater === 'function' ? updater(currentHistory) : updater;
      dispatch(setTradeHistory(next));
    });
  }, [filteredTradeHistory, dispatch, tradingMode]);

  const loadMoreTradeHistory = useCallback((requestTradeHistory?: (mode?: TradeMode, limit?: number, onlyNew?: boolean) => void) => {
    if (isLoadingMoreHistory || !hasMoreHistory || !requestTradeHistory) {
      return;
    }

    setIsLoadingMoreHistory(true);
    const currentLimit = filteredTradeHistory.length;
    const newLimit = currentLimit + 10;
    
    requestTradeHistory(undefined, newLimit);
    
    setTimeout(() => {
      setIsLoadingMoreHistory(false);
    }, 1000);
  }, [isLoadingMoreHistory, hasMoreHistory, filteredTradeHistory.length, tradingMode]);

  useEffect(() => {
    setHasMoreHistory(filteredTradeHistory.length > 0 && filteredTradeHistory.length >= 10);
  }, [filteredTradeHistory.length]);

  return {
    filteredTradeHistory,
    isLoadingMoreHistory,
    hasMoreHistory,
    loadMoreTradeHistory,
    setTradeHistoryNonBlocking,
    tradesCacheRef,
  };
};

