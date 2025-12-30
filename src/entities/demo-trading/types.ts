export type DemoBalanceUpdateDetail = {
    newBalance?: number | null;
    transactionType?: 'WITHDRAWAL' | 'REPLENISHMENT' | 'LOSS';
    amount?: number | null;
    profit?: number | null;
    tradeId?: string | number | null;
};

