import { RootState } from "@src/app/store";

export const selectWallets = (state: RootState) => state.config.wallets;
export const selectWalletByCurrency = (currency: string) => (state: RootState) =>
    state.config.wallets.find(w => w.currency.toLowerCase() === currency.toLowerCase());
export const selectConfigLoading = (state: RootState) => state.config.loading;
export const selectConfigError = (state: RootState) => state.config.error;
export const selectMinWithdrawal = (state: RootState) => state.config.min_withdrawal;
export const selectMinTradeBalance = (state: RootState) => state.config.min_trade_balance;