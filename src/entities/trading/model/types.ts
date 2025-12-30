export interface TradingDuration {
    id: number;
    duration: string;
    seconds: number;
    default_percentage: number;
    coin_cost: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ActiveTrade {
    id: string;
    price: number;
    direction: 'buy' | 'sell';
    amount: number;
    expirationTime: number;
    entryPrice: number;
    currentPrice: number | null;
    currentPriceAtTrade?: number;
    createdAt: number;
    symbol?: string | null;
    baseCurrency?: string | null;
    quoteCurrency?: string | null;
    isDemo?: boolean;
    is_demo?: boolean;
    profitPercentage?: number;
    rigging?: {
        outcome: 'win' | 'lose';
        targetPrice: number;
        plan?: any;
    } | null;
    marker?: TradeMarker;
    is_copied?: boolean;
    copy_subscription_id?: number | null;
    copied_from_user_id?: number | null;
}

export interface TradeHistoryEntry {
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
    symbol?: string | null;
    baseCurrency?: string | null;
    quoteCurrency?: string | null;
    isDemo?: boolean;
    is_demo?: boolean;
    is_copied?: boolean;
    copy_subscription_id?: number | null;
    copied_from_user_id?: number | null;
}

export interface TradeMarker {
    id: string;
    price: number;
    direction: 'buy' | 'sell';
    timestamp: number;
    amount?: number;
    expirationTime?: number;
    isDemo?: boolean;
    status?: 'active' | 'win' | 'loss';
    pulseStartTime?: number;
    currentPriceAtTrade?: number;
    tradeId?: string | number;
    symbol?: string;
}

export interface TradingPrices {
    currentPrice: number | null;
    currentMarketPrice: number | null;
    price1: number | null;
    price2: number | null;
    priceDiff: number;
    priceDiffPercent: number;
    spreadPercent: number;
}

export interface TradingTerminalUI {
    showBaseCurrencyMenu: boolean;
    showExchangesMenu: boolean;
    showDurationMenu: boolean;
    hoveredButton: 'buy' | 'sell' | null;
}

export interface TradingFormState {
    manualTradeAmount: string;
    expirationSeconds: string;
    spreadPercent: number;
}

export interface TradingState {
    durations: TradingDuration[];
    loading: boolean;
    error: string | null;
    prices: TradingPrices;
    tradeHistory: TradeHistoryEntry[];
    tradeMarkers: TradeMarker[];
    activeTrades: ActiveTrade[];
    selectedBase: string;
    quoteCurrency: string;
    tradingMode: 'manual' | 'demo';
    ui: TradingTerminalUI;
    form: TradingFormState;
}