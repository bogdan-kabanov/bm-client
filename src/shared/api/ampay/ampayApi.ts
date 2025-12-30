import { apiClient } from '../client';
import type { 
    AmpayPaymentMethod, 
    AmpayTransaction, 
    CreateTransactionRequest, 
    MethodsByCategory,
    AmpayMethodConfig,
    CreateAmpayMethodConfigRequest,
    UpdateAmpayMethodConfigRequest
} from './types';

export const ampayApi = {
    getAvailableMethods: (countryCode?: string, direction?: 'IN' | 'OUT') => {
        const params = new URLSearchParams();
        if (countryCode) params.append('country', countryCode);
        if (direction) params.append('direction', direction);
        const url = `/ampay/methods${params.toString() ? `?${params.toString()}` : ''}`;
        return apiClient<AmpayPaymentMethod[]>(url, {
            method: 'GET'
        });
    },

    getStructuredMethods: async (countryCode?: string, direction?: 'IN' | 'OUT') => {
        const params = new URLSearchParams();
        if (countryCode) params.append('countryCode', countryCode);
        if (direction) params.append('direction', direction);
        const url = `/ampay/methods/structured${params.toString() ? `?${params.toString()}` : ''}`;
        try {
            // apiClient returns data.data if success=true and no meta, or full object if meta exists
            // We need to handle both cases
            const response = await apiClient<any>(url, {
                method: 'GET'
            });
            
            console.log('[ampayApi.getStructuredMethods] Raw response:', {
                response,
                isArray: Array.isArray(response),
                hasSuccess: response && typeof response === 'object' && 'success' in response,
                hasData: response && typeof response === 'object' && 'data' in response
            });
            
            // If response has success and data fields, use them
            if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
                return response;
            }
            
            // If response is array (apiClient returned data.data), wrap it
            if (Array.isArray(response)) {
                return { success: true, data: response, meta: undefined };
            }
            
            // If response is object but not wrapped, assume it's the data
            return { success: true, data: response || [], meta: undefined };
        } catch (error) {
            console.error('[ampayApi] Ошибка получения методов:', error);
            return { success: false, data: [], meta: undefined };
        }
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

    uploadPaymentProof: (transactionId: number, images: File[]) => {
        const formData = new FormData();
        images.forEach((image, index) => {
            formData.append(`images`, image);
        });
        formData.append('transaction_id', transactionId.toString());
        return apiClient<{ success: boolean; message: string }>('/ampay/transaction/upload-proof', {
            method: 'POST',
            body: formData,
            headers: {} // Не устанавливаем Content-Type, браузер установит его автоматически с boundary для FormData
        });
    },

    getSupportedCountries: async () => {
        try {
            const response = await apiClient<{ success: boolean; data: Array<{ code: string; name: string; currencies: string[] }> }>('/ampay/supported-countries', {
                method: 'GET'
            });
            return Array.isArray(response) ? response : (response as any)?.data || [];
        } catch (error) {
            // Если endpoint не существует (404) или другая ошибка, возвращаем пустой массив
            // Это позволит использовать fallback список стран
            console.warn('Ampay supported-countries endpoint not available, using fallback');
            return [];
        }
    },

    getCurrentSubMethod: (paymentMethod: string, currency: string) =>
        apiClient<{ sub_method: 'FTD' | 'STD' }>(`/ampay/sub-method?payment_method=${encodeURIComponent(paymentMethod)}&currency=${encodeURIComponent(currency)}`, {
            method: 'GET'
        }),

    // Админские методы для управления конфигурациями методов
    admin: {
        getAllMethods: () =>
            apiClient<{ success: boolean; data: AmpayMethodConfig[] }>('/admin/ampay/payment-methods', {
                method: 'GET'
            }),

        getMethodById: (id: number) =>
            apiClient<{ success: boolean; data: AmpayMethodConfig }>(`/admin/ampay/payment-methods/${id}`, {
                method: 'GET'
            }),

        createMethod: (data: CreateAmpayMethodConfigRequest) =>
            apiClient<{ success: boolean; data: AmpayMethodConfig }>('/admin/ampay/payment-methods', {
                method: 'POST',
                body: data
            }),

        updateMethod: (id: number, data: UpdateAmpayMethodConfigRequest) =>
            apiClient<{ success: boolean; data: AmpayMethodConfig }>(`/admin/ampay/payment-methods/${id}`, {
                method: 'PUT',
                body: data
            }),

        deleteMethod: (id: number) =>
            apiClient<{ success: boolean }>(`/admin/ampay/payment-methods/${id}`, {
                method: 'DELETE'
            }),

        getMethodsByCurrency: (currency: string) =>
            apiClient<{ success: boolean; data: AmpayMethodConfig[] }>(`/admin/ampay/payment-methods?currency=${encodeURIComponent(currency)}`, {
                method: 'GET'
            }),

        getMethodsByDirection: (direction: 'IN' | 'OUT') =>
            apiClient<{ success: boolean; data: AmpayMethodConfig[] }>(`/admin/ampay/payment-methods?direction=${direction}`, {
                method: 'GET'
            })
    }
};
