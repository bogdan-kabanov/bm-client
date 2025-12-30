export interface User {
    id: number;
    telegram_id: string;
    ref_id?: string;
    is_trading: boolean;
    trading_banned: boolean;
    balance: number;
    balance_profit: number;
    coins: number;
    trading_duration?: string;
    trading_start_time?: number;
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    currency?: string;
    login?: string;
    email_verified?: boolean;
    show_withdrawal_popup: boolean;
    wallets?: string | { usdt?: string; btc?: string; ltc?: string; eth?: string };
    banned: boolean;
    ref_balance: number;
    ref_count: number;
    total_ref_earnings: number;
    custom_winrate_enabled?: boolean;
    custom_winrate_percent?: number | null;
    demo_balance?: number;
    createdAt?: string;
    updatedAt?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    ip_address?: string | null;
    is_islamic_halal?: boolean;
}

export interface ProfileState {
    user: User | null;
    loading: boolean;
    error: any;
}