import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CopyTradingSignalsState, CopySubscriptionItem } from './types';

const initialState: CopyTradingSignalsState = {
  isMenuOpen: false, // Deprecated: use isTopPartnersMenuOpen and isSubscriptionsMenuOpen
  isTopPartnersMenuOpen: false,
  isSubscriptionsMenuOpen: false,
  subscriptions: [],
  isLoading: false,
  error: null,
  success: null,
};

export const copyTradingSignalsSlice = createSlice({
  name: 'copyTradingSignals',
  initialState,
  reducers: {
    setMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isMenuOpen = action.payload;
      // For backward compatibility, also set both new states
      if (action.payload) {
        state.isTopPartnersMenuOpen = true;
        state.isSubscriptionsMenuOpen = true;
      } else {
        state.isTopPartnersMenuOpen = false;
        state.isSubscriptionsMenuOpen = false;
      }
    },
    setTopPartnersMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isTopPartnersMenuOpen = action.payload;
    },
    setSubscriptionsMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isSubscriptionsMenuOpen = action.payload;
    },
    setSubscriptions: (state, action: PayloadAction<CopySubscriptionItem[]>) => {
      state.subscriptions = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSuccess: (state, action: PayloadAction<string | null>) => {
      state.success = action.payload;
    },
    updateSubscription: (state, action: PayloadAction<CopySubscriptionItem>) => {
      const index = state.subscriptions.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.subscriptions[index] = action.payload;
      } else {
        state.subscriptions.push(action.payload);
      }
    },
    removeSubscription: (state, action: PayloadAction<number>) => {
      state.subscriptions = state.subscriptions.filter(s => s.id !== action.payload);
    },
    clearMessages: (state) => {
      state.error = null;
      state.success = null;
    },
  },
});

export const {
  setMenuOpen,
  setTopPartnersMenuOpen,
  setSubscriptionsMenuOpen,
  setSubscriptions,
  setLoading,
  setError,
  setSuccess,
  updateSubscription,
  removeSubscription,
  clearMessages,
} = copyTradingSignalsSlice.actions;

export const copyTradingSignalsReducer = copyTradingSignalsSlice.reducer;

