import { RootState } from '../../../app/store';
import { createSelector } from '@reduxjs/toolkit';

export const selectTradingDurations = (state: RootState) => state.trading.durations;
export const selectTradingDurationsLoading = (state: RootState) => state.trading.loading;
export const selectTradingDurationsError = (state: RootState) => state.trading.error;

// Цены
export const selectTradingPrices = (state: RootState) => state.trading.prices;
export const selectCurrentPrice = (state: RootState) => state.trading.prices.currentPrice;
export const selectCurrentMarketPrice = (state: RootState) => state.trading.prices.currentMarketPrice;
export const selectPrice1 = (state: RootState) => state.trading.prices.price1;
export const selectPrice2 = (state: RootState) => state.trading.prices.price2;
export const selectPriceDiff = (state: RootState) => state.trading.prices.priceDiff;
export const selectPriceDiffPercent = (state: RootState) => state.trading.prices.priceDiffPercent;
export const selectSpreadPercent = (state: RootState) => state.trading.prices.spreadPercent;

// История сделок
export const selectTradeHistory = (state: RootState) => state.trading.tradeHistory;
export const selectTradeHistoryByMode = createSelector(
    [selectTradeHistory, (state: RootState) => state.trading.tradingMode],
    (history, mode) => {
        const filtered = history.filter(t => {
            const isDemo = t.isDemo || t.is_demo;
            if (mode === 'demo') return isDemo;
            if (mode === 'manual') return !isDemo;
            return false;
        });
        return filtered;
    }
);

// Маркеры
export const selectTradeMarkers = (state: RootState) => state.trading.tradeMarkers;
export const selectTradeMarkerById = (state: RootState, markerId: string) =>
    state.trading.tradeMarkers.find(m => m.id === markerId);
export const selectTradeMarkerByTradeId = (state: RootState, tradeId: string) =>
    state.trading.tradeMarkers.find(m => m.tradeId === tradeId || m.id === `marker_${tradeId}`);

// Активные сделки
export const selectActiveTrades = (state: RootState) => state.trading.activeTrades;
export const selectActiveTradesByMode = createSelector(
    [selectActiveTrades, (state: RootState) => state.trading.tradingMode],
    (trades, mode) => trades.filter(t => {
        const isDemo = t.isDemo || t.is_demo;
        if (mode === 'demo') return isDemo;
        if (mode === 'manual') return !isDemo;
        return false;
    })
);
export const selectActiveTradeById = (state: RootState, tradeId: string) =>
    state.trading.activeTrades.find(t => t.id === tradeId);

// Метаданные
export const selectSelectedBase = (state: RootState) => state.trading.selectedBase;
export const selectQuoteCurrency = (state: RootState) => state.trading.quoteCurrency;
export const selectTradingMode = (state: RootState) => state.trading.tradingMode;

export const selectMarkerPrice = (state: RootState, tradeId: string): number | null => {
    const marker = selectTradeMarkerByTradeId(state, tradeId);
    if (marker && state.trading.prices.currentMarketPrice !== null) {
        return state.trading.prices.currentMarketPrice;
    }
    return state.trading.prices.currentMarketPrice;
};

export const selectTradingUI = (state: RootState) => state.trading.ui;
export const selectTradingForm = (state: RootState) => state.trading.form;
export const selectManualTradeAmount = (state: RootState) => state.trading.form.manualTradeAmount;
export const selectExpirationSeconds = (state: RootState) => state.trading.form.expirationSeconds;
export const selectHoveredButton = (state: RootState) => state.trading.ui.hoveredButton;