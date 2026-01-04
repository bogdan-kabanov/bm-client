import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { useWebSocket } from '@src/entities/websoket/useWebSocket';
import { websocketStore } from '@src/entities/websoket/websocket.store';
import { getServerTime as getGlobalServerTime } from '@src/shared/lib/serverTime';
import { setTradeHistory, addActiveTrade, addTradeHistory, removeActiveTrade } from '@src/entities/trading/model/slice';
import { updateBalance, updateProfitBalance, updateDemoBalance } from '@src/entities/user/model/slice';
import { selectTradingMode, selectSelectedBase, selectCurrentPrice } from '@src/entities/trading/model/selectors';
import { store } from '@src/app/store';
import { selectProfile } from '@src/entities/user/model/selectors';
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
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] ========== trade_placed MESSAGE RECEIVED ==========');
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] Full message:', JSON.stringify(message, null, 2));
        
        // Проверяем наличие newBalance в сообщении и обновляем баланс СРАЗУ
        const tradeData = message?.data;
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] Trade data:', tradeData);
        
        // Получаем текущий баланс ДО обработки
        const currentStateBefore = store.getState();
        const currentProfileBefore = selectProfile(currentStateBefore);
        const currentBalanceBefore = currentProfileBefore?.balance || 0;
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] Current balance BEFORE update:', currentBalanceBefore);
        
        // Обновляем баланс СРАЗУ, до обработки через tradePlacementService
        const tradingMode = localStorage.getItem('tradingMode');
        const isDemoTrade = tradeData?.isDemo === true || tradeData?.is_demo === true || tradingMode === 'demo';
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] Trading mode:', tradingMode);
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] Is demo trade:', isDemoTrade);
        
        if (isDemoTrade) {
          // Обновляем демо-баланс для демо-сделок
          const demoBalance = tradeData?.newDemoBalance ?? tradeData?.demoBalance;
          if (demoBalance !== undefined && demoBalance !== null && Number.isFinite(Number(demoBalance))) {
            dispatch(updateDemoBalance(Number(demoBalance)));
            
            // Также сохраняем в localStorage и отправляем broadcast
            const currentBalance = Number(localStorage.getItem('demoBalance') || '0');
            persistDemoBalance(Number(demoBalance));
            broadcastDemoBalanceUpdate({
              newBalance: Number(demoBalance),
              transactionType: Number(demoBalance) >= currentBalance ? 'REPLENISHMENT' : 'WITHDRAWAL',
              amount: Math.abs(Number(demoBalance) - currentBalance),
            });
          }
        } else if (tradeData?.newBalance !== undefined && tradeData?.newBalance !== null) {
          // Обновляем реальный баланс для реальных сделок
          const newBalanceValue = Number(tradeData.newBalance);
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] ========== Processing REAL trade balance update ==========');
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] ✅ newBalance found in message:', newBalanceValue);
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] Balance update:', {
            from: currentBalanceBefore,
            to: newBalanceValue,
            difference: newBalanceValue - currentBalanceBefore,
          });
          dispatch(updateBalance(newBalanceValue));
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] ✅ updateBalance dispatched with value:', newBalanceValue);
          
          // Проверяем баланс после dispatch
          setTimeout(() => {
            const stateAfter = store.getState();
            const profileAfter = selectProfile(stateAfter);
            const balanceAfter = profileAfter?.balance || 0;
            console.log('🔄🔄🔄 [USE_TRADE_SYNC] Balance AFTER dispatch (after 100ms):', balanceAfter);
          }, 100);
          
          if (tradeData?.newProfitBalance !== undefined && tradeData?.newProfitBalance !== null) {
            console.log('🔄🔄🔄 [USE_TRADE_SYNC] Dispatching updateProfitBalance:', tradeData.newProfitBalance);
            dispatch(updateProfitBalance(Number(tradeData.newProfitBalance)));
          }
        } else {
          // Fallback: вычитаем сумму ставки из текущего баланса
          const tradeAmount = tradeData?.amount;
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] ⚠️ newBalance NOT found in message');
          console.log('🔄🔄🔄 [USE_TRADE_SYNC] Trade amount for fallback:', tradeAmount);
          
          if (tradeAmount !== undefined && tradeAmount !== null && tradeAmount > 0) {
            console.warn('🔄🔄🔄 [USE_TRADE_SYNC] Using FALLBACK - subtracting trade amount from current balance');
            const currentState = store.getState();
            const currentProfile = selectProfile(currentState);
            const currentBalance = currentProfile?.balance || 0;
            const newBalance = Math.max(0, currentBalance - Number(tradeAmount));
            console.log('🔄🔄🔄 [USE_TRADE_SYNC] Fallback balance calculation:', {
              currentBalance,
              tradeAmount: Number(tradeAmount),
              newBalance,
              calculation: `${currentBalance} - ${tradeAmount} = ${newBalance}`,
            });
            dispatch(updateBalance(newBalance));
            console.log('🔄🔄🔄 [USE_TRADE_SYNC] ✅ updateBalance dispatched (fallback) with value:', newBalance);
            
            // Проверяем баланс после dispatch
            setTimeout(() => {
              const stateAfter = store.getState();
              const profileAfter = selectProfile(stateAfter);
              const balanceAfter = profileAfter?.balance || 0;
              console.log('🔄🔄🔄 [USE_TRADE_SYNC] Balance AFTER fallback dispatch (after 100ms):', balanceAfter);
            }, 100);
          } else {
            console.error('🔄🔄🔄 [USE_TRADE_SYNC] ❌ ERROR: newBalance not found AND tradeAmount not available!');
            console.error('🔄🔄🔄 [USE_TRADE_SYNC] Trade data:', tradeData);
          }
        }
        
        console.log('🔄🔄🔄 [USE_TRADE_SYNC] ========== END trade_placed HANDLING ==========');
        
        // Передаем сообщение в сервис для обработки
        // Сервис создаст маркер и трейд только после успешной обработки
        tradePlacementService.handleTradePlaced(
          message,
          (result) => {
            
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

    // Обработка завершенных сделок - добавляем напрямую в Redux
    const unsubscribeTradeExpired = wsOnMessage('manual_trade_expired', (message: any) => {
      console.log('[TRADE_SYNC] 📨 Получено событие manual_trade_expired:', {
        hasSuccess: message?.success,
        hasData: !!message?.data,
        message,
        timestamp: Date.now(),
      });
      
      try {
        if (message?.success && message?.data) {
          const completedTrade = message.data;
          const tradeId = completedTrade.tradeId || completedTrade.id;
          
          console.log('[TRADE_SYNC] 🔍 Обработка завершенной сделки:', {
            tradeId,
            completedTrade,
            timestamp: Date.now(),
          });
          
          if (!tradeId) {
            console.warn('[TRADE_SYNC] ⚠️ Не удалось извлечь tradeId из завершенной сделки', { completedTrade });
            return;
          }

          const isDemoTrade = completedTrade.is_demo === true || completedTrade.isDemo === true;
          const currentTradingMode = tradingMode;
          
          console.log('[TRADE_SYNC] 🔍 Проверка режима:', {
            isDemoTrade,
            currentTradingMode,
            willSkip: (currentTradingMode === 'demo' && !isDemoTrade) || (currentTradingMode === 'manual' && isDemoTrade),
          });
          
          // Проверяем, что режим совпадает
          if ((currentTradingMode === 'demo' && !isDemoTrade) || (currentTradingMode === 'manual' && isDemoTrade)) {
            console.log('[TRADE_SYNC] ⏭️ Пропуск сделки - режим не совпадает');
            return;
          }

          // Вычисляем completedAt - для завершенной сделки он должен быть всегда установлен
          let completedAt: number | null = null;
          
          // Пробуем получить completedAt из разных источников
          if (typeof completedTrade.completedAt === 'number' && completedTrade.completedAt > 0) {
            completedAt = completedTrade.completedAt;
          } else if (completedTrade.completed_at) {
            if (typeof completedTrade.completed_at === 'number' && completedTrade.completed_at > 0) {
              completedAt = completedTrade.completed_at;
            } else {
              const parsed = new Date(completedTrade.completed_at).getTime();
              if (!isNaN(parsed) && parsed > 0) {
                completedAt = parsed;
              }
            }
          }
          
          // Если completedAt все еще не установлен, используем expiration_time
          if (!completedAt || completedAt <= 0) {
            if (typeof completedTrade.expirationTime === 'number' && completedTrade.expirationTime > 0) {
              completedAt = completedTrade.expirationTime;
            } else if (completedTrade.expiration_time) {
              if (typeof completedTrade.expiration_time === 'number' && completedTrade.expiration_time > 0) {
                completedAt = completedTrade.expiration_time;
              } else {
                const parsed = new Date(completedTrade.expiration_time).getTime();
                if (!isNaN(parsed) && parsed > 0) {
                  completedAt = parsed;
                }
              }
            }
          }
          
          // Если все еще не установлен, используем текущее время
          if (!completedAt || completedAt <= 0) {
            completedAt = Date.now();
          }

          // Создаем запись истории
          const historyEntry: TradeHistoryEntry = {
            id: String(tradeId),
            price: completedTrade.entryPrice ?? completedTrade.price ?? 0,
            direction: completedTrade.direction,
            amount: completedTrade.amount ?? 0,
            entryPrice: completedTrade.entryPrice ?? completedTrade.price ?? 0,
            exitPrice: completedTrade.exitPrice ?? completedTrade.price ?? 0,
            profit: completedTrade.profit ?? 0,
            profitPercent: completedTrade.profitPercent ?? completedTrade.profit_percent ?? 0,
            isWin: completedTrade.isWin ?? completedTrade.is_win ?? false,
            createdAt: typeof completedTrade.createdAt === 'number' 
              ? completedTrade.createdAt 
              : (completedTrade.created_at ? (typeof completedTrade.created_at === 'number' ? completedTrade.created_at : new Date(completedTrade.created_at).getTime()) : Date.now()),
            completedAt: completedAt,
            expirationTime: typeof completedTrade.expirationTime === 'number'
              ? completedTrade.expirationTime
              : (completedTrade.expiration_time ? (typeof completedTrade.expiration_time === 'number' ? completedTrade.expiration_time : new Date(completedTrade.expiration_time).getTime()) : null),
            symbol: completedTrade.symbol ?? completedTrade.pair ?? null,
            baseCurrency: completedTrade.baseCurrency ?? completedTrade.base_currency ?? null,
            quoteCurrency: completedTrade.quoteCurrency ?? completedTrade.quote_currency ?? null,
            isDemo: isDemoTrade,
            is_demo: isDemoTrade,
          };

          console.log('[TRADE_SYNC] ✅ Добавление завершенной сделки в историю', {
            tradeId,
            isDemoTrade,
            completedAt: historyEntry.completedAt,
            completedTrade: {
              completedAt: completedTrade.completedAt,
              completed_at: completedTrade.completed_at,
              expirationTime: completedTrade.expirationTime,
              expiration_time: completedTrade.expiration_time,
            },
            historyEntry,
          });

          // Удаляем из активных сделок
          dispatch(removeActiveTrade(tradeId));
          
          // Если tradeId в формате "trade_42_1762014684555", также пробуем удалить по числовому id "42"
          const match = String(tradeId).match(/^trade_(\d+)_/);
          if (match && match[1]) {
            const numericId = match[1];
            dispatch(removeActiveTrade(numericId));
          }
          
          // Также пробуем удалить по completedTrade.id, если он отличается от tradeId
          if (completedTrade.id && String(completedTrade.id) !== String(tradeId)) {
            dispatch(removeActiveTrade(String(completedTrade.id)));
          }

          // Убеждаемся, что completedAt установлен для корректного увеличения счетчика
          if (!historyEntry.completedAt || historyEntry.completedAt <= 0) {
            console.log('[TRADE_SYNC] ⚠️ completedAt не установлен, устанавливаем текущее время');
            historyEntry.completedAt = Date.now();
          }
          
          console.log('[TRADE_SYNC] 🔢 Готовимся добавить завершенную сделку в историю, счетчик увеличится на 1', {
            tradeId,
            completedAt: historyEntry.completedAt,
            historyEntry,
            timestamp: Date.now(),
          });
          
          // Добавляем напрямую в Redux - это автоматически увеличит счетчик новых сделок
          console.log('[TRADE_SYNC] 📤 Вызываем dispatch(addTradeHistory)...');
          dispatch(addTradeHistory(historyEntry));
          
          console.log('[TRADE_SYNC] ✅ dispatch(addTradeHistory) вызван, проверяем Redux через 100ms...');
          
          // Проверяем состояние Redux через небольшую задержку
          setTimeout(() => {
            // Получаем текущее состояние из store (если доступно)
            console.log('[TRADE_SYNC] 🔍 Проверка состояния Redux после dispatch (через 100ms)');
          }, 100);
        }
      } catch (error) {
        console.error('[TRADE_SYNC] ❌ Ошибка обработки manual_trade_expired', error);
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
      if (unsubscribeTradeExpired) {
        unsubscribeTradeExpired();
      }
    };
  }, [wsOnMessage, handleTradesWithRigging, dispatch, tradingMode]);
  
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
      // При переключении режима запрашиваем данные заново
      if (isConnected && wsSendMessage) {
        // Запрашиваем активные сделки для нового режима
        setTimeout(() => {
          if (wsSendMessage) {
            wsSendMessage({
              type: 'get-active-manual-trades',
              mode: tradingMode,
            } as any);
          }
        }, 100);
        
        // Запрашиваем историю для нового режима
        if (requestTradeHistory) {
          setTimeout(() => {
            requestTradeHistory(tradingMode);
          }, 200);
        }
      }
    }
  }, [tradingMode, dispatch, tradesCacheRef, isConnected, wsSendMessage, requestTradeHistory]);

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

