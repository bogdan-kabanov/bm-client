import { apiClient } from '@src/shared/api/api';
import type { AmpayPaymentMethod, AmpayTransaction, CreateTransactionRequest, MethodsByCategory } from './types';

export const ampayApi = {
    getAvailableMethods: (countryCode?: string) => {
        const url = countryCode ? `/ampay/methods?country=${encodeURIComponent(countryCode)}` : '/ampay/methods';
        return apiClient<AmpayPaymentMethod[]>(url, {
            method: 'GET'
        });
    },

    getMethodsByCategory: () =>
        apiClient<MethodsByCategory>('/ampay/methods/categories', {
            method: 'GET'
        }),

    createTransaction: (data: CreateTransactionRequest) =>
        apiClient<AmpayTransaction>('/ampay/transaction', {
            method: 'POST',
            body: data
        }),

    getUserTransactions: (limit: number = 50, offset: number = 0) =>
        apiClient<{ transactions: AmpayTransaction[]; total: number }>(`/ampay/transactions?limit=${limit}&offset=${offset}`, {
            method: 'GET'
        }),

    getTransactionById: (id: number) =>
        apiClient<AmpayTransaction>(`/ampay/transaction/${id}`, {
            method: 'GET'
        }),

    syncTransactionStatus: (trackerId: string) =>
        apiClient<AmpayTransaction>(`/ampay/transaction/sync/${trackerId}`, {
            method: 'GET'
        }),

    getSupportedCountries: async () => {
        const response = await apiClient<{ success: boolean; data: Array<{ code: string; name: string; currencies: string[] }> }>('/ampay/supported-countries', {
            method: 'GET'
        });
        return Array.isArray(response) ? response : (response as any)?.data || [];
    },

    getCurrentSubMethod: (paymentMethod: string, currency: string) =>
        apiClient<{ sub_method: 'FTD' | 'STD' }>(`/ampay/sub-method?payment_method=${encodeURIComponent(paymentMethod)}&currency=${encodeURIComponent(currency)}`, {
            method: 'GET'
        })
};
