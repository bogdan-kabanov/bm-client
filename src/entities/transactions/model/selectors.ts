import { RootState } from '../../../app/store';

export const selectTransactions = (state: RootState) => state.transactions.transactions;
export const selectTransactionsLoading = (state: RootState) => state.transactions.loading;
export const selectTransactionsError = (state: RootState) => state.transactions.error;