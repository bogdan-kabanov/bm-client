import { RootState } from '@src/app/store';

export const selectBots = (state: RootState) => state.bot.bots;
export const selectBotsLoading = (state: RootState) => state.bot.loading;
export const selectBotsError = (state: RootState) => state.bot.error;
export const selectCurrentBot = (state: RootState) => state.bot.currentBot;
export const selectBotStatus = (state: RootState) => state.bot.status;