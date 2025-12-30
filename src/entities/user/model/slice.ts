import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiClient, userApi } from '@src/shared/api';
import { ProfileState, User } from "@src/entities/user/model/types.ts";
import { checkAndRegisterUser, loginWithEmail } from '@src/features/auth/authCheck';
import { ensureHttps } from '@src/shared/lib/ensureHttps';

const normalizeUserAvatar = (user: User | null | undefined): User | null => {
    if (!user) {
        return user ?? null;
    }

    const source = user.avatarUrl ?? user.avatar_url ?? null;
    const normalized = ensureHttps(source);

    return {
        ...user,
        avatarUrl: normalized ?? null,
        avatar_url: normalized ?? null,
    };
};

const initialState: ProfileState = {
    user: null,
    loading: false,
    error: null,
};

export const fetchProfile = createAsyncThunk<
    User,
    void,
    { rejectValue: string }
>(
    'profile/fetchProfile',
    async (_, { rejectWithValue }) => {
        try {
            return await userApi.getProfile();
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);

export const updateUserProfile = createAsyncThunk<
    User,
    {
        profileData: {
            firstname?: string;
            lastname?: string;
            phone?: string;
            login?: string;
            currency?: string;
            wallets?: string | { usdt?: string; btc?: string; ltc?: string; eth?: string };
        };
    },
    { rejectValue: string }
>(
    'profile/updateUserProfile',
    async ({ profileData }, { rejectWithValue }) => {
        try {
            console.log('[updateUserProfile] Sending request with profileData:', profileData);
            const response = await apiClient<User>(`/users/profile`, {
                method: 'PUT',
                body: profileData,
            });
            console.log('[updateUserProfile] Received response:', response);
            console.log('[updateUserProfile] Response currency:', response?.currency);
            return response;
        } catch (error) {
            console.error('[updateUserProfile] Error:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
        }
    }
);


export const profileSlice = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.user = normalizeUserAvatar(action.payload);
        },
        clearProfile: (state) => {
            state.user = null;
            state.loading = false;
            state.error = null;
        },
        updateCoins: (state, action) => {
            if (state.user) {
                state.user.coins = action.payload;
            }
        },
        updateBalance: (state, action) => {
            if (state.user) {
                state.user.balance = action.payload;
            }
        },
        updateDemoBalance: (state, action) => {
            if (state.user) {
                state.user.demo_balance = action.payload;
            }
        },
        updateProfitBalance: (state, action) => {
            if (state.user) {
                state.user.balance_profit = action.payload;
            }
        },
        updateTradingStatus: (state, action) => {
            if (state.user) {
                state.user.is_trading = action.payload.isTrading;
                state.user.trading_start_time = action.payload.startTime;
                state.user.trading_duration = action.payload.duration;
            }
        },
        updateUserFromWebSocket: (state, action) => {
            if (state.user) {
                const nextAvatar = ensureHttps(
                    action.payload.avatarUrl ??
                    action.payload.avatar_url ??
                    state.user.avatarUrl ??
                    state.user.avatar_url ??
                    null
                );
                state.user.balance = action.payload.balance ?? state.user.balance;
                state.user.balance_profit = action.payload.balance_profit ?? state.user.balance_profit;
                state.user.coins = action.payload.coins ?? state.user.coins;
                state.user.is_trading = action.payload.is_trading ?? state.user.is_trading;
                state.user.trading_duration = action.payload.trading_duration ?? state.user.trading_duration;
                state.user.trading_start_time = action.payload.trading_start_time ?? state.user.trading_start_time;
                state.user.email = action.payload.email ?? state.user.email;
                state.user.phone = action.payload.phone ?? state.user.phone;
                state.user.currency = action.payload.currency ?? state.user.currency;
                state.user.login = action.payload.login ?? state.user.login;
                state.user.avatar_url = nextAvatar ?? state.user.avatar_url ?? null;
                state.user.avatarUrl = nextAvatar ?? state.user.avatarUrl ?? null;
                state.user.email_verified = action.payload.email_verified ?? state.user.email_verified;
                state.user.demo_balance = action.payload.demo_balance ?? state.user.demo_balance;
            }
        },
        resetLoading: (state) => {
            state.loading = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(checkAndRegisterUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(checkAndRegisterUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = normalizeUserAvatar(action.payload.user);
            })
            .addCase(checkAndRegisterUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
            .addCase(loginWithEmail.pending, (state) => {
                state.loading = true;
                // Не очищаем error здесь, чтобы не затирать другие ошибки
            })
            .addCase(loginWithEmail.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null; // Очищаем ошибку при успешной авторизации
                state.user = normalizeUserAvatar(action.payload.user);
            })
            .addCase(loginWithEmail.rejected, (state) => {
                state.loading = false;
                // Не сохраняем ошибки авторизации в profile.error
                // Они должны обрабатываться только в формах авторизации
            })
            .addCase(fetchProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = normalizeUserAvatar(action.payload);
            })
            .addCase(fetchProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
            .addCase(updateUserProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                // Сохраняем старые значения ДО обновления state
                const oldCurrency = state.user?.currency || 'USD';
                const newCurrency = action.payload.currency || 'USD';
                const oldBalance = state.user?.balance || 0;
                const newBalance = action.payload.balance || 0;
                
                console.log('[profileSlice] updateUserProfile.fulfilled:', {
                    oldCurrency,
                    newCurrency,
                    payload: action.payload,
                    payloadCurrency: action.payload.currency
                });
                
                state.user = normalizeUserAvatar(action.payload);
                
                console.log('[profileSlice] After update, state.user.currency:', state.user?.currency);
            })
            .addCase(updateUserProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
    },
});

export const { setUser, clearProfile, updateBalance, updateDemoBalance, updateCoins, updateProfitBalance, updateTradingStatus, updateUserFromWebSocket, resetLoading } = profileSlice.actions;
export const { reducer: profileReducer } = profileSlice;