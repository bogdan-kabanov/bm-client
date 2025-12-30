export interface BotConfig {
    tradingPair: string;
    riskLevel: string;
    maxTradeAmount: number;
}

export interface Bot {
    id: string;
    name: string;
    status: 'ACTIVATED' | 'DEACTIVATED' | 'error';
    profit: number;
    trades: number;
    successRate: number;
    description: string;
    isEnabled: boolean;
    config?: BotConfig;
}

export interface BotState {
    bots: Bot[];
    loading: boolean;
    error: string | null;
    currentBot: string;
    availableBots: readonly string[];
    status: string;
}