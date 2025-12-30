// ТОЛЬКО методы для вызова API, БЕЗ бизнес-логики!
import { apiClient } from '@src/shared/api/api';
import type { UserWinLossConfig, UserWinLossStats } from './types';

export const winLossApi = {
  // Получить конфигурацию Win/Loss для пользователя
  getConfig: (userId: number) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'GET',
      }
    ),

  // Создать конфигурацию Win/Loss
  createConfig: (userId: number, config: Partial<UserWinLossConfig>) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'POST',
        body: config,
      }
    ),

  // Обновить конфигурацию Win/Loss
  updateConfig: (userId: number, config: Partial<UserWinLossConfig>) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'PUT',
        body: config,
      }
    ),

  // Получить статистику Win/Loss для пользователя
  getStats: (userId: number) =>
    apiClient<{ success: boolean; data: UserWinLossStats }>(
      `/admin/winloss/stats/${userId}`,
      {
        method: 'GET',
      }
    ),

  // Сбросить статистику Win/Loss
  resetStats: (userId: number, variant?: 1 | 2) =>
    apiClient<{ success: boolean }>(
      `/admin/winloss/stats/${userId}`,
      {
        method: 'DELETE',
        body: variant ? { variant } : undefined,
      }
    ),

  // Получить список пользователей с активными настройками Win/Loss
  getActiveConfigs: (params?: { enabled?: boolean; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.enabled !== undefined) queryParams.append('enabled', String(params.enabled));
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    
    const query = queryParams.toString();
    return apiClient<{ success: boolean; data: UserWinLossConfig[]; pagination?: any }>(
      `/admin/winloss/configs${query ? `?${query}` : ''}`,
      {
        method: 'GET',
      }
    );
  },
};

