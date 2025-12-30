// @src/entities/bot/model/slice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Bot, BotState, BotConfig } from './types';
import { BOT_STATUSES, DEFAULT_BOT } from '../lib/constants';
import { apiClient } from '@src/shared/api';

const initialState: BotState = {
    bots: [],
    loading: false,
    error: null,
    currentBot: DEFAULT_BOT,
    availableBots: [],
    status: BOT_STATUSES.ACTIVATED,
};

export const fetchBots = createAsyncThunk<
    Bot[],
    void,
    { rejectValue: string }
>(
    'bot/fetchBots',
    async (_,{ rejectWithValue }) => {
        try {
            return await apiClient<Bot[]>(`/bots`);
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const updateBotConfig = createAsyncThunk<
    Bot,
    { botId: number; configData: BotConfig },
    { rejectValue: string }
>(
    'bot/updateBotConfig',
    async ({ botId, configData }: { botId: number; configData: BotConfig }, { rejectWithValue }) => {
        try {
            return await apiClient<Bot>(`/bots/${botId}/config`, {
                method: 'PUT',
                body: JSON.stringify(configData),
            });
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const botSlice = createSlice({
    name: 'bot',
    initialState,
    reducers: {
        setNextBot: (state) => {
            const currentIndex = state.availableBots.indexOf(state.currentBot);
            const nextIndex = (currentIndex + 1) % state.availableBots.length;
            state.currentBot = state.availableBots[nextIndex];
        },
        setBot: (state, action) => {
            state.currentBot = action.payload;
        },
        setStatus: (state, action) => {
            state.status = action.payload;
        },
        clearBots: (state) => {
            state.bots = [];
            state.availableBots = [];
            state.currentBot = DEFAULT_BOT;
            state.status = BOT_STATUSES.DEACTIVATED;
            state.loading = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchBots.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchBots.fulfilled, (state, action) => {
                state.loading = false;
                state.bots = action.payload;
                state.availableBots = action.payload.map((bot: Bot) => bot.name);
                if (action.payload.length > 0) {
                    state.currentBot = action.payload[0].name;
                }
            })
            .addCase(fetchBots.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch bots';
            })
            .addCase(updateBotConfig.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateBotConfig.fulfilled, (state, action) => {
                state.loading = false;
                const updatedBot = action.payload;
                const index = state.bots.findIndex((bot) => bot.id.toString() === updatedBot.id);
                if (index !== -1) {
                    state.bots[index] = updatedBot;
                }
            })
            .addCase(updateBotConfig.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to update bot configuration';
            });
    },
});

export const { setNextBot, setBot, setStatus, clearBots } = botSlice.actions;

export default botSlice.reducer;