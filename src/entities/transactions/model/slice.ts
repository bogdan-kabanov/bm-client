import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from "@src/shared/api";

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

const initialState: TransactionsState = {
    transactions: [],
    loading: false,
    error: null,
};

export const fetchTransactions = createAsyncThunk<
    Transaction[],
    void,
    { rejectValue: string }
>(
    'transactions/fetchTransactions',
    async (_, { rejectWithValue }) => {
        try {
            return await apiClient<Transaction[]>(`/trading/transactions`);
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const transactionsSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {
        appendTransaction: (state, action: PayloadAction<Transaction>) => {
            if (!state.transactions.some(tx => tx.id === action.payload.id)) {
                const MAX_TRANSACTIONS = 500;
                const newTransactions = [action.payload, ...state.transactions];
                state.transactions = newTransactions.slice(0, MAX_TRANSACTIONS);
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTransactions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTransactions.fulfilled, (state, action) => {
                state.loading = false;
                state.transactions = action.payload;
            })
            .addCase(fetchTransactions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            });
    },
});

export const { appendTransaction } = transactionsSlice.actions;
export const { reducer: transactionsReducer } = transactionsSlice;
