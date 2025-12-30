import { AppDispatch } from '@src/app/store';
import { websocketStore } from '@src/entities/websoket/websocket.store';
import { WebSocketMessage, TradeMessage, TradePlacedMessage, ManualTradeExpiredMessage } from '@src/entities/websoket/websocket-types';
import {
    setTradeHistory,
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
            createdAt: data.completedAt - 60000,
            completedAt: data.completedAt,
            symbol: data.symbol || null,
            baseCurrency: (data as any).baseCurrency || (data as any).base_currency || null,
            quoteCurrency: (data as any).quoteCurrency || (data as any).quote_currency || null,
            isDemo: data.isDemo || false,
            is_demo: data.isDemo || false,
            is_copied: (data as any).isCopied || (data as any).is_copied || false,
            copy_subscription_id: (data as any).copySubscriptionId || (data as any).copy_subscription_id || null,
            copied_from_user_id: (data as any).copiedFromUserId || (data as any).copied_from_user_id || null,
        };

        this.dispatch(addTradeHistory(historyEntry));
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
            
            const response = await apiClient<{ trades: TradeHistoryEntry[]; count: number }>(
                `/trading/history?${params.toString()}`
            );
            
            if (this.dispatch && response.trades) {
                this.dispatch(setTradeHistory(response.trades));
            }
        } catch (error) {
            console.error('[TRADE_HISTORY] HTTP ошибка запроса истории сделок:', error);
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
                    const createdAt = trade.createdAt;
                    if (!createdAt || !Number.isFinite(createdAt) || createdAt <= 0) {
                        console.warn('[TRADE_HISTORY] requestActiveTrades: невалидный createdAt в данных сервера', {
                            tradeId: trade.id,
                            createdAt: trade.createdAt,
                            trade: trade
                        });
                    }
                    return {
                        id: trade.id,
                        price: trade.price || trade.entryPrice,
                        direction: trade.direction,
                        amount: trade.amount,
                        expirationTime: trade.expirationTime,
                        entryPrice: trade.entryPrice || trade.price,
                        currentPrice: trade.currentPrice || null,
                        currentPriceAtTrade: trade.currentPriceAtTrade || trade.currentPrice || null,
                        createdAt: createdAt, // ВАЖНО: используем только данные с сервера
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

