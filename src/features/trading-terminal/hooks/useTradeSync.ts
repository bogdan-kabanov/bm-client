import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { useWebSocket } from '@src/entities/websoket/useWebSocket';
import { websocketStore } from '@src/entities/websoket/websocket.store';
import { getServerTime as getGlobalServerTime } from '@src/shared/lib/serverTime';
import { setTradeHistory, addActiveTrade } from '@src/entities/trading/model/slice';
import { updateBalance, updateProfitBalance, updateDemoBalance } from '@src/entities/user/model/slice';
import { selectTradingMode, selectSelectedBase, selectCurrentPrice } from '@src/entities/trading/model/selectors';
import TradeSyncManager, {
  PendingTradeData,
  TradeCacheRecord,
  TradeMode,
  type TradeHistoryEntry,
} from '../lib/TradeSyncManager';
import { isTradeDemo } from '../utils/chartUtils';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';
import { tradePlacementService } from '../services/tradePlacementService';
import type { WebSocketMessage } from '@src/entities/websoket/websocket-types';
import { persistDemoBalance, broadcastDemoBalanceUpdate } from '@src/entities/demo-trading/balance';

interface UseTradeSyncProps {
  userProfile?: { id?: number } | null;
  tradesCacheRef: React.MutableRefObject<Record<TradeMode, TradeCacheRecord>>;
  pendingTradeDataRef: React.MutableRefObject<PendingTradeData | null>;
  processedExpiredTradesRef: React.MutableRefObject<Set<string>>;
  setTradeHistoryNonBlocking: (updater: React.SetStateAction<TradeHistoryEntry[]>) => void;
  setLastTradeNonBlocking: (updater: React.SetStateAction<{
    price: number;
    currentPriceAtTrade: number;
    direction: 'buy' | 'sell';
    amount: number;
    timestamp: number;
  } | null>) => void;
  handleTradesWithRigging: (trades: any[]) => void;
  chartHandleRef?: React.MutableRefObject<{ addBetMarker?: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => void } | null> | React.RefObject<{ addBetMarker?: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => void } | null>;
  // Optional: WebSocket functions from TradingWebSocketClient (if provided, use them instead of useWebSocket)
  wsSendMessage?: ((message: WebSocketMessage) => void) | null;
  wsOnMessage?: ((messageType: string, handler: (message: WebSocketMessage) => void) => (() => void)) | null;
  isConnected?: boolean;
}

export const useTradeSync = ({
  userProfile,
  tradesCacheRef,
  pendingTradeDataRef,
  processedExpiredTradesRef,
  setTradeHistoryNonBlocking,
  setLastTradeNonBlocking,
  handleTradesWithRigging,
  chartHandleRef,
  wsSendMessage: propsWsSendMessage,
  wsOnMessage: propsWsOnMessage,
  isConnected: propsIsConnected,
}: UseTradeSyncProps) => {
  const dispatch = useAppDispatch();
  // Use WebSocket from props if provided (TradingWebSocketClient), otherwise fallback to useWebSocket (WebSocketClient)
  const fallbackWebSocket = useWebSocket();
  const wsSendMessage = propsWsSendMessage ?? fallbackWebSocket.sendMessage;
  const wsOnMessage = propsWsOnMessage ?? fallbackWebSocket.onMessage;
  const isConnected = propsIsConnected ?? fallbackWebSocket.isConnected;
  const tradingMode = useAppSelector(selectTradingMode);
  const selectedBase = useAppSelector(selectSelectedBase);
  const currentPrice = useAppSelector(selectCurrentPrice);
  
  const tradeSyncManagerRef = useRef<TradeSyncManager | null>(null);
  const pendingRequestsRef = useRef<Map<string, TradeMode>>(new Map());
  const currentPriceStateRef = useRef(currentPrice);
  const prevTradingModeRef = useRef(tradingMode);
  const handlersRegisteredRef = useRef(false);

  const getServerTime = useCallback(() => getGlobalServerTime(), []);

  useEffect(() => {
    currentPriceStateRef.current = currentPrice;
  }, [currentPrice]);

  if (!tradeSyncManagerRef.current) {
    tradeSyncManagerRef.current = new TradeSyncManager({
      setTradeHistory: setTradeHistoryNonBlocking,
      setLastTrade: setLastTradeNonBlocking,
      tradesCacheRef,
      pendingRequestsRef,
      processedExpiredTradesRef,
      pendingTradeDataRef,
      currentPriceStateRef,
    });
  }

  const serverTimeOffsetRef = useRef<number>(0);
  const previousServerTimeOffsetRef = useRef<number>(0);

  const adjustTimesForServerOffset = useCallback((offsetDelta: number) => {
    if (!offsetDelta) return;

    (['manual', 'demo'] as TradeMode[]).forEach(mode => {
      const cache = tradesCacheRef.current[mode];
      if (cache.tradeHistory.length > 0) {
        cache.tradeHistory = cache.tradeHistory.map(entry => ({
          ...entry,
          createdAt: entry.createdAt + offsetDelta,
          completedAt: entry.completedAt + offsetDelta
        }));
      }
    });

    if (pendingTradeDataRef.current) {
      pendingTradeDataRef.current = {
        ...pendingTradeDataRef.current,
        createdAt: (pendingTradeDataRef.current.createdAt ?? 0) + offsetDelta
      };
    }
  }, [tradesCacheRef, pendingTradeDataRef]);

  const handleServerTimeOffsetChange = useCallback((newOffset: number) => {
    const previousOffset = previousServerTimeOffsetRef.current;

    if (newOffset === previousOffset) {
      serverTimeOffsetRef.current = newOffset;
      return;
    }

    serverTimeOffsetRef.current = newOffset;
    previousServerTimeOffsetRef.current = newOffset;

    adjustTimesForServerOffset(newOffset - previousOffset);
  }, [adjustTimesForServerOffset]);

  // Обновляем контекст только при изменении зависимостей
  useEffect(() => {
    if (tradeSyncManagerRef.current) {
      tradeSyncManagerRef.current.updateContext({
        getTradingMode: () => tradingMode,
        getSelectedBase: () => selectedBase,
        getCurrentPrice: () => currentPriceStateRef.current,
        getServerTime,
        updateServerTimeOffset: handleServerTimeOffsetChange,
        wsSendMessage,
        wsOnMessage,
        isConnected: () => websocketStore.isConnected,
        getUserId: () => userProfile?.id,
      });
    }
  }, [tradingMode, selectedBase, wsSendMessage, wsOnMessage, userProfile?.id, getServerTime, handleServerTimeOffsetChange]);

  const requestTradeHistory = useCallback((mode?: TradeMode, limit?: number, onlyNew?: boolean) => {
    tradeSyncManagerRef.current?.requestTradeHistory(mode, limit, onlyNew);
  }, [tradingMode, isConnected, userProfile?.id]);

  useEffect(() => {
    const manager = tradeSyncManagerRef.current;
    if (!manager) return;
    manager.detachHandlers();
  }, []);

  useEffect(() => {
    console.log('[TRADE_SYNC] 🔄 useEffect for handler registration', {
      hasManager: !!tradeSyncManagerRef.current,
      hasWsOnMessage: !!wsOnMessage,
      handlersRegistered: handlersRegisteredRef.current,
      wsOnMessageType: typeof wsOnMessage
    });
    
    const manager = tradeSyncManagerRef.current;
    if (!manager || !wsOnMessage) {
      console.log('[TRADE_SYNC] ⚠️ Skipping handler registration - missing manager or wsOnMessage', {
        hasManager: !!manager,
        hasWsOnMessage: !!wsOnMessage
      });
      handlersRegisteredRef.current = false;
      return;
    }

    // Reset handlersRegistered flag if wsOnMessage changed (new client instance)
    // This ensures handlers are re-registered when WebSocket client changes
    if (handlersRegisteredRef.current) {
      console.log('[TRADE_SYNC] ⏭️ Handlers already registered, but checking if re-registration needed');
      // Don't skip - allow re-registration to ensure handlers are in the correct client
    }

    console.log('[TRADE_SYNC] 🔧 Starting handler registration...');
    manager.registerHandlers();
    
    console.log('[TRADE_SYNC] 🔧 Registering trade_placed handler', {
      hasWsOnMessage: !!wsOnMessage,
      wsOnMessageType: typeof wsOnMessage,
      wsOnMessageFunction: wsOnMessage.toString().substring(0, 100)
    });
    
    // Register trade_placed handler BEFORE setting handlersRegisteredRef to true
    const unsubscribeTradePlaced = wsOnMessage('trade_placed', (message: any) => {
      try {
        console.log('[TRADE_SYNC] 📥 ========== TRADE_PLACED HANDLER CALLED ==========');
        console.log('[TRADE_SYNC] 📥 Received trade_placed message from server', {
          message,
          hasMessage: !!message,
          hasSuccess: message?.success,
          hasData: !!message?.data,
          data: message?.data,
          messageType: typeof message,
          messageKeys: message ? Object.keys(message) : []
        });
        
        // Проверяем наличие newBalance в сообщении и обновляем баланс СРАЗУ
        const tradeData = message?.data;
        console.log('💰 [TRADE_SYNC] Проверка баланса в сообщении:', {
          hasData: !!tradeData,
          newBalance: tradeData?.newBalance,
          demoBalance: tradeData?.demoBalance,
          newDemoBalance: tradeData?.newDemoBalance,
          hasNewBalance: tradeData?.newBalance !== undefined,
          hasDemoBalance: tradeData?.demoBalance !== undefined || tradeData?.newDemoBalance !== undefined,
          newProfitBalance: tradeData?.newProfitBalance,
          isDemo: tradeData?.isDemo,
          is_demo: tradeData?.is_demo,
          allDataKeys: tradeData ? Object.keys(tradeData) : []
        });
        
        // Обновляем баланс СРАЗУ, до обработки через tradePlacementService
        const tradingMode = localStorage.getItem('tradingMode');
        const isDemoTrade = tradeData?.isDemo === true || tradeData?.is_demo === true || tradingMode === 'demo';
        
        if (isDemoTrade) {
          // Обновляем демо-баланс для демо-сделок
          const demoBalance = tradeData?.newDemoBalance ?? tradeData?.demoBalance;
          if (demoBalance !== undefined && demoBalance !== null && Number.isFinite(Number(demoBalance))) {
            console.log('💰 [TRADE_SYNC] Обновление демо-баланса из trade_placed (СРАЗУ):', {
              demoBalance: Number(demoBalance),
              tradingMode,
              isDemoTrade,
              newDemoBalance: tradeData?.newDemoBalance,
              demoBalanceField: tradeData?.demoBalance
            });
            
            dispatch(updateDemoBalance(Number(demoBalance)));
            
            // Также сохраняем в localStorage и отправляем broadcast
            const currentBalance = Number(localStorage.getItem('demoBalance') || '0');
            persistDemoBalance(Number(demoBalance));
            broadcastDemoBalanceUpdate({
              newBalance: Number(demoBalance),
              transactionType: Number(demoBalance) >= currentBalance ? 'REPLENISHMENT' : 'WITHDRAWAL',
              amount: Math.abs(Number(demoBalance) - currentBalance),
            });
            
            console.log('💰 [TRADE_SYNC] ✅ Демо-баланс обновлен (СРАЗУ):', demoBalance);
          } else {
            console.log('💰 [TRADE_SYNC] Пропуск обновления демо-баланса - значение не найдено:', {
              isDemoTrade,
              newDemoBalance: tradeData?.newDemoBalance,
              demoBalance: tradeData?.demoBalance,
              tradingMode
            });
          }
        } else if (tradeData?.newBalance !== undefined && tradeData?.newBalance !== null) {
          // Обновляем реальный баланс для реальных сделок
          console.log('💰 [TRADE_SYNC] Обновление баланса из trade_placed (СРАЗУ):', {
            newBalance: tradeData.newBalance,
            tradingMode,
            isDemoTrade,
            hasNewBalance: tradeData.newBalance !== undefined,
            hasNewProfitBalance: tradeData.newProfitBalance !== undefined
          });
          
          dispatch(updateBalance(Number(tradeData.newBalance)));
          if (tradeData?.newProfitBalance !== undefined && tradeData?.newProfitBalance !== null) {
            dispatch(updateProfitBalance(Number(tradeData.newProfitBalance)));
          }
          
          console.log('💰 [TRADE_SYNC] ✅ Баланс обновлен (СРАЗУ):', tradeData.newBalance);
        } else {
          console.log('💰 [TRADE_SYNC] Пропуск обновления баланса:', {
            isDemoTrade,
            hasNewBalance: tradeData?.newBalance !== undefined,
            newBalance: tradeData?.newBalance,
            tradingMode
          });
        }
        
        // Передаем сообщение в сервис для обработки
        // Сервис создаст маркер и трейд только после успешной обработки
        tradePlacementService.handleTradePlaced(
          message,
          (result) => {
            console.log('[TRADE_SYNC] ✅ Обработка trade_placed завершена', {
              resultSuccess: result?.success,
              hasTrade: !!result?.trade,
              tradeId: result?.tradeId
            });
            
            try {
              if (result.success && result.trade) {
                // Добавляем активный трейд (добавляем к существующим, не заменяем)
                dispatch(addActiveTrade(result.trade));
                
                // Создаем маркер ставки на графике
                if (chartHandleRef?.current?.addBetMarker && result.trade.entryPrice && result.trade.createdAt) {
                  try {
                    // ВАЖНО: Используем entryPrice (цена ставки) для позиционирования, amount (сумма ставки) для отображения
                    console.log('[TRADE_SYNC] 📊 Данные для создания маркера', {
                      time: result.trade.createdAt,
                      entryPrice: result.trade.entryPrice,
                      amount: result.trade.amount,
                      hasAmount: result.trade.amount !== undefined && result.trade.amount !== null,
                      direction: result.trade.direction,
                      tradeId: result.trade.id,
                      trade: result.trade
                    });
                    
                    chartHandleRef.current.addBetMarker(
                      result.trade.createdAt,
                      result.trade.entryPrice, // Цена ставки для позиционирования на графике
                      result.trade.direction,
                      result.trade.expirationTime,
                      result.trade.id,
                      result.trade.amount // Сумма ставки для отображения на метке
                    );
                    console.log('[TRADE_SYNC] ✅ Маркер ставки создан из WebSocket', {
                      time: result.trade.createdAt,
                      price: result.trade.entryPrice,
                      amount: result.trade.amount,
                      direction: result.trade.direction,
                      tradeId: result.trade.id
                    });
                  } catch (error) {
                    console.error('[TRADE_SYNC] ❌ Ошибка создания маркера ставки', error);
                  }
                }
                
                // Также обрабатываем через handleTradesWithRigging для совместимости
                if (result.trade.symbol || result.trade.baseCurrency) {
                  handleTradesWithRigging([result.trade]);
                }
              }
            } catch (error: any) {
              console.error('[TRADE_HISTORY] ❌ Ошибка обработки результата trade_placed', error);
            }
          }
        );
      } catch (error: any) {
        console.error('[TRADE_HISTORY] ❌ Критическая ошибка обработки trade_placed', error);
      }
    });
    
    // Mark handlers as registered AFTER successful registration
    handlersRegisteredRef.current = true;
    console.log('[TRADE_SYNC] ✅ Handler registration completed', {
      hasUnsubscribeTradePlaced: !!unsubscribeTradePlaced,
      handlersRegistered: handlersRegisteredRef.current
    });

    // Обработка ошибок от сервера
    const unsubscribeError = wsOnMessage('error', (message: any) => {
      try {
        // Передаем ошибку в сервис
        tradePlacementService.handleTradeError(
          message,
          (errorMessage) => {
            // Обработка ошибки
          }
        );
      } catch (error: any) {
        console.error('[TRADE_HISTORY] ❌ Ошибка обработки error сообщения', error);
      }
    });

    const unsubscribeActiveTrades = wsOnMessage('active_manual_trades', (message: any) => {
      if (message?.success && message?.data?.trades && Array.isArray(message.data.trades)) {
        const trades = message.data.trades;
        if (trades.length > 0) {
          handleTradesWithRigging(trades);
        }
      }
    });

    return () => {
      manager.detachHandlers();
      handlersRegisteredRef.current = false;
      if (unsubscribeTradePlaced) {
        unsubscribeTradePlaced();
      }
      if (unsubscribeActiveTrades) {
        unsubscribeActiveTrades();
      }
      if (unsubscribeError) {
        unsubscribeError();
      }
    };
  }, [wsOnMessage, handleTradesWithRigging]);
  
  // Отдельный useEffect для перерегистрации обработчиков при подключении WebSocket
  useEffect(() => {
    const actuallyConnected = websocketStore.isConnected;
    const manager = tradeSyncManagerRef.current;
    
    if (actuallyConnected && manager && wsOnMessage && !handlersRegisteredRef.current) {
      manager.registerHandlers();
      handlersRegisteredRef.current = true;
    }
    
    // Подписываемся на изменения состояния подключения
    const unsubscribe = websocketStore.subscribe(() => {
      const nowConnected = websocketStore.isConnected;
      
      if (nowConnected && manager && wsOnMessage && !handlersRegisteredRef.current) {
        manager.registerHandlers();
        handlersRegisteredRef.current = true;
      }
    });
    
    return unsubscribe;
  }, [wsOnMessage, userProfile?.id, tradingMode]);

  const loadDataForMode = useCallback((mode: TradeMode) => {
    if (!userProfile?.id || !tradeSyncManagerRef.current || !isConnected) {
      return;
    }
    tradeSyncManagerRef.current.requestTradeHistory(mode);
  }, [userProfile?.id, isConnected]);

  useEffect(() => {
    if (tradingMode !== 'manual' && tradingMode !== 'demo') {
      if (prevTradingModeRef.current !== tradingMode && (prevTradingModeRef.current === 'manual' || prevTradingModeRef.current === 'demo')) {
        dispatch(setTradeHistory([]));
      }
      prevTradingModeRef.current = tradingMode;
      return;
    }

    const modeChanged = prevTradingModeRef.current !== tradingMode;
    const cachedData = tradesCacheRef.current[tradingMode];
    const isDemoMode = tradingMode === 'demo';

    if (modeChanged && tradeSyncManagerRef.current) {
      tradeSyncManagerRef.current.resetModeRequestFlag(tradingMode);
    }

    if (modeChanged && cachedData.tradeHistory.length > 0) {
      const filteredHistory = cachedData.tradeHistory.filter((trade: any) => 
        isTradeDemo(trade) === isDemoMode
      );
      if (filteredHistory.length > 0) {
        dispatch(setTradeHistory(filteredHistory));
      }
    }

    if (modeChanged) {
      prevTradingModeRef.current = tradingMode;
    }
  }, [tradingMode, dispatch, tradesCacheRef]);

  const requestActiveTrades = useCallback(() => {
    if (!userProfile?.id || !wsSendMessage) {
      return;
    }

    if (tradingMode === 'manual' || tradingMode === 'demo') {
      const manager = tradeSyncManagerRef.current;
      if (manager) {
        manager.requestInitialData(tradingMode);
      }
      
      try {
        const messageToSend = {
          type: 'get-active-manual-trades',
          mode: tradingMode,
        };
        wsSendMessage(messageToSend as any);
      } catch (error) {
        console.error('[TRADE_HISTORY] ❌ Ошибка отправки', { error });
      }
    }
  }, [tradingMode, userProfile?.id, wsSendMessage]);

  useEffect(() => {
    if (!isConnected) {
      tradeSyncManagerRef.current?.resetInitialRequestFlag();
      return;
    }
    
    try {
      requestActiveTrades();
    } catch (error) {
      console.error('[TRADE_HISTORY] ❌ Ошибка при вызове requestActiveTrades', { error });
    }
  }, [isConnected, requestActiveTrades, tradingMode, userProfile?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        setTimeout(() => {
          requestActiveTrades();
        }, 500);
      }
    };

    const handleFocus = () => {
      if (isConnected) {
        setTimeout(() => {
          requestActiveTrades();
        }, 500);
      }
    };

  }, [isConnected, requestActiveTrades]);

  return {
    tradeSyncManagerRef,
    requestTradeHistory,
    loadDataForMode,
    requestActiveTrades,
  };
};

