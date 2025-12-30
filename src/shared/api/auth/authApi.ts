import { apiClient } from '../client';

export const authApi = {
  login: (email: string, password: string) => 
    apiClient<{ token: string; refresh_token?: string; user: any }>('/auth/email/login', {
      method: 'POST',
      body: { email, password },
      noAuth: true,
    }),

  requestEmailVerification: () =>
    apiClient<{ message: string }>('/auth/email/verification/send', {
      method: 'POST',
    }),

  verifyEmail: (token: string) =>
    apiClient<{ message: string }>(`/auth/email/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      noAuth: true,
    }),

  register: (email: string, password: string, phone?: string, refId?: number, partnerReferral?: { partnerId: number; referralSlug: string }, referralPromocode?: string) =>
    apiClient<{ token: string; refresh_token?: string; user: any }>('/auth/email/register', {
      method: 'POST',
      body: { email, password, phone, refId, partnerReferral, referralPromocode },
      noAuth: true,
    }),

  initiateGoogleAuth: (refId?: number, partnerReferral?: { partnerId: number; referralSlug: string }, state?: string) =>
    apiClient<{ authUrl?: string; redirectUrl?: string }>('/auth/google/initiate', {
      method: 'POST',
      body: { refId, partnerReferral, state },
      noAuth: true,
    }),

  loginWithGoogle: (code: string, state?: string) =>
    apiClient<{ token: string; refresh_token?: string; user: any }>('/auth/google/callback', {
      method: 'POST',
      body: { code, state },
      noAuth: true,
    }),

  telegramLogin: (referralCode?: string | null) =>
    apiClient<{ token: string; refresh_token?: string; user: any }>('/auth/telegram/login', {
      method: 'POST',
      body: { 
        ...(referralCode ? { referral_code: referralCode } : {}) 
      },
      noAuth: true,
    }),

  refreshToken: (refreshToken: string) =>
    apiClient<{ token: string; refresh_token?: string; user: any }>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      noAuth: true,
    }),

  getPrimaryProvider: () =>
    apiClient<{ provider_type: string; is_primary: boolean }>('/auth/providers/primary'),

  requestPasswordReset: (email: string) =>
    apiClient<{ message: string }>('/auth/password/reset/request', {
      method: 'POST',
      body: { email },
      noAuth: true,
    }),

  resetPassword: (token: string, password: string) =>
    apiClient<{ message: string }>('/auth/password/reset', {
      method: 'POST',
      body: { token, password },
      noAuth: true,
    }),
};
