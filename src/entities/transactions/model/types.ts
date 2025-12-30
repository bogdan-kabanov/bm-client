export interface Transaction {
    id: number;
    telegram_id: string;
    bot_id: number;
    amount: number;
    type: 'REPLENISHMENT' | 'LOSS';
    currency_pair: string;
    createdAt: string;
}

export interface TransactionsState {
    transactions: Transaction[];
    loading: boolean;
    error: string | null;
}