import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiClient } from "@/src/shared/api";
import { ConfigState, WalletConfig } from "./types";

const initialState: ConfigState = {
  wallets: [],
  min_withdrawal: 200,
  min_trade_balance: 50,
  trading_limited: 8000,
  loading: false,
  error: null,
};

export interface ConfigResponse {
  min_withdrawal: number;
  min_trade_balance: number;
  trading_limited: number;
  wallets: string;
}

export const fetchConfig = createAsyncThunk(
    "config/fetchConfig",
    async (): Promise<ConfigResponse> => {
      try {
        const apiResponse = await apiClient<{ success: boolean; data: ConfigResponse }>("/config");

        if (!apiResponse || !apiResponse.success) {
          throw new Error('Invalid response format from /config');
        }
        return apiResponse.data;
      } catch (error) {

        throw error;
      }
    }
);

export const fetchWallets = createAsyncThunk(
    "config/fetchWallets",
    async (): Promise<WalletConfig[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: WalletConfig[] } | WalletConfig[]>("/config/wallets");

        let wallets: WalletConfig[];
        
        if (Array.isArray(response)) {
          wallets = response;
        } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
          wallets = response.data;
        } else if (response && typeof response === 'object' && 'success' in response && response.success && 'data' in response && Array.isArray(response.data)) {
          wallets = response.data;
        } else {

          wallets = [];
        }

        return wallets;
      } catch (error) {

        throw new Error(`Не удалось загрузить кошельки: ${error}`);
      }
    }
);

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    clearConfig: (state) => {
      state.wallets = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
        .addCase(fetchConfig.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchConfig.fulfilled, (state, action) => {
          state.loading = false;
          state.min_withdrawal = action.payload.min_withdrawal;
          state.min_trade_balance = action.payload.min_trade_balance;
          state.trading_limited = action.payload.trading_limited;
        })
        .addCase(fetchConfig.rejected, (state, action) => {
          state.loading = false;
          state.error = action.error.message || "Failed to load configuration";
        })
        .addCase(fetchWallets.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchWallets.fulfilled, (state, action) => {
          state.loading = false;
          state.wallets = Array.isArray(action.payload) ? action.payload : [];
        })
        .addCase(fetchWallets.rejected, (state, action) => {
          state.loading = false;
          state.error = action.error.message || "Failed to load wallets";
        });
  },
});

export const { clearConfig } = configSlice.actions;
export default configSlice.reducer;