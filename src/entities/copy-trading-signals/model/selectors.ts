import { RootState } from '@src/app/store';

export const selectCopyTradingSignalsMenuOpen = (state: RootState) => 
  state.copyTradingSignals.isMenuOpen;

export const selectCopyTradingSubscriptions = (state: RootState) => 
  state.copyTradingSignals.subscriptions;

export const selectCopyTradingLoading = (state: RootState) => 
  state.copyTradingSignals.isLoading;

export const selectCopyTradingError = (state: RootState) => 
  state.copyTradingSignals.error;

export const selectCopyTradingSuccess = (state: RootState) => 
  state.copyTradingSignals.success;

export const selectActiveCopyTradingSubscriptions = (state: RootState) => 
  state.copyTradingSignals.subscriptions.filter(s => s.isActive);

export const selectActiveCopyTradingCount = (state: RootState) => 
  state.copyTradingSignals.subscriptions.filter(s => s.isActive).length;

