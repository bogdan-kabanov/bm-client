import { RootState } from '../../../app/store';

export const selectCurrentPair = (state: RootState) => state.currency.currentPair;
export const selectInterval = (state: RootState) => state.currency.interval;
export const selectAvailablePairs = (state: RootState) => state.currency.availablePairs;
export const selectCurrencyCategories = (state: RootState) => state.currency.categories;
export const selectCurrencyCategoriesLoading = (state: RootState) => state.currency.categoriesLoading;
export const selectCurrencyCategoriesError = (state: RootState) => state.currency.categoriesError;