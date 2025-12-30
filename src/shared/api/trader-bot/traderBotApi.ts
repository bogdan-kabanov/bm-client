import { apiClient } from '../client';
import type { TraderBot } from './types';

export const traderBotApi = {
  getAll: () => apiClient<TraderBot[]>('/admin/trader-bots'),
  getById: (id: number) => apiClient<TraderBot>(`/admin/trader-bots/${id}`),
  create: (data: Partial<TraderBot>) => apiClient<TraderBot>('/admin/trader-bots', {
    method: 'POST',
    body: data,
  }),
  update: (id: number, data: Partial<TraderBot>) => apiClient<TraderBot>(`/admin/trader-bots/${id}`, {
    method: 'PUT',
    body: data,
  }),
  delete: (id: number) => apiClient<void>(`/admin/trader-bots/${id}`, {
    method: 'DELETE',
  }),
  generateTrades: (id?: number) => {
    if (id) {
      return apiClient<any>(`/admin/trader-bots/${id}/generate-trades`, {
        method: 'POST',
      });
    }
    return apiClient<any>('/admin/trader-bots/generate-trades/all', {
      method: 'POST',
    });
  },
};
