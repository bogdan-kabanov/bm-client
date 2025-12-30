import { apiClient } from '../client';

export const statsApi = {
  getStats: () => apiClient<{
    totalEarned: number;
    totalUsers: number;
    onlineUsers: number;
  }>('/config/stats'),

  getStatsConfig: () => apiClient<{
    dailyEarnedIncrement: number;
    dailyUsersIncrement: number;
    onlineUsersMin: number;
    onlineUsersMax: number;
    baseTotalEarned: number;
    baseTotalUsers: number;
  }>('/config/stats/config'),
};
