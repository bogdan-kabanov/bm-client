import { configureStore } from '@reduxjs/toolkit';
import { currencySlice } from '../../entities/currency/model/slice';
import { transactionsSlice } from '../../entities/transactions/model/slice';
import { profileSlice } from '../../entities/user/model/slice';
import { botSlice } from '../../entities/bots/model/slice';
import { referralsSlice } from '../../entities/referral/model/slice';
import { configSlice } from "@src/entities/deposit/model/slice.ts";
import { tradingReducer } from "@src/entities/trading/model/slice.ts";
import { withdrawalReducer } from "@src/entities/withdrawal/model/slice.ts";
import { copyTradingSignalsReducer } from "@src/entities/copy-trading-signals/model/slice.ts";
import timeReducer from "@src/shared/lib/timeSlice.ts";


export const store = configureStore({
    reducer: {
        currency: currencySlice.reducer,
        transactions: transactionsSlice.reducer,
        profile: profileSlice.reducer,
        bot: botSlice.reducer,
        referrals: referralsSlice.reducer,
        config: configSlice.reducer,
        trading: tradingReducer,
        withdrawal: withdrawalReducer,
        copyTradingSignals: copyTradingSignalsReducer,
        time: timeReducer,
    },
    // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования производительности в Chrome
    devTools: false,
});


store.subscribe(() => {
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;