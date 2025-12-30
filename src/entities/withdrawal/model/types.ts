export type CurrencyType = 'usdt' | 'btc' | 'eth' | 'ltc';

export interface WithdrawalData {
    amount: number;
    wallet_address: string;
    wallet_type: CurrencyType;
}

export interface CreateWithdrawalResponse {
    data: WithdrawalHistory;
    balance: number;
    show_withdrawal_popup: boolean;
}

export interface WithdrawalHistory {
    id: number;
    user_id: number;
    amount: number;
    commission: number;
    total_amount: number;
    wallet_address: string;
    wallet_type: string;
    status: 'pending_fee' | 'processing' | 'completed' | 'cancelled';
    transaction_hash: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface WithdrawalRequest {
    amount: number;
    wallet_address: string;
    wallet_type: "usdt" | "btc" | "ltc" | "eth";
}

export interface WithdrawalState {
    history: WithdrawalHistory[];
    loading: boolean;
    error: string | null;
}

export interface WithdrawalData {
    amount: number;
    wallet_address: string;
    wallet_type: 'usdt' | 'btc' | 'ltc' | 'eth';
}