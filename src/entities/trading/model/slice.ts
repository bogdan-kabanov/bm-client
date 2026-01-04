import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '@src/shared/api';
import { TradingDuration, TradingState, ActiveTrade, TradeHistoryEntry, TradeMarker, TradingPrices } from './types';

const initialState: TradingState = {
    durations: [],
    loading: false,
    error: null,
    prices: {
        currentPrice: null,
        currentMarketPrice: null,
        price1: null,
        price2: null,
        priceDiff: 0,
        priceDiffPercent: 0,
        spreadPercent: 0.11,
    },
    tradeHistory: [],
    tradeMarkers: [],
    activeTrades: [],
    selectedBase: typeof window !== 'undefined' ? localStorage.getItem('selectedBaseCurrency') || 'BTC' : 'BTC', // Только для отображения
    selectedCurrencyId: typeof window !== 'undefined' ? (() => {
        const stored = localStorage.getItem('selectedCurrencyId');
        return stored ? parseInt(stored, 10) : null;
    })() : null, // Основной идентификатор
    quoteCurrency: 'USDT',
    tradingMode: 'manual',
    ui: {
        showBaseCurrencyMenu: false,
        showExchangesMenu: false,
        showDurationMenu: false,
        hoveredButton: null,
    },
    form: {
        manualTradeAmount: '1.00',
        expirationSeconds: '30',
        spreadPercent: 0.11,
    },
    newTradesCount: 0,
};


export const fetchTradingDurations = createAsyncThunk<
    TradingDuration[],
    void,
    { rejectValue: string }
>(
    'trading/fetchDurations',
    async (_, { rejectWithValue }) => {
        try {
            return await apiClient<TradingDuration[]>('/trading/durations');
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const tradingSlice = createSlice({
    name: 'trading',
    initialState,
    reducers: {
        clearTradingError: (state) => {
            state.error = null;
        },
        // Цены
        setCurrentPrice: (state, action: PayloadAction<number | null>) => {
            state.prices.currentPrice = action.payload;
        },
        setCurrentMarketPrice: (state, action: PayloadAction<number | null>) => {
            state.prices.currentMarketPrice = action.payload;
        },
        setPrices: (state, action: PayloadAction<Partial<TradingPrices>>) => {
            state.prices = { ...state.prices, ...action.payload };
        },
        // История сделок
        setTradeHistory: (state, action: PayloadAction<TradeHistoryEntry[]>) => {
            state.tradeHistory = action.payload;
        },
        setNewTradesCount: (state, action: PayloadAction<number>) => {
            const oldCount = state.newTradesCount;
            state.newTradesCount = action.payload;
            console.log('[TRADE_SLICE] 🔄 setNewTradesCount вызван:', {
                oldCount,
                newCount: action.payload,
                timestamp: Date.now(),
                stackTrace: new Error().stack,
            });
        },
        addTradeHistory: (state, action: PayloadAction<TradeHistoryEntry>) => {
            const MAX_TRADE_HISTORY = 500;
            const oldCount = state.newTradesCount || 0;
            const oldHistoryLength = state.tradeHistory.length;
            
            console.log('[TRADE_SLICE] 📥 addTradeHistory вызван:', {
                tradeId: action.payload.id,
                completedAt: action.payload.completedAt,
                oldCount,
                oldHistoryLength,
                timestamp: Date.now(),
            });
            
            const newHistory = [action.payload, ...state.tradeHistory];
            state.tradeHistory = newHistory.slice(0, MAX_TRADE_HISTORY);
            
            // Увеличиваем счетчик новых сделок при добавлении завершенной сделки
            // Если completedAt установлен и является валидным числом, увеличиваем счетчик
            // Если completedAt не установлен, все равно увеличиваем счетчик (на случай, если это завершенная сделка)
            const hasValidCompletedAt = action.payload.completedAt !== null && 
                action.payload.completedAt !== undefined && 
                typeof action.payload.completedAt === 'number' && 
                action.payload.completedAt > 0;
            
            // Увеличиваем счетчик всегда при добавлении сделки в историю
            // Это гарантирует, что счетчик обновится сразу после завершения сделки
            const previousCount = state.newTradesCount || 0;
            state.newTradesCount = previousCount + 1;
            
            console.log('[TRADE_SLICE] ✅ Счетчик новых сделок увеличен:', {
                previousCount,
                newCount: state.newTradesCount,
                tradeId: action.payload.id,
                completedAt: action.payload.completedAt,
                hasValidCompletedAt,
                newHistoryLength: state.tradeHistory.length,
                timestamp: Date.now(),
            });
        },
        // Маркеры
        setTradeMarkers: (state, action: PayloadAction<TradeMarker[]>) => {
            state.tradeMarkers = action.payload;
        },
        addTradeMarker: (state, action: PayloadAction<TradeMarker>) => {
            const existingIndex = state.tradeMarkers.findIndex(m => m.id === action.payload.id);
            if (existingIndex !== -1) {
                state.tradeMarkers[existingIndex] = action.payload;
            } else {
                const MAX_TRADE_MARKERS = 1000;
                state.tradeMarkers.push(action.payload);
                if (state.tradeMarkers.length > MAX_TRADE_MARKERS) {
                    state.tradeMarkers = state.tradeMarkers.slice(-MAX_TRADE_MARKERS);
                }
            }
        },
        updateTradeMarker: (state, action: PayloadAction<{ id: string; updates: Partial<TradeMarker> }>) => {
            const index = state.tradeMarkers.findIndex(m => m.id === action.payload.id);
            if (index !== -1) {
                state.tradeMarkers[index] = { ...state.tradeMarkers[index], ...action.payload.updates };
            }
        },
        removeTradeMarker: (state, action: PayloadAction<string>) => {
            state.tradeMarkers = state.tradeMarkers.filter(m => m.id !== action.payload);
        },
        // Активные сделки
        setActiveTrades: (state, action: PayloadAction<ActiveTrade[]>) => {
            state.activeTrades = action.payload;
        },
        addActiveTrade: (state, action: PayloadAction<ActiveTrade>) => {
            const existingIndex = state.activeTrades.findIndex(t => t.id === action.payload.id);
            if (existingIndex === -1) {
                const MAX_ACTIVE_TRADES = 500;
                state.activeTrades.push(action.payload);
                if (state.activeTrades.length > MAX_ACTIVE_TRADES) {
                    state.activeTrades = state.activeTrades.slice(-MAX_ACTIVE_TRADES);
                }
            } else {
                // ВАЖНО: при обновлении существующей сделки сохраняем оригинальный createdAt
                const existingCreatedAt = state.activeTrades[existingIndex].createdAt;
                state.activeTrades[existingIndex] = {
                    ...action.payload,
                    createdAt: existingCreatedAt // Сохраняем оригинальный createdAt
                };
            }
        },
        updateActiveTrade: (state, action: PayloadAction<{ id: string; updates: Partial<ActiveTrade> }>) => {
            const index = state.activeTrades.findIndex(t => t.id === action.payload.id);
            if (index !== -1) {
                // ВАЖНО: createdAt НИКОГДА не должен обновляться - он фиксирован на момент создания сделки
                const { createdAt, ...updatesWithoutCreatedAt } = action.payload.updates;
                if (createdAt !== undefined) {
                    console.warn('[TRADE_HISTORY] Попытка обновить createdAt - игнорируется', {
                        tradeId: action.payload.id,
                        attemptedCreatedAt: createdAt,
                        existingCreatedAt: state.activeTrades[index].createdAt
                    });
                }
                state.activeTrades[index] = { ...state.activeTrades[index], ...updatesWithoutCreatedAt };
            }
        },
        removeActiveTrade: (state, action: PayloadAction<string>) => {
            const targetId = String(action.payload);
            const beforeCount = state.activeTrades.length;
            
            // Удаляем по точному совпадению ID
            state.activeTrades = state.activeTrades.filter(t => {
                const tradeId = String(t.id);
                
                // Точное совпадение
                if (tradeId === targetId) {
                    return false; // Удаляем
                }
                
                // Если targetId в формате "trade_42_1762014684555", пробуем извлечь числовой ID "42"
                const targetMatch = targetId.match(/^trade_(\d+)_/);
                if (targetMatch && targetMatch[1]) {
                    const targetNumericId = targetMatch[1];
                    // Сравниваем с числовым ID из trade.id
                    if (tradeId === targetNumericId) {
                        return false; // Удаляем
                    }
                    // Если trade.id в формате "trade_42_1762014684555", извлекаем числовой ID
                    const tradeMatch = tradeId.match(/^trade_(\d+)_/);
                    if (tradeMatch && tradeMatch[1] === targetNumericId) {
                        return false; // Удаляем
                    }
                }
                
                // Если targetId - это просто число, пробуем сравнить с числовым ID из trade.id
                if (/^\d+$/.test(targetId)) {
                    const tradeMatch = tradeId.match(/^trade_(\d+)_/);
                    if (tradeMatch && tradeMatch[1] === targetId) {
                        return false; // Удаляем
                    }
                }
                
                return true; // Оставляем
            });
            
            const afterCount = state.activeTrades.length;
            if (beforeCount !== afterCount) {
                console.log('[removeActiveTrade] ✅ Удалена активная сделка', {
                    targetId,
                    beforeCount,
                    afterCount,
                    removed: beforeCount - afterCount,
                });
            } else {
                console.warn('[removeActiveTrade] ⚠️ Сделка не найдена для удаления', {
                    targetId,
                    activeTradeIds: state.activeTrades.map(t => t.id),
                });
            }
        },
        // Метаданные
        setSelectedBase: (state, action: PayloadAction<string>) => {
            state.selectedBase = action.payload;
            if (typeof window !== 'undefined') {
                localStorage.setItem('selectedBaseCurrency', action.payload);
            }
        },
        setSelectedCurrencyId: (state, action: PayloadAction<number | null>) => {
            state.selectedCurrencyId = action.payload;
            if (typeof window !== 'undefined') {
                if (action.payload !== null) {
                    localStorage.setItem('selectedCurrencyId', String(action.payload));
                } else {
                    localStorage.removeItem('selectedCurrencyId');
                }
            }
        },
        setQuoteCurrency: (state, action: PayloadAction<string>) => {
            state.quoteCurrency = action.payload;
        },
        setTradingMode: (state, action: PayloadAction<'manual' | 'demo'>) => {
            state.tradingMode = action.payload;
        },
        setUI: (state, action: PayloadAction<Partial<import('./types').TradingTerminalUI>>) => {
            state.ui = { ...state.ui, ...action.payload };
        },
        setForm: (state, action: PayloadAction<Partial<import('./types').TradingFormState>>) => {
            state.form = { ...state.form, ...action.payload };
        },
        setManualTradeAmount: (state, action: PayloadAction<string>) => {
            state.form.manualTradeAmount = action.payload;
        },
        setExpirationSeconds: (state, action: PayloadAction<string>) => {
            state.form.expirationSeconds = action.payload;
        },
        setSpreadPercent: (state, action: PayloadAction<number>) => {
            state.form.spreadPercent = action.payload;
            state.prices.spreadPercent = action.payload;
        },
        setHoveredButton: (state, action: PayloadAction<'buy' | 'sell' | null>) => {
            state.ui.hoveredButton = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTradingDurations.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTradingDurations.fulfilled, (state, action) => {
                state.loading = false;
                state.durations = action.payload;
            })
            .addCase(fetchTradingDurations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
    },
});

export const {
    clearTradingError,
    setCurrentPrice,
    setCurrentMarketPrice,
    setPrices,
    setTradeHistory,
    setNewTradesCount,
    addTradeHistory,
    setTradeMarkers,
    addTradeMarker,
    updateTradeMarker,
    removeTradeMarker,
    setActiveTrades,
    addActiveTrade,
    updateActiveTrade,
    removeActiveTrade,
    setSelectedBase,
    setSelectedCurrencyId,
    setQuoteCurrency,
    setTradingMode,
    setUI,
    setForm,
    setManualTradeAmount,
    setExpirationSeconds,
    setSpreadPercent,
    setHoveredButton,
} = tradingSlice.actions;

export const { reducer: tradingReducer } = tradingSlice;