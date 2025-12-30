import { apiClient } from '../client';
import type { UserWinLossConfig, UserWinLossStats } from './types';

export const winLossApi = {
  getConfig: (userId: number) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'GET',
      }
    ),

  createConfig: (userId: number, config: Partial<UserWinLossConfig>) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'POST',
        body: config,
      }
    ),

  updateConfig: (userId: number, config: Partial<UserWinLossConfig>) =>
    apiClient<{ success: boolean; data: UserWinLossConfig }>(
      `/admin/winloss/config/${userId}`,
      {
        method: 'PUT',
        body: config,
      }
    ),

  getStats: (userId: number) =>
    apiClient<{ success: boolean; data: UserWinLossStats }>(
      `/admin/winloss/stats/${userId}`,
      {
        method: 'GET',
      }
    ),

  resetStats: (userId: number, variant?: 1 | 2) =>
    apiClient<{ success: boolean }>(
      `/admin/winloss/stats/${userId}`,
      {
        method: 'DELETE',
        body: variant ? { variant } : undefined,
      }
    ),

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
