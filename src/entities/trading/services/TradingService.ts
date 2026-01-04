import { AppDispatch } from '@src/app/store';
import { websocketStore } from '@src/entities/websoket/websocket.store';
import { WebSocketMessage, TradeMessage, TradePlacedMessage, ManualTradeExpiredMessage } from '@src/entities/websoket/websocket-types';
import {
    setTradeHistory,
    setNewTradesCount,
    addTradeHistory,
    setTradeMarkers,
    setCurrentPrice,
    setCurrentMarketPrice,
    setTradingMode,
    setActiveTrades,
} from '../model/slice';
import type { ActiveTrade, TradeMarker, TradeHistoryEntry } from '../model/types';
import { apiClient } from '@src/shared/api';
import { syncServerTimeFromWebSocket } from '@src/shared/lib/serverTime';

type ServerTimeCallback = () => number;

export class TradingService {
    private dispatch: AppDispatch | null = null;
    private getServerTime: ServerTimeCallback | null = null;
    private unsubscribeHandlers: Array<() => void> = [];
    private syncInterval: NodeJS.Timeout | null = null;
    private lastSyncTime: number = 0;
    private clientId: string;
    private isInitialized = false;

    constructor() {
        this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initialize(dispatch: AppDispatch, getServerTime?: ServerTimeCallback): void {
        if (this.isInitialized) {
            return;
        }

        this.dispatch = dispatch;
        this.getServerTime = getServerTime || (() => Date.now());
        this.isInitialized = true;

        this.registerWebSocketHandlers();
        this.startSyncInterval();
        this.requestTradeHistory();
    }

    private registerWebSocketHandlers(): void {
        const unsubscribe1 = websocketStore.onMessage('trade_placed', (message: WebSocketMessage) => {
            this.handleTradePlaced(message as TradePlacedMessage);
        });

        const unsubscribe2 = websocketStore.onMessage('manual_trade_expired', (message: WebSocketMessage) => {
            this.handleTradeExpired(message as ManualTradeExpiredMessage);
        });

        const unsubscribe3 = websocketStore.onMessage('manual_trade_price_updated', (message: WebSocketMessage) => {
            this.handlePriceUpdate(message as any);
        });

        const unsubscribe4 = websocketStore.onMessage('trading_mode_set', (message: WebSocketMessage) => {
            if ((message as any).success && (message as any).data?.mode) {
                this.dispatch?.(setTradingMode((message as any).data.mode));
            }
        });

        this.unsubscribeHandlers = [unsubscribe1, unsubscribe2, unsubscribe3, unsubscribe4];
    }

    private handleTradePlaced(message: TradePlacedMessage): void {
        if (!this.dispatch || !message.success || !message.data) {
            return;
        }

        const now = this.getServerTime?.() || Date.now();
        const data = message.data;

        const trade: ActiveTrade = {
            id: data.tradeId,
            price: data.entryPrice || data.currentPrice || 0,
            direction: data.direction || 'buy',
            amount: data.amount || 0,
            expirationTime: data.expirationTime || now + 60000,
            entryPrice: data.entryPrice || data.currentPrice || 0,
            currentPrice: data.currentPrice || null,
            currentPriceAtTrade: data.currentPriceAtTrade || data.currentPrice || null,
            createdAt: now,
            symbol: data.symbol || (data.baseCurrency && data.quoteCurrency ? `${data.baseCurrency}_${data.quoteCurrency}` : null),
            baseCurrency: data.baseCurrency || data.base_currency || null,
            quoteCurrency: data.quoteCurrency || data.quote_currency || null,
            isDemo: data.isDemo || false,
            is_demo: data.isDemo || false,
            profitPercentage: (data as any).profitPercentage || (data as any).profit_percentage || undefined,
            rigging: data.rigging || null,
            marker: this.createMarkerFromTrade(data, now),
            is_copied: data.isCopied || data.is_copied || false,
            copy_subscription_id: data.copySubscriptionId || data.copy_subscription_id || null,
            copied_from_user_id: data.copiedFromUserId || data.copied_from_user_id || null,
        };

    }

    private handleTradeExpired(message: ManualTradeExpiredMessage): void {
        if (!this.dispatch || !message.success || !message.data) {
            return;
        }

        const data = message.data;
        const tradeId = data.tradeId;

        // Убеждаемся, что completedAt всегда установлен
        let completedAt = data.completedAt;
        if (!completedAt || completedAt <= 0) {
            // Если completedAt не установлен, используем текущее время
            completedAt = Date.now();
        }

        const historyEntry: TradeHistoryEntry = {
            id: tradeId,
            price: data.entryPrice,
            direction: data.direction,
            amount: data.amount,
            entryPrice: data.entryPrice,
            exitPrice: data.exitPrice,
            profit: data.profit,
            profitPercent: data.profitPercent,
            isWin: data.isWin,
            createdAt: completedAt - 60000, // Используем completedAt для вычисления createdAt
            completedAt: completedAt,
            symbol: data.symbol || null,
            baseCurrency: (data as any).baseCurrency || (data as any).base_currency || null,
            quoteCurrency: (data as any).quoteCurrency || (data as any).quote_currency || null,
            isDemo: data.isDemo || false,
            is_demo: data.isDemo || false,
            is_copied: (data as any).isCopied || (data as any).is_copied || false,
            copy_subscription_id: (data as any).copySubscriptionId || (data as any).copy_subscription_id || null,
            copied_from_user_id: (data as any).copiedFromUserId || (data as any).copied_from_user_id || null,
        };

        console.log('[TradingService] ✅ Добавление завершенной сделки в историю', {
            tradeId,
            completedAt: historyEntry.completedAt,
            historyEntry,
        });

        this.dispatch(addTradeHistory(historyEntry));
        
        console.log('[TradingService] 📊 Сделка добавлена, счетчик должен увеличиться', {
            tradeId,
            completedAt: historyEntry.completedAt,
        });
    }

    private handlePriceUpdate(message: any): void {
        if (!this.dispatch || !message.data) {
            return;
        }

        const { tradeId, currentPrice } = message.data;

        // НЕ обновляем цену в Redux здесь - цена должна браться только из графика
        // Цена в Redux обновляется только при создании сделки из getPriceFromChart
        // Это гарантирует, что цена для сделок синхронизирована с ценой на графике
        if (currentPrice !== null && currentPrice !== undefined) {
            // Цена обновляется только из графика, не из WebSocket сообщений
        }
    }

    updatePriceForSymbol(symbol: string, currentPrice: number): void {
        if (!this.dispatch || !currentPrice || !symbol) {
            return;
        }

        // НЕ обновляем цену в Redux здесь - цена должна браться только из графика
        // Цена в Redux обновляется только при создании сделки из getPriceFromChart
        // Это гарантирует, что цена для сделок синхронизирована с ценой на графике
    }

    private createMarkerFromTrade(data: TradePlacedMessage['data'], timestamp: number): TradeMarker {
        // Для копированных сигналов ВСЕГДА используем currentPriceAtTrade (текущая цена на момент клика)
        // как при обычной ставке. Это централизованная система - все ставки используют текущую цену.
        const isCopied = data.isCopied || data.is_copied || false;
        
        // Для копированных сигналов используем ТОЛЬКО currentPriceAtTrade (текущая цена на момент клика)
        // Не используем entryPrice или currentPrice из сигнала, так как они могут быть устаревшими
        const markerPrice = isCopied 
            ? (data.currentPriceAtTrade || 0) // Только текущая цена на момент клика
            : (data.currentPriceAtTrade || data.entryPrice || data.currentPrice || 0);
        
        return {
            id: `marker_${data.tradeId}`,
            price: markerPrice,
            direction: data.direction || 'buy',
            timestamp: timestamp,
            amount: data.amount,
            expirationTime: data.expirationTime,
            isDemo: data.isDemo || false,
            status: 'active',
            currentPriceAtTrade: data.currentPriceAtTrade || data.currentPrice || null,
            tradeId: data.tradeId,
            symbol: data.symbol || (data.baseCurrency && data.quoteCurrency ? `${data.baseCurrency}_${data.quoteCurrency}` : null),
        };
    }

    placeTrade(params: {
        id: number;
        direction: 'buy' | 'sell';
        amount: number;
        expirationSeconds: number;
        mode?: 'manual' | 'demo';
        timeframe?: string;
    }): void {
        if (!websocketStore.isConnected) {

            return;
        }

        const now = Math.floor(this.getServerTime?.() || Date.now());
        const message: TradeMessage = {
            type: 'place-trade',
            data: {
                id: params.id,
                direction: params.direction,
                amount: params.amount,
                expirationSeconds: params.expirationSeconds,
                mode: params.mode || 'manual',
                timeframe: params.timeframe || '1m',
                trade_timestamp: now,
            },
        };

        websocketStore.sendMessage(message);
    }

    async requestTradeHistory(limit = 50, offset = 0, mode?: 'automatic' | 'manual' | 'demo'): Promise<void> {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (mode) {
                params.append('mode', mode);
            }
            
            const response = await apiClient<{ trades: any[]; count: number; newTradesCount?: number }>(
                `/trading/history?${params.toString()}`
            );
            
            const tradesData = response?.data?.trades || response?.trades;
            const newTradesCount = response?.data?.newTradesCount ?? response?.newTradesCount ?? 0;
            
            console.log('[TRADE_HISTORY] HTTP ответ от /trading/history:', {
                hasResponse: !!response,
                hasTrades: !!tradesData,
                tradesCount: tradesData?.length ?? 0,
                newTradesCount,
                mode,
                firstTrade: tradesData?.[0]
            });
            
            // Сохраняем счетчик новых сделок
            if (this.dispatch) {
                this.dispatch(setNewTradesCount(newTradesCount));
            }
            
            if (this.dispatch && tradesData && Array.isArray(tradesData)) {
                // Трансформируем данные для правильной обработки isDemo/is_demo
                const transformedTrades: TradeHistoryEntry[] = tradesData.map((trade: any) => {
                    const isDemo = trade.isDemo === true || trade.is_demo === true;
                    return {
                        id: String(trade.id ?? ''),
                        price: trade.price ?? trade.entryPrice ?? 0,
                        direction: trade.direction,
                        amount: trade.amount ?? 0,
                        entryPrice: trade.entryPrice ?? trade.price ?? 0,
                        exitPrice: trade.exitPrice ?? trade.price ?? 0,
                        profit: trade.profit ?? 0,
                        profitPercent: trade.profitPercent ?? trade.profit_percent ?? 0,
                        isWin: trade.isWin ?? trade.is_win ?? false,
                        createdAt: typeof trade.createdAt === 'number' 
                            ? trade.createdAt 
                            : (trade.created_at ? (typeof trade.created_at === 'number' ? trade.created_at : new Date(trade.created_at).getTime()) : Date.now()),
                        completedAt: typeof trade.completedAt === 'number' && trade.completedAt > 0
                            ? trade.completedAt
                            : (trade.completed_at ? (typeof trade.completed_at === 'number' && trade.completed_at > 0 ? trade.completed_at : (trade.completed_at ? new Date(trade.completed_at).getTime() : null)) : null),
                        expirationTime: typeof trade.expirationTime === 'number'
                            ? trade.expirationTime
                            : (trade.expiration_time ? (typeof trade.expiration_time === 'number' ? trade.expiration_time : new Date(trade.expiration_time).getTime()) : null),
                        symbol: trade.symbol ?? trade.pair ?? null,
                        baseCurrency: trade.baseCurrency ?? trade.base_currency ?? null,
                        quoteCurrency: trade.quoteCurrency ?? trade.quote_currency ?? null,
                        isDemo: isDemo,
                        is_demo: trade.is_demo ?? isDemo,
                        is_copied: trade.is_copied ?? trade.isCopied ?? false,
                        copy_subscription_id: trade.copy_subscription_id ?? trade.copySubscriptionId ?? null,
                        copied_from_user_id: trade.copied_from_user_id ?? trade.copiedFromUserId ?? null,
                    };
                });
                
                // Сортируем по completedAt в порядке убывания
                const sortedTrades = transformedTrades.sort((a, b) => b.completedAt - a.completedAt);
                
                console.log('[TRADE_HISTORY] Трансформированные сделки:', {
                    count: sortedTrades.length,
                    firstTrade: sortedTrades[0],
                    allHaveIsDemo: sortedTrades.every(t => t.isDemo !== undefined || t.is_demo !== undefined)
                });
                
                this.dispatch(setTradeHistory(sortedTrades));
            } else {
                console.warn('[TRADE_HISTORY] Нет данных для обновления Redux:', {
                    hasDispatch: !!this.dispatch,
                    hasResponse: !!response,
                    hasTrades: !!response?.trades,
                    isArray: Array.isArray(response?.trades)
                });
                if (this.dispatch) {
                    this.dispatch(setTradeHistory([]));
                }
            }
        } catch (error) {
            console.error('[TRADE_HISTORY] HTTP ошибка запроса истории сделок:', error);
            if (this.dispatch) {
                this.dispatch(setTradeHistory([]));
            }
        }
    }

    async requestActiveTrades(mode?: 'automatic' | 'manual' | 'demo'): Promise<ActiveTrade[]> {
        try {
            const params = new URLSearchParams();
            if (mode) {
                params.append('mode', mode);
            }
            
            const response = await apiClient<{ trades: any[]; serverTime: number }>(
                `/trading/active-trades?${params.toString()}`
            );
            
            // Используем serverTime из HTTP ответа для установки серверного времени
            if (response.serverTime && typeof response.serverTime === 'number' && response.serverTime > 0) {
                syncServerTimeFromWebSocket(response.serverTime);
            }
            
            if (response.trades && Array.isArray(response.trades)) {
                const activeTrades: ActiveTrade[] = response.trades.map((trade: any) => {
                    // Безопасная обработка createdAt
                    let created_at: number;
                    if (typeof trade.createdAt === 'number' && Number.isFinite(trade.createdAt) && trade.createdAt > 0) {
                        created_at = trade.createdAt;
                    } else {
                        console.warn('[TRADE_HISTORY] requestActiveTrades: невалидный createdAt в данных сервера, используем fallback', {
                            tradeId: trade.id,
                            createdAt: trade.createdAt,
                            trade: trade
                        });
                        created_at = Date.now(); // fallback: текущее время
                    }

                    // Безопасная обработка expirationTime
                    let expiration_time: number;
                    if (typeof trade.expirationTime === 'number' && Number.isFinite(trade.expirationTime) && trade.expirationTime > 0) {
                        expiration_time = trade.expirationTime;
                    } else {
                        console.warn('[TRADE_HISTORY] requestActiveTrades: невалидный expirationTime в данных сервера, используем fallback', {
                            tradeId: trade.id,
                            expirationTime: trade.expirationTime,
                            trade: trade
                        });
                        expiration_time = created_at + 30000; // fallback: +30 секунд от createdAt
                    }

                    return {
                        id: trade.id,
                        price: trade.price || trade.entryPrice,
                        direction: trade.direction,
                        amount: trade.amount,
                        expirationTime: expiration_time,
                        entryPrice: trade.entryPrice || trade.price,
                        currentPrice: trade.currentPrice || null,
                        currentPriceAtTrade: trade.currentPriceAtTrade || trade.currentPrice || null,
                        createdAt: created_at,
                        symbol: trade.symbol || trade.pair || null,
                        baseCurrency: trade.baseCurrency || trade.base_currency || null,
                        quoteCurrency: trade.quoteCurrency || trade.quote_currency || null,
                        isDemo: trade.isDemo || trade.is_demo || false,
                        is_demo: trade.is_demo || trade.isDemo || false,
                        profitPercentage: trade.profitPercentage || undefined,
                    };
                });
                
                // Не обновляем Redux здесь - пусть компонент сам обновляет через dispatch
                // Это более гибко, так как tradingService может быть не инициализирован с dispatch
                
                return activeTrades;
            }
            
            return [];
        } catch (error) {
            console.error('[TRADE_HISTORY] HTTP ошибка запроса активных сделок:', error);
            return [];
        }
    }

    private startSyncInterval(): void {
    }

    cleanup(): void {
        this.unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
        this.unsubscribeHandlers = [];

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        this.isInitialized = false;
        this.dispatch = null;
        this.getServerTime = null;
    }

    getClientId(): string {
        return this.clientId;
    }

    getDispatch(): AppDispatch | null {
        return this.dispatch;
    }
}

export const tradingService = new TradingService();

