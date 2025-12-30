import {apiClient} from "@/src/shared/api";
import {createAsyncThunk, createSlice, PayloadAction} from "@reduxjs/toolkit";
import {Referral, ReferralStats} from "./types";

interface ReferralsState {
  referrals: Referral[];
  stats: ReferralStats | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReferralsState = {
  referrals: [],
  stats: null,
  loading: false,
  error: null,
};

export const fetchReferrals = createAsyncThunk(
  "referrals/fetchReferrals",
  async () => {
    return await apiClient<any>(`/users/referrals`);
  }
);

export const fetchReferralStats = createAsyncThunk(
  "referrals/fetchReferralStats",
  async (): Promise<ReferralStats> => {
    const response = await apiClient<ReferralStats>(`/users/ref-info`);

    return response;
  }
);

export const referralsSlice = createSlice({
  name: "referrals",
  initialState,
  reducers: {
    clearReferrals: (state) => {
      state.referrals = [];
      state.stats = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferrals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReferrals.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.referrals = action.payload || [];
      })
      .addCase(fetchReferrals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch referrals";
      })
      .addCase(fetchReferralStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReferralStats.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.stats = action.payload;
        })
      .addCase(fetchReferralStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch referral stats";
      });
  },
});

export const { clearReferrals } = referralsSlice.actions;
export default referralsSlice.reducer;