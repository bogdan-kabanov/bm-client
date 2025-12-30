import { apiClient } from '../client';
import type { CopyTradingTopTrader } from './types';

export const copyTradingApi = {
  getProfile: () => apiClient<{ id: number; user_id: number; code: string; is_active: boolean }>('/copy-trading/profile'),
  toggleProfile: (isActive: boolean) => apiClient<{ id: number; user_id: number; code: string; is_active: boolean }>('/copy-trading/profile', {
    method: 'PATCH',
    body: { isActive },
  }),
  listSubscriptions: () => apiClient<Array<{
    subscription: any;
    trader: any;
    profile: any;
    stats: {
      totalCopiedTrades: number;
      totalProfit: number;
      totalVolume: number;
      activeCopiedTrades: number;
      lastCopiedAt: string | null;
    };
  }>>('/copy-trading/subscriptions'),
  createSubscription: (
    code: string, 
    traderUserId?: number,
    options?: {
      copyMode?: 'mirror' | 'fixed' | 'multiplier' | 'balance_percent';
      fixedAmount?: number;
      amountMultiplier?: number;
      balancePercent?: number;
      dailyLimitAmount?: number;
      dailyLimitEnabled?: boolean;
    }
  ) => {
    // Отправляем код как есть (TRD формат), сервер сам найдет профиль по коду
    // normalizeTraderCodeForServer не нужен, так как сервер ищет по коду напрямую
    // Если передан traderUserId, отправляем его для более быстрого поиска профиля
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : String(code);
    return apiClient<any>('/copy-trading/subscriptions', {
      method: 'POST',
      body: { 
        code: normalizedCode,
        ...(traderUserId ? { traderUserId } : {}),
        ...(options?.copyMode ? { copyMode: options.copyMode } : {}),
        ...(options?.fixedAmount !== undefined ? { fixedAmount: options.fixedAmount } : {}),
        ...(options?.amountMultiplier !== undefined ? { amountMultiplier: options.amountMultiplier } : {}),
        ...(options?.balancePercent !== undefined ? { balancePercent: options.balancePercent } : {}),
        ...(options?.dailyLimitAmount !== undefined ? { dailyLimitAmount: options.dailyLimitAmount } : {}),
        ...(options?.dailyLimitEnabled !== undefined ? { dailyLimitEnabled: options.dailyLimitEnabled } : {}),
      },
    });
  },
  toggleSubscription: (id: number, isActive: boolean) => apiClient<any>(`/copy-trading/subscriptions/${id}`, {
    method: 'PATCH',
    body: { isActive },
  }),
  deleteSubscription: (id: number) => apiClient<void>(`/copy-trading/subscriptions/${id}`, {
    method: 'DELETE',
  }),
  getTopTraders: (limit = 10) =>
    apiClient<CopyTradingTopTrader[]>(`/copy-trading/top-traders?limit=${limit}`),
};
