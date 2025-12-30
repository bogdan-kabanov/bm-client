import { RootState } from '../../../app/store';
import {WithdrawalHistory} from "@src/entities/withdrawal/model/types.ts";

export const selectWithdrawalHistory = (state: RootState) => state.withdrawal.history;
export const selectWithdrawalLoading = (state: RootState) => state.withdrawal.loading;
export const selectWithdrawalError = (state: RootState) => state.withdrawal.error;
export const selectWithdrawalTotal = (state: RootState) =>
    state.withdrawal.history.reduce((total: number, item: WithdrawalHistory) => total + item.amount, 0);