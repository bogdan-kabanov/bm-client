import { WebSocketStore } from './websocket.store';
import {
    WebSocketMessage,
    isTransactionMessage,
    isAuthMessage,
    isErrorMessage,
    isTradingStartedMessage,
    isTradingStoppedMessage,
    isWithdrawalCreatedMessage,
    isBalanceUpdatedMessage,
    isConnectedMessage,
    isNotificationMessage,
    isTradingUpdateMessage,
    isTradeMessage,
    isStatsUpdateMessage,
    isTradePlacedMessage,
    isManualTradeExpiredMessage,
    isActiveManualTradesMessage,
    ManualTradePriceUpdatedMessage,
    isSessionTerminatedMessage,
} from './websocket-types';
import { AppDispatch } from "@src/app/store";
import { fetchTransactions } from "@src/entities/transactions/model/slice.ts";
import { updateBalance, updateCoins, updateProfitBalance, updateUserFromWebSocket } from "@src/entities/user/model/slice.ts";
import { setWithdrawalHistory } from "@src/entities/withdrawal/model/slice.ts";
import { tradingStore } from "@src/entities/trading/model/trading-store";
import { tradePlacementService } from "@src/features/trading-terminal/services/tradePlacementService";
import {
    resolveTradeId,
    demoGroup,
    demoLog,
} from "@src/entities/demo-trading";
import { updateDemoBalance } from "@src/entities/user/model/slice.ts";
import { persistDemoBalance, broadcastDemoBalanceUpdate } from "@src/entities/demo-trading/balance";
import { setActiveTrades, addActiveTrade, updateActiveTrade, removeActiveTrade } from "@src/entities/trading/model/slice.ts";
import { ActiveTrade } from "@src/entities/trading/model/types.ts";
import { pendingTradeMarkersStore } from "@src/features/trading-terminal/lib/pendingTradeMarkers.ts";
import { normalizeCurrencyPair } from "@src/shared/lib/currencyPairUtils";
import { unstable_batchedUpdates } from 'react-dom';
import { getServerTime } from "@src/shared/lib/serverTime";

// interface TelegramUser {
//     id: number;
//     first_name?: string;
//     last_name?: string;
//     username?: string;
//     language_code?: string;
//     photo_url?: string;
//     allows_write_to_pm?: boolean;
// }

export const registerHandlers = (store: WebSocketStore, dispatch: AppDispatch) => {
    const processedTransactionIds = new Set<number>();
    const processedWithdrawalIds = new Set<number>();

    // Диагностический wildcard-логгер всех входящих сообщений (включая custom_quote)

    // Обработка auth_success (формат, который может отправлять сервер)
    store.onMessage('auth_success', (message: WebSocketMessage) => {
        console.log(`[message-handlers] 🔐 Обработчик auth_success вызван:`, message);
        store.error = null;
        store.setAuthenticated(true);
    });

    store.onMessage('auth', (message: WebSocketMessage) => {
        console.log(`[message-handlers] 🔐 Обработчик auth вызван:`, {
            message,
            isAuthMessage: isAuthMessage(message),
            hasSuccess: (message as any).success
        });
        if (isAuthMessage(message)) {
            if (message.success) {
                console.log(`[message-handlers] ✅ Аутентификация успешна, устанавливаем isAuthenticated=true`);
                store.error = null;
                store.setAuthenticated(true);
            } else {
                console.error(`[message-handlers] ❌ Аутентификация не удалась:`, message.message);
                store.error = message.message || 'Authentication Error';
                store.setAuthenticated(false);
                
                setTimeout(() => {
                    const newToken = localStorage.getItem('token');
                    if (newToken) {
                        store.reconnect();
                    }
                }, 3000);
            }
        } else {
            console.warn(`[message-handlers] ⚠️ Сообщение auth не прошло проверку isAuthMessage`);
        }
    });

    store.onMessage('error', (message: WebSocketMessage) => {
        // ВАЖНО: Обрабатываем ошибки через tradePlacementService для правильной обработки pending trades
        // Это необходимо для копи-сигналов, которые используют WebSocketClient через useWebSocket()
        try {
            tradePlacementService.handleTradeError(message);
        } catch (error) {
            console.error('[message-handlers] Ошибка обработки error через tradePlacementService:', error);
        }
        if (isErrorMessage(message)) {
            const text = (message.message || '').toLowerCase();
            if (text.includes('аутентифика') || text.includes('authentication')) {
                store.setAuthenticated(false);
                if (store.hasUserId) {
                    setTimeout(() => {
                        store.retryAuthentication();
                    }, 100);
                }
            }
        }
    });

    store.onMessage('session_terminated', (message: WebSocketMessage) => {
        if (isSessionTerminatedMessage(message)) {
            // Отключаем WebSocket соединение
            store.disconnect();
            // Импортируем и вызываем logout функцию
            import('@src/features/auth/authCheck').then(({ logout }) => {
                logout();
            });
        }
    });

    store.onMessage('transaction_executed', (message: WebSocketMessage) => {
        if (isTransactionMessage(message) && message.userData && message.transaction) {
            const transactionId = message.transaction.id;
            if (processedTransactionIds.has(transactionId)) {
                return;
            }
            processedTransactionIds.add(transactionId);
            
            // Проверяем режим торговли - если демо, НИКОГДА не обновляем реальный баланс
            const tradingMode = localStorage.getItem('tradingMode');
            demoGroup('transaction_executed', {
                tradingMode,
                transactionId,
                transaction: message.transaction,
                userData: message.userData,
            });
            if (tradingMode !== 'demo') {
                dispatch(updateUserFromWebSocket(message.userData));
            } else {
                // В демо режиме НЕ обновляем userProfile вообще
                // Это предотвращает переключение баланса на реальный

            }

            tradingStore.addNewTransaction(transactionId);

            setTimeout(() => {
                dispatch(fetchTransactions());
            }, 100);
        }
    });

    store.onMessage('trading_started', (message: WebSocketMessage) => {
        if (isTradingStartedMessage(message)) {
            // Trading started
        }
    });

    store.onMessage('trading_stopped', (message: WebSocketMessage) => {
        if (isTradingStoppedMessage(message)) {
            // Trading stopped
        }
    });

    store.onMessage('withdrawal_created', (message: WebSocketMessage) => {
        if (isWithdrawalCreatedMessage(message) && message.data.withdrawal) {
            const withdrawalId = message.data.withdrawal.id;
            if (processedWithdrawalIds.has(withdrawalId)) {
                return;
            }
            processedWithdrawalIds.add(withdrawalId);
            dispatch(setWithdrawalHistory(message.data.withdrawals));
            dispatch(updateProfitBalance(message.data.balance));

            // // NEW: Handle popup flag (dispatch a new action if needed, or log for now)
            // if (message.data.show_withdrawal_popup) {
            //     // Optional: Dispatch a new action, e.g., dispatch(showWithdrawalPopup(true));
            // }
        }
    });

    store.onMessage('balance_updated', (message: WebSocketMessage) => {
        console.log('💰 [Client] balance_updated message received:', message);
        if (isBalanceUpdatedMessage(message)) {
            // В демо режиме НЕ обновляем баланс
            const tradingMode = localStorage.getItem('tradingMode');
            console.log('💰 [Client] balance_updated handler:', {
                tradingMode,
                balance: message.data.balance,
                coins: message.data.coins,
                willUpdate: tradingMode !== 'demo',
            });
            demoGroup('balance_updated', { tradingMode, payload: message.data });
            if (tradingMode !== 'demo') {
                console.log('💰 [Client] Dispatching updateBalance:', message.data.balance);
                dispatch(updateBalance(message.data.balance));
                dispatch(updateCoins(message.data.coins));
            } else {
                console.log('💰 [Client] Skipping balance update (demo mode)');
            }
        } else {
            console.warn('💰 [Client] balance_updated message format invalid:', message);
        }
    });

    store.onMessage('demo_balance_updated', (message: WebSocketMessage) => {
        console.log('💰 [Client] demo_balance_updated message received:', message);
        const tradingMode = localStorage.getItem('tradingMode');
        if (tradingMode === 'demo' && message.data && typeof (message.data as any).demoBalance === 'number') {
            const demoBalance = (message.data as any).demoBalance;
            console.log('💰 [Client] Dispatching updateDemoBalance:', demoBalance);
            dispatch(updateDemoBalance(demoBalance));
            demoLog('demo_balance_updated received', { demoBalance, raw: message });
        } else {
            console.log('💰 [Client] Skipping demo balance update:', { tradingMode, hasDemoBalance: !!(message.data && typeof (message.data as any).demoBalance === 'number') });
        }
    });

    store.onMessage('withdrawals_updated', () => {
        // Withdrawals updated
    });

    store.onMessage('connected', (message: WebSocketMessage) => {
        if (isConnectedMessage(message)) {
            // Connected
        }
    });

    store.onMessage('trading-update', (message: WebSocketMessage) => {
        if (isTradingUpdateMessage(message)) {
            // Trade update
        }
    });

    store.onMessage('notification', (message: WebSocketMessage) => {
        if (isNotificationMessage(message)) {
            // Notification received
        }
    });

    store.onMessage('place-trade', (message: WebSocketMessage) => {
        if (isTradeMessage(message)) {
            // Trade placed
        }
    });

    store.onMessage('stats_update', (message: WebSocketMessage) => {
        if (isStatsUpdateMessage(message)) {
            // Сохраняем статистику в localStorage для доступа из компонентов
            localStorage.setItem('live_stats', JSON.stringify(message.data));
            
            // Отправляем событие для компонентов
            window.dispatchEvent(new CustomEvent('stats_updated', { 
                detail: message.data 
            }));
        }
    });

    store.onMessage('trade_placed', (message: WebSocketMessage) => {
        console.log('💰 [Client] trade_placed message received:', {
            hasSuccess: message?.success,
            hasData: !!message?.data,
            newBalance: (message?.data as any)?.newBalance,
            isDemo: (message?.data as any)?.isDemo,
            is_demo: (message?.data as any)?.is_demo,
            fullData: message?.data,
        });
        
        // ВАЖНО: Сначала обрабатываем через tradePlacementService для правильной обработки pending trades
        // Это необходимо для копи-сигналов, которые используют WebSocketClient через useWebSocket()
        try {
            tradePlacementService.handleTradePlaced(message);
        } catch (error) {
            console.error('[message-handlers] Ошибка обработки trade_placed через tradePlacementService:', error);
        }
        
        const profitPercentage = (message?.data as any)?.profitPercentage ?? (message?.data as any)?.profit_percentage ?? 'null';
        const isTradePlaced = isTradePlacedMessage(message);
        const hasSuccess = message?.success;
        const hasData = !!message?.data;
        
        if (isTradePlaced && !hasSuccess) {
            const tradeData = message.data as any;
            const tempMarkerId = pendingTradeMarkersStore.findAndRemove(tradeData);
            const tradeId = resolveTradeId(message.data);
            const errorMessage = (message as any)?.message || (message as any)?.error || 'Ошибка при создании сделки';

            return;
        }
        
        if (isTradePlaced && hasSuccess && hasData) {
            const tradingMode = localStorage.getItem('tradingMode');
            const tradeData = message.data as any;
            
            const isDemoFromMessage = tradeData?.isDemo === true || tradeData?.is_demo === true;
            const isDemoFromLocalStorage = tradingMode === 'demo';
            
            const isDemoTrade = isDemoFromMessage || (isDemoFromLocalStorage && !isDemoFromMessage && tradeData?.isDemo !== false && tradeData?.is_demo !== false);

            demoGroup('trade_placed received', {
                isDemoFromMessage,
                isDemoFromLocalStorage,
                isDemoTrade,
                data: tradeData,
                tradingMode,
            });

            if (isDemoTrade) {
                const tradeId = resolveTradeId(message.data);
                const nextBalanceRaw = Number(
                    (message.data as any)?.newDemoBalance ??
                    (message.data as any)?.demoBalance ??
                    (message.data as any)?.newBalance ??
                    (message.data as any)?.balance
                );

                if (Number.isFinite(nextBalanceRaw)) {
                    console.log('💰 [Client] Updating demo balance from trade_placed:', {
                        nextBalanceRaw,
                        tradeId,
                        messageData: message.data,
                    });
                    
                    // Update Redux store first
                    dispatch(updateDemoBalance(nextBalanceRaw));
                    console.log('💰 [Client] Redux store updated with demo balance:', nextBalanceRaw);
                    
                    // Also persist to localStorage and broadcast for real-time updates
                    // This ensures all components using useDemoBalance hook also update
                    const currentBalance = Number(localStorage.getItem('demoBalance') || '0');
                    persistDemoBalance(nextBalanceRaw);
                    console.log('💰 [Client] localStorage updated with demo balance:', nextBalanceRaw);
                    
                    broadcastDemoBalanceUpdate({
                        newBalance: nextBalanceRaw,
                        transactionType: nextBalanceRaw >= currentBalance ? 'REPLENISHMENT' : 'WITHDRAWAL',
                        amount: Math.abs(nextBalanceRaw - currentBalance),
                    });
                    console.log('💰 [Client] Broadcast demo balance update sent');
                    
                    demoLog('trade_placed demo path - balance updated', {
                        tradeId,
                        nextBalance: nextBalanceRaw,
                        currentBalance,
                        raw: message.data,
                        newDemoBalance: (message.data as any)?.newDemoBalance,
                        demoBalance: (message.data as any)?.demoBalance,
                    });
                } else {
                    demoLog('trade_placed demo path - no balance found', {
                        tradeId,
                        raw: message.data,
                        available: {
                            newDemoBalance: (message.data as any)?.newDemoBalance,
                            demoBalance: (message.data as any)?.demoBalance,
                            newBalance: (message.data as any)?.newBalance,
                            balance: (message.data as any)?.balance,
                        },
                    });
                }

            } else {
                // Реальная сделка - обновляем баланс
                if (tradingMode !== 'demo' && !isDemoTrade) {
                    console.log('💰 [Client] trade_placed: Processing real trade balance update', {
                        newBalance: tradeData?.newBalance,
                        newProfitBalance: tradeData?.newProfitBalance,
                        hasNewBalance: tradeData?.newBalance !== undefined,
                    });
                    
                    // Обновляем баланс если newBalance пришел в сообщении
                    if (tradeData?.newBalance !== undefined && tradeData?.newBalance !== null) {
                        console.log('💰 [Client] trade_placed: Dispatching updateBalance:', tradeData.newBalance);
                        dispatch(updateBalance(Number(tradeData.newBalance)));
                    } else {
                        console.warn('💰 [Client] trade_placed: newBalance not found in trade data, balance will not be updated from this message');
                    }
                    
                    // Обновляем profit balance если пришел
                    if (tradeData?.newProfitBalance !== undefined && tradeData?.newProfitBalance !== null) {
                        console.log('💰 [Client] trade_placed: Dispatching updateProfitBalance:', tradeData.newProfitBalance);
                        dispatch(updateProfitBalance(Number(tradeData.newProfitBalance)));
                    }
                } else {
                    console.log('💰 [Client] trade_placed: Skipping balance update (demo mode or demo trade)');
                }
            }

            const tradePlacedEvent = new CustomEvent('trade_placed', {
                detail: {
                    ...tradeData,
                    success: true,
                    message: message.message,
                }
            });
            
            window.dispatchEvent(tradePlacedEvent);
            const tradeId = resolveTradeId(tradeData);

            if (tradeId && tradeData && tradeData.entryPrice && tradeData.expirationTime) {
                try {
                    const entryPrice = tradeData.entryPrice;
                    const expirationTime = tradeData.expirationTime;
                    // ВАЖНО: используем серверное время, а не локальное время клиента
                    const tradeTimestamp = tradeData.trade_timestamp || tradeData.tradeTimestamp || tradeData.serverTime || tradeData.createdAt || getServerTime();
                    const createdAtRaw = typeof tradeTimestamp === 'number' ? tradeTimestamp : (tradeTimestamp?.getTime?.() || getServerTime());
                    const createdAt = Math.floor(createdAtRaw);
                    
                    const baseCurrency = tradeData.baseCurrency || tradeData.base_currency;
                    const quoteCurrency = tradeData.quoteCurrency || tradeData.quote_currency;
                    let symbol = tradeData.symbol || (baseCurrency && quoteCurrency ? `${baseCurrency}_${quoteCurrency}` : null);
                    
                    if (symbol) {
                        symbol = normalizeCurrencyPair(symbol);
                    }

                    if (!symbol) {

                        return;
                    }
                    
                    const activeTrade: ActiveTrade = {
                        id: tradeId,
                        price: tradeData.price || entryPrice,
                        direction: tradeData.direction,
                        amount: tradeData.amount,
                        expirationTime: expirationTime,
                        entryPrice: entryPrice,
                        currentPrice: tradeData.currentPrice || entryPrice,
                        currentPriceAtTrade: tradeData.currentPriceAtTrade || entryPrice,
                        createdAt: createdAt,
                        symbol: symbol,
                        baseCurrency: baseCurrency,
                        quoteCurrency: quoteCurrency,
                        isDemo: isDemoTrade,
                        is_demo: isDemoTrade,
                        profitPercentage: tradeData.profitPercentage || tradeData.profit_percentage,
                        rigging: tradeData.rigging ? {
                            outcome: tradeData.rigging.outcome as 'win' | 'lose',
                            targetPrice: tradeData.rigging.targetPrice,
                            plan: tradeData.rigging.plan,
                        } : null,
                        is_copied: tradeData.isCopied || tradeData.is_copied || false,
                        copy_subscription_id: tradeData.copySubscriptionId || tradeData.copy_subscription_id || null,
                        copied_from_user_id: tradeData.copiedFromUserId || tradeData.copied_from_user_id || null,
                    };

                    const tempMarkerId = pendingTradeMarkersStore.findAndRemove(tradeData);
                    
                    unstable_batchedUpdates(() => {
                        dispatch(addActiveTrade(activeTrade));
                    });
                } catch (error) {

                }
            } else {

            }

            setTimeout(() => {
                const token = localStorage.getItem('token');
                if (token) {
                    dispatch(fetchTransactions()).catch(() => {
                        // Тихо игнорируем ошибки при обновлении транзакций
                    });
                }
            }, 100);
        }
    });

    // Обработчик завершения ручной сделки
    store.onMessage('manual_trade_expired', (message: WebSocketMessage) => {
        console.log('[MANUAL_TRADE_EXPIRED] 📨 Получено сообщение о завершении сделки', {
            messageType: message.type,
            success: message.success,
            hasData: !!message.data,
            rawMessage: message,
        });
        
        if (isManualTradeExpiredMessage(message) && message.success && message.data) {
            const payload = message.data as any;
            const tradingMode = localStorage.getItem('tradingMode');
            
            console.log('[MANUAL_TRADE_EXPIRED] ✅ Обработка завершенной сделки', {
                payload,
                tradingMode,
            });
            
            const isDemoFromMessage = payload.isDemo === true || payload.is_demo === true;
            const isDemoFromLocalStorage = tradingMode === 'demo';
            
            const isDemoTrade = isDemoFromMessage || (isDemoFromLocalStorage && !isDemoFromMessage && payload.isDemo !== false && payload.is_demo !== false);

            if (isDemoTrade) {
                const tradeId = resolveTradeId(payload);
                const amount = Number(payload.amount ?? 0) || 0;
                // profit может быть отрицательным при проигрыше
                const profit = payload.profit !== undefined && payload.profit !== null ? Number(payload.profit) : 0;
                const nextBalanceRaw = Number(
                    payload.newBalance ??
                    (payload as any)?.demoBalance ??
                    (payload as any)?.balance
                );

                if (Number.isFinite(nextBalanceRaw)) {
                    dispatch(updateDemoBalance(nextBalanceRaw));
                    demoLog('manual_trade_expired demo path', {
                        tradeId,
                        amount,
                        profit,
                        nextBalance: nextBalanceRaw,
                        raw: payload,
                    });
                } else {

                }
            } else {
                if (tradingMode !== 'demo' && !isDemoTrade) {
                    if (payload.newBalance !== undefined) {
                        dispatch(updateBalance(payload.newBalance));
                    }
                    if (payload.newProfitBalance !== undefined) {
                        dispatch(updateProfitBalance(payload.newProfitBalance));
                    }

                } else {

                }
            }

            window.dispatchEvent(new CustomEvent('manual_trade_expired', {
                detail: {
                    ...payload,
                    success: true,
                    hasActiveTrades: (message.data as any)?.hasActiveTrades,
                }
            }));

            const tradeId = payload.tradeId || resolveTradeId(payload);
            if (tradeId) {
                // Удаляем активную сделку по tradeId
                // tradeId может быть в формате "trade_42_1762014684555" или просто "42"
                console.log('[MANUAL_TRADE_EXPIRED] 🗑️ Удаление активной сделки', {
                    tradeId,
                    payloadTradeId: payload.tradeId,
                    resolvedTradeId: resolveTradeId(payload),
                    payloadId: payload.id,
                });
                
                // Сначала пробуем удалить по полному tradeId
                dispatch(removeActiveTrade(tradeId));
                
                // Если tradeId в формате "trade_42_1762014684555", также пробуем удалить по числовому id "42"
                const match = String(tradeId).match(/^trade_(\d+)_/);
                if (match && match[1]) {
                    const numericId = match[1];
                    console.log('[MANUAL_TRADE_EXPIRED] 🔍 Попытка удаления по числовому ID', { numericId });
                    dispatch(removeActiveTrade(numericId));
                }
                
                // Также пробуем удалить по payload.id, если он отличается от tradeId
                if (payload.id && String(payload.id) !== String(tradeId)) {
                    console.log('[MANUAL_TRADE_EXPIRED] 🔍 Попытка удаления по payload.id', { payloadId: payload.id });
                    dispatch(removeActiveTrade(String(payload.id)));
                }
            } else {
                console.warn('[MANUAL_TRADE_EXPIRED] ⚠️ Не удалось извлечь tradeId из payload', { payload });
            }
        }
    });

    store.onMessage('active_manual_trades', (message: WebSocketMessage) => {
        if (isActiveManualTradesMessage(message) && message.success && message.data) {
            try {
                const trades: ActiveTrade[] = message.data.trades.map(trade => ({
                    id: trade.id,
                    price: trade.price,
                    direction: trade.direction,
                    amount: trade.amount,
                    expirationTime: trade.expirationTime,
                    entryPrice: trade.entryPrice,
                    currentPrice: trade.currentPrice,
                    currentPriceAtTrade: trade.currentPriceAtTrade,
                    createdAt: trade.createdAt,
                    symbol: trade.symbol || trade.pair,
                    baseCurrency: trade.baseCurrency || trade.base_currency,
                    quoteCurrency: trade.quoteCurrency || trade.quote_currency,
                    isDemo: trade.isDemo || trade.is_demo,
                    is_demo: trade.isDemo || trade.is_demo,
                    profitPercentage: trade.profitPercentage,
                    rigging: trade.rigging ? {
                        outcome: trade.rigging.outcome as 'win' | 'lose',
                        targetPrice: trade.rigging.targetPrice,
                        plan: trade.rigging.plan,
                    } : null,
                    is_copied: (trade as any).isCopied || (trade as any).is_copied || false,
                    copy_subscription_id: (trade as any).copySubscriptionId || (trade as any).copy_subscription_id || null,
                    copied_from_user_id: (trade as any).copiedFromUserId || (trade as any).copied_from_user_id || null,
                }));

                dispatch(setActiveTrades(trades));
            } catch (error) {

            }
        }
    });

    store.onMessage('manual_trade_price_updated', (message: WebSocketMessage) => {
        if (message.type === 'manual_trade_price_updated' && (message as ManualTradePriceUpdatedMessage).data) {
            try {
                const data = (message as ManualTradePriceUpdatedMessage).data;
                const tradeId = data.tradeId;
                const currentPrice = data.currentPrice;

                if (tradeId && currentPrice !== null && currentPrice !== undefined) {
                    dispatch(updateActiveTrade({
                        id: tradeId,
                        updates: { currentPrice },
                    }));
                }
            } catch (error) {

            }
        }
    });
};

// Presence and support chat events
// Keep simple console logging; UI can subscribe later
export const registerSupportAndPresenceHandlers = (store: WebSocketStore) => {
    store.onMessage('presence_update', (message: WebSocketMessage) => {
        // Presence update
    });
    store.onMessage('support_ticket_opened', (message: WebSocketMessage) => {
        // Support ticket opened
    });
    store.onMessage('support_message_sent', (message: WebSocketMessage) => {
        // Support message sent
    });
    store.onMessage('support_new_message', (message: WebSocketMessage) => {
        // Support new message
    });
    store.onMessage('support_ticket_closed', (message: WebSocketMessage) => {
        // Support ticket closed
    });
};