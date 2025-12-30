import {WithdrawalHistory} from "@src/entities/withdrawal/model/types.ts";
import { RiggingPayload } from '@src/shared/types/rigging';

export interface WebSocketForceStopTradingMessage extends WebSocketBaseMessage {
    type: 'force_stop_trading';
    userId: number;
}

export interface WebSocketTradingForceStoppedMessage extends WebSocketBaseMessage {
    type: 'trading_force_stopped';
    success: boolean;
    message: string;
    userData: WebSocketUserData;
}

export interface WebSocketBaseMessage {
    type: string;
    message?: string;
    protocol?: string;
    timestamp?: string;
    [key: string]: unknown;
}

export interface WebSocketUserData {
    id: number;
    user_id: number;
    balance: number;
    balance_profit: number;
    coins: number;
    is_trading: boolean;
    trading_duration?: string;
    trading_start_time?: number;
    banned: boolean;
    trading_banned: boolean;
}

export interface WebSocketWithdrawalCreatedMessage extends WebSocketBaseMessage {
    type: 'withdrawal_created';
    success: boolean;
    message: string;
    data: {
        balance: number;
        withdrawals: WithdrawalHistory[];
        withdrawal: WebSocketUserData;
        show_withdrawal_popup: boolean;
    };
}

export interface WebSocketCreateWithdrawalMessage extends WebSocketBaseMessage {
    type: 'create_withdrawal';
    userId: string;
    amount: number;
    wallet_address: string;
    wallet_type: string;
}

export interface WebSocketBalanceUpdatedMessage extends WebSocketBaseMessage {
    type: 'balance_updated';
    success: boolean;
    data: {
        balance: number;
        coins: number;
        timestamp: string;
    };
}

export interface WebSocketWithdrawalsUpdatedMessage extends WebSocketBaseMessage {
    type: 'withdrawals_updated';
    success: boolean;
    data: {
        withdrawals: WebSocketUserData[];
        timestamp: string;
    };
}

export interface WebSocketTransactionMessage extends WebSocketBaseMessage {
    type: 'transaction_executed';
    transaction: {
        id: number;
        amount: number;
        type: 'REPLENISHMENT' | 'LOSS';
        currencyPair: string;
        timestamp: number;
        newBalance: number;
        newProfit: number;
        completedSteps: number;
        totalSteps: number;
    };
    userData: WebSocketUserData;
}

export interface WebSocketTradingStartedMessage extends WebSocketBaseMessage {
    type: 'trading_started';
    success: boolean;
    message: string;
    data: {
        duration: string;
        initialBalance: number;
        targetProfit: number;
        totalSteps: number;
        startTime: number;
    };
}

export interface WebSocketTradingStoppedMessage extends WebSocketBaseMessage {
    type: 'trading_stopped';
    success: boolean;
    message: string;
    data: {
        finalBalance?: number;
        finalProfit?: number;
        totalProfit?: number;
    };
}

export interface WebSocketAuthMessage extends WebSocketBaseMessage {
    type: 'auth';
    userId: number;
    token?: string;
    clientId?: string;
    success?: boolean;
    message?: string;
}

export interface WebSocketStartTradingMessage extends WebSocketBaseMessage {
    type: 'start_trading';
    duration: string;
    // botId: number;
}

export interface WebSocketStopTradingMessage extends WebSocketBaseMessage {
    type: 'stop_trading';
}

export interface WebSocketStartTradingRequest extends WebSocketBaseMessage {
    type: 'start_trading';
    duration: string;
    // botId: number;
    userId: number;
    mode?: 'manual' | 'demo';
}

export interface WebSocketConnectedMessage extends WebSocketBaseMessage {
    type: 'connected';
    message: string;
    protocol: string;
    timestamp: string;
}

export interface WebSocketErrorMessage extends WebSocketBaseMessage {
    type: 'error' | 'trading_error';
    success: boolean;
    message: string;
}

export interface WebSocketSessionTerminatedMessage extends WebSocketBaseMessage {
    type: 'session_terminated';
    message: string;
}

export interface TradingUpdateMessage extends WebSocketBaseMessage {
    type: 'trading-update';
    data: {
        symbol: string;
        price: number;
        change: number;
        timestamp: number;
    };
}

export interface NotificationMessage extends WebSocketBaseMessage {
    type: 'notification';
    data: {
        id: string;
        title: string;
        message: string;
        level: 'info' | 'warning' | 'error' | 'success';
        timestamp: number;
    };
}

export interface TradeMessage extends WebSocketBaseMessage {
    type: 'place-trade';
    data: {
        symbol: string;
        amount: number;
        direction: 'buy' | 'sell';
        price?: number;
        expirationSeconds?: number;
        mode?: 'manual' | 'demo'; // Режим торговли
        timeframe?: string; // Таймфрейм (например, '1m', '5m')
        trade_timestamp?: number; // Unix timestamp времени сделки
    };
}

export interface TradePlacedMessage extends WebSocketBaseMessage {
    type: 'trade_placed';
    success: boolean;
    message: string;
    data: {
        tradeId: string;
        newBalance: number;
        newProfitBalance: number;
        expirationTime: number;
        isDemo?: boolean;
        amount?: number;
        direction?: 'buy' | 'sell';
        entryPrice?: number;
        currentPrice?: number;
        currentPriceAtTrade?: number;
        symbol?: string;
        baseCurrency?: string;
        base_currency?: string;
        quoteCurrency?: string;
        quote_currency?: string;
        rigging?: RiggingPayload | null;
        serverTime?: number;
        isCopied?: boolean;
        is_copied?: boolean;
        copySubscriptionId?: number | null;
        copy_subscription_id?: number | null;
        copiedFromUserId?: number | null;
        copied_from_user_id?: number | null;
    };
}

export interface SaveTradeResultMessage extends WebSocketBaseMessage {
    type: 'save-trade-result';
    data: {
        symbol: string;
        direction: 'buy' | 'sell';
        amount: number;
        entryPrice: number;
        exitPrice: number;
        profit: number;
        profitPercent: number;
        isWin: boolean;
        createdAt: number;
        completedAt: number;
    };
}

export interface GetTradeHistoryMessage extends WebSocketBaseMessage {
    type: 'get-trade-history';
    lastId?: number;
}

export interface TradeHistoryMessage extends WebSocketBaseMessage {
    type: 'trade_history';
    success: boolean;
    data: {
        trades: Array<{
            id: string;
            price: number;
            direction: 'buy' | 'sell';
            amount: number;
            entryPrice: number;
            exitPrice: number;
            profit: number;
            profitPercent: number;
            isWin: boolean;
            createdAt: number;
            completedAt: number;
            symbol?: string;
            pair?: string;
            baseCurrency?: string;
            base_currency?: string;
            quoteCurrency?: string;
            quote_currency?: string;
        }>;
        count: number;
    };
}

export interface TradeResultSavedMessage extends WebSocketBaseMessage {
    type: 'trade_result_saved';
    success: boolean;
    message: string;
}

export interface ManualTradeExpiredMessage extends WebSocketBaseMessage {
    type: 'manual_trade_expired';
    success: boolean;
    data: {
        tradeId: string;
        symbol: string;
        direction: 'buy' | 'sell';
        amount: number;
        entryPrice: number;
        exitPrice: number;
        profit: number;
        profitPercent: number;
        isWin: boolean;
        completedAt: number;
        isDemo?: boolean;
        newBalance?: number;
        newProfitBalance?: number;
        rigging?: RiggingPayload | null;
        hasActiveTrades?: boolean;
        isCopied?: boolean;
        is_copied?: boolean;
        copySubscriptionId?: number | null;
        copy_subscription_id?: number | null;
        copiedFromUserId?: number | null;
        copied_from_user_id?: number | null;
    };
}

export interface ManualTradePriceUpdatedMessage extends WebSocketBaseMessage {
    type: 'manual_trade_price_updated';
    data: {
        tradeId: string;
        currentPrice: number;
    };
}

export interface ActiveManualTradesMessage extends WebSocketBaseMessage {
    type: 'active_manual_trades';
    success: boolean;
    data: {
        trades: Array<{
            id: string;
            price: number;
            direction: 'buy' | 'sell';
            amount: number;
            expirationTime: number;
            entryPrice: number;
            currentPrice: number;
            currentPriceAtTrade?: number;
            createdAt: number;
            symbol?: string;
            pair?: string;
            baseCurrency?: string;
            base_currency?: string;
            quoteCurrency?: string;
            quote_currency?: string;
            isDemo?: boolean;
            is_demo?: boolean;
            rigging?: RiggingPayload | null;
            profitPercentage?: number;
        }>;
        serverTime?: number;
    };
}

// Добавлен новый тип сообщения для отправки сообщения в поддержку
export interface WebSocketSupportSendMessage extends WebSocketBaseMessage {
    type: 'support_send_message';
    ticketId: number;
    text: string;
}

// Новый тип сообщения для обновления статистики
export interface WebSocketStatsUpdateMessage extends WebSocketBaseMessage {
    type: 'stats_update';
    data: {
        totalEarned: number;
    };
}

// Типы сообщений для установки режима торговли
export interface WebSocketSetTradingModeMessage extends WebSocketBaseMessage {
    type: 'set-trading-mode';
    mode: 'automatic' | 'manual' | 'demo';
}

export interface WebSocketTradingModeSetMessage extends WebSocketBaseMessage {
    type: 'trading_mode_set';
    success: boolean;
    message: string;
    data?: {
        mode: 'automatic' | 'manual' | 'demo';
    };
}

export interface WebSocketSubscribeCustomQuotesMessage extends WebSocketBaseMessage {
    type: 'subscribe-custom-quotes';
    symbol: string;
}

export type WebSocketMessage =
    | WebSocketTransactionMessage
    | WebSocketTradingStartedMessage
    | WebSocketTradingStoppedMessage
    | WebSocketAuthMessage
    | WebSocketStartTradingMessage
    | WebSocketStopTradingMessage
    | WebSocketStartTradingRequest
    | SaveTradeResultMessage
    | GetTradeHistoryMessage
    | TradeHistoryMessage
    | TradeResultSavedMessage
    | ManualTradeExpiredMessage
    | ManualTradePriceUpdatedMessage
    | ActiveManualTradesMessage
    | WebSocketConnectedMessage
    | WebSocketErrorMessage
    | WebSocketSessionTerminatedMessage
    | WebSocketWithdrawalCreatedMessage
    | WebSocketBalanceUpdatedMessage
    | WebSocketWithdrawalsUpdatedMessage
    | TradingUpdateMessage
    | NotificationMessage
    | TradeMessage
    | TradePlacedMessage
    | WebSocketTradingForceStoppedMessage
    | WebSocketForceStopTradingMessage
    | WebSocketCreateWithdrawalMessage
    | WebSocketSupportSendMessage
    | WebSocketStatsUpdateMessage
    | WebSocketSetTradingModeMessage
    | WebSocketTradingModeSetMessage
    | WebSocketSubscribeCustomQuotesMessage;

export const isTradingForceStoppedMessage = (message: WebSocketMessage): message is WebSocketTradingForceStoppedMessage => {
    return message.type === 'trading_force_stopped';
};

export const isWithdrawalCreatedMessage = (message: WebSocketMessage): message is WebSocketWithdrawalCreatedMessage => {
    return message.type === 'withdrawal_created';
};

export const isCreateWithdrawalMessage = (message: WebSocketMessage): message is WebSocketCreateWithdrawalMessage => {
    return message.type === 'create_withdrawal';
};

export const isBalanceUpdatedMessage = (message: WebSocketMessage): message is WebSocketBalanceUpdatedMessage => {
    return message.type === 'balance_updated';
};

export const isWithdrawalsUpdatedMessage = (message: WebSocketMessage): message is WebSocketWithdrawalsUpdatedMessage => {
    return message.type === 'withdrawals_updated';
};

export const isTransactionMessage = (message: WebSocketMessage): message is WebSocketTransactionMessage => {
    return message.type === 'transaction_executed';
};

export const isTradingStartedMessage = (message: WebSocketMessage): message is WebSocketTradingStartedMessage => {
    return message.type === 'trading_started';
};

export const isTradingStoppedMessage = (message: WebSocketMessage): message is WebSocketTradingStoppedMessage => {
    return message.type === 'trading_stopped';
};

export const isAuthMessage = (message: WebSocketMessage): message is WebSocketAuthMessage => {
    return message.type === 'auth';
};

export const isConnectedMessage = (message: WebSocketMessage): message is WebSocketConnectedMessage => {
    return message.type === 'connected';
};

export const isErrorMessage = (message: WebSocketMessage): message is WebSocketErrorMessage => {
    return message.type === 'error' || message.type === 'trading_error';
};

export const isSessionTerminatedMessage = (message: WebSocketMessage): message is WebSocketSessionTerminatedMessage => {
    return message.type === 'session_terminated';
};

export const isTradingUpdateMessage = (message: WebSocketMessage): message is TradingUpdateMessage => {
    return message.type === 'trading-update';
};

export const isNotificationMessage = (message: WebSocketMessage): message is NotificationMessage => {
    return message.type === 'notification';
};

export const isTradeMessage = (message: WebSocketMessage): message is TradeMessage => {
    return message.type === 'place-trade';
};

// Добавлена функция проверки для нового типа сообщения
export const isSupportSendMessage = (message: WebSocketMessage): message is WebSocketSupportSendMessage => {
    return message.type === 'support_send_message';
};

export const isStatsUpdateMessage = (message: WebSocketMessage): message is WebSocketStatsUpdateMessage => {
    return message.type === 'stats_update';
};

export const isTradePlacedMessage = (message: WebSocketMessage): message is TradePlacedMessage => {
    return message.type === 'trade_placed';
};

export const isManualTradeExpiredMessage = (message: WebSocketMessage): message is ManualTradeExpiredMessage => {
    return message.type === 'manual_trade_expired';
};

export const isActiveManualTradesMessage = (message: WebSocketMessage): message is ActiveManualTradesMessage => {
    return message.type === 'active_manual_trades';
};

export interface WebSocketContextType {
    isConnected: boolean;
    error: string | null;
    sendMessage: (message: WebSocketMessage) => void;
    onMessage: (messageType: string, handler: (message: WebSocketMessage) => void) => () => void;
    authenticate: (userId: number) => void;
    disconnect: () => void;
}

export interface WebSocketProviderProps {
    url: string;
    children: React.ReactNode;
}