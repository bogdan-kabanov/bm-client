import { apiClient } from '../client';

export const timeApi = {
  getServerTime: () =>
    apiClient<{ timestamp: number; time: number }>('/time', {
      method: 'GET',
      noAuth: true,
    }),
};
