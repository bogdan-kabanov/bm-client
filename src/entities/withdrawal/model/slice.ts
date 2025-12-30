import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import { apiClient } from '@src/shared/api';
import { WithdrawalHistory, WithdrawalData } from "@src/entities/withdrawal/model/types.ts";

interface WithdrawalState {
    history: WithdrawalHistory[];
    loading: boolean;
    error: string | null;
}

const initialState: WithdrawalState = {
    history: [],
    loading: false,
    error: null,
};

export const fetchWithdrawalHistory = createAsyncThunk<
    WithdrawalHistory[],
    void,
    { rejectValue: string }
>(
    'withdrawal/fetchHistory',
    async (_, { rejectWithValue }) => {
        try {
            return await apiClient<WithdrawalHistory[]>(`/withdrawals/user`);
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const createWithdrawal = createAsyncThunk<
    { data: WithdrawalHistory; balance: number; show_withdrawal_popup: boolean },
    WithdrawalData,
    { rejectValue: string }
>(
    'withdrawal/create',
    async (withdrawalData, { rejectWithValue }) => {
        try {
            const response = await apiClient<{ data: WithdrawalHistory; balance: number; show_withdrawal_popup: boolean }>(`/withdrawals`, {
                method: 'POST',
                body: withdrawalData,
            });
            return response;
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const withdrawalSlice = createSlice({
    name: 'withdrawal',
    initialState,
    reducers: {
        setWithdrawalHistory: (state, action: PayloadAction<WithdrawalHistory[]>) => {
            state.history = action.payload;
        },
        clearWithdrawalHistory: (state) => {
            state.history = [];
            state.loading = false;
            state.error = null;
        },
        setWithdrawalError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch history
            .addCase(fetchWithdrawalHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWithdrawalHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.history = action.payload;
            })
            .addCase(fetchWithdrawalHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
            .addCase(createWithdrawal.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createWithdrawal.fulfilled, (state, action) => {
                state.loading = false;
                state.history.unshift(action.payload.data);
            })
            .addCase(createWithdrawal.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            });
    },
});

export const { clearWithdrawalHistory, setWithdrawalError, setWithdrawalHistory } = withdrawalSlice.actions;
export const { reducer: withdrawalReducer } = withdrawalSlice;