import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { CurrencyState } from './types';
import { CURRENCY_PAIRS, DEFAULT_INTERVAL } from '../lib/constants.ts';
import { currencyApi } from '@src/shared/api/currency/currencyApi';
import type { CurrencyCategory } from '@src/shared/api/currency/types';

const initialState: CurrencyState = {
    currentPair: CURRENCY_PAIRS[0],
    availablePairs: CURRENCY_PAIRS,
    interval: DEFAULT_INTERVAL,
    categories: [],
    categoriesLoading: false,
    categoriesError: null,
};

// Async thunk для загрузки категорий и валют
export const fetchCurrencyCategories = createAsyncThunk<
    { categories: CurrencyCategory[] },
    void,
    { rejectValue: string; state: { currency: CurrencyState } }
>(
    'currency/fetchCategories',
    async (_, { rejectWithValue }) => {
        try {
            const currencyResponse = await currencyApi.getCurrenciesGrouped();

            const categories: CurrencyCategory[] = Array.isArray(currencyResponse) ? currencyResponse : [];
            
            if (!Array.isArray(currencyResponse)) {
                console.warn('[currency/fetchCategories] Неожиданный формат ответа от API (ожидался массив):', {
                    response: currencyResponse,
                    type: typeof currencyResponse,
                    isArray: Array.isArray(currencyResponse)
                });
            }

            // Фильтруем только активные категории и валюты
            const filteredCategories: CurrencyCategory[] = categories
                .filter(cat => cat.is_active && cat.currencies && cat.currencies.length > 0)
                .map(cat => ({
                    ...cat,
                    currencies: cat.currencies?.filter(curr => curr.is_active) || []
                }))
                .filter(cat => cat.currencies && cat.currencies.length > 0);

            return {
                categories: filteredCategories,
            };
        } catch (error) {
            console.error('[currency/fetchCategories] Ошибка загрузки:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState();
            // Не запускаем запрос, если он уже выполняется
            if (state.currency.categoriesLoading) {
                return false;
            }
            // Если данные уже есть, не загружаем повторно
            if (state.currency.categories.length > 0) {
                return false;
            }
            // Если была ошибка, позволяем повторить запрос (убрано ограничение для повторных попыток)
            return true;
        },
    }
);

export const currencySlice = createSlice({
    name: 'currency',
    initialState,
    reducers: {
        setNextPair: (state) => {
            const currentIndex = state.availablePairs.indexOf(state.currentPair);
            const nextIndex = (currentIndex + 1) % state.availablePairs.length;
            state.currentPair = state.availablePairs[nextIndex];
        },
        setPair: (state, action) => {
            state.currentPair = action.payload;
        },
        setInterval: (state, action) => {
            state.interval = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCurrencyCategories.pending, (state) => {
                state.categoriesLoading = true;
                state.categoriesError = null;
            })
            .addCase(fetchCurrencyCategories.fulfilled, (state, action) => {
                state.categoriesLoading = false;
                state.categories = action.payload.categories;
                state.categoriesError = null;
            })
            .addCase(fetchCurrencyCategories.rejected, (state, action) => {
                state.categoriesLoading = false;
                state.categoriesError = action.payload || 'Unknown error';
            });
    },
});

export const { setNextPair, setPair, setInterval } = currencySlice.actions;