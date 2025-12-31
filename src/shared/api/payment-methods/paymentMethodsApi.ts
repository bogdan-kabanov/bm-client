import { apiClient } from '../client';
import type {
  PaymentCategory,
  PaymentMethod,
  PaymentCard,
  PaymentCryptocurrency,
  PaymentCategoryCountry,
  PaymentMethodCountry,
  PaymentCardCountry,
  PaymentCryptocurrencyCountry,
  StructuredCategory,
} from './types';

export interface Country {
  code: string;
  name: string;
  dialCode?: string;
}

export const paymentMethodsApi = {
  getAllCountries: async (includeDialCode: boolean = false): Promise<Country[]> => {
    try {
      const url = `/payment-methods/countries${includeDialCode ? '?includeDialCode=true' : ''}`;
      const response = await apiClient<{ success: boolean; data: Country[] }>(
        url,
        {
          method: 'GET',
          noAuth: true,
        }
      );
      const result = Array.isArray(response) ? response : (response as any)?.data || [];
      return result;
    } catch (error) {
      // Only log errors in development mode to reduce console noise
      if (import.meta.env.DEV) {
        console.error('Error loading countries:', error);
      }
      // Re-throw error so caller can handle it (e.g., use fallback)
      throw error;
    }
  },
  getStructured: async (countryCode: string, direction?: 'IN' | 'OUT' | 'deposit' | 'withdrawal'): Promise<StructuredCategory[]> => {
    try {
      const params = new URLSearchParams();
      params.append('countryCode', countryCode);
      if (direction) {
        // Convert 'deposit'/'withdrawal' to 'IN'/'OUT' for API compatibility
        const directionParam = direction === 'deposit' ? 'IN' : direction === 'withdrawal' ? 'OUT' : direction;
        params.append('direction', directionParam);
      }
      const url = `/payment-methods/structured?${params.toString()}`;
      const response = await apiClient<{ success: boolean; data: StructuredCategory[] }>(
        url,
        {
          method: 'GET',
          noAuth: true,
        }
      );
      const result = Array.isArray(response) ? response : (response as any)?.data || [];
      return result;
    } catch (error) {

      if (error instanceof Error && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {

      }
      return [];
    }
  },
  categories: {
    getAll: async (countryCode?: string): Promise<PaymentCategory[]> => {
      const params = countryCode ? { country_code: countryCode } : {};
      const queryString = new URLSearchParams(params).toString();
      const url = `/payment-methods/categories${queryString ? `?${queryString}` : ''}`;
      
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCategory[] }>(
          url,
          {
            method: 'GET',
          }
        );
        const result = Array.isArray(response) ? response : (response as any)?.data || [];
        return result;
      } catch (error) {
        throw error;
      }
    },
    getCountries: async (categoryId: number): Promise<PaymentCategoryCountry[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCategoryCountry[] }>(
          `/payment-methods/categories/${categoryId}/countries`,
          {
            method: 'GET',
          }
        );
        return Array.isArray(response) ? response : (response as any)?.data || [];
      } catch {
        return [];
      }
    },
    setCountry: async (categoryId: number, countryCode: string, isActive: boolean): Promise<{ success: boolean; data: PaymentCategoryCountry }> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCategoryCountry }>(
          `/payment-methods/categories/${categoryId}/countries/${countryCode}`,
          {
            method: 'PUT',
            body: {
              is_active: isActive,
            },
          }
        );
        return response as { success: boolean; data: PaymentCategoryCountry };
      } catch (err: any) {
        const errorMessage = err?.message || '';
        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('HTTP_ERROR: 404') || errorMessage.includes('404')) {
          try {
            const response = await apiClient<{ success: boolean; data: PaymentCategoryCountry }>(
              `/payment-methods/categories/${categoryId}/countries`,
              {
                method: 'POST',
                body: {
                  country_code: countryCode,
                  is_active: isActive,
                },
              }
            );
            return response as { success: boolean; data: PaymentCategoryCountry };
          } catch (postErr) {
            throw postErr;
          }
        }
        throw err;
      }
    },
  },
  methods: {
    getAll: async (categoryId?: number, countryCode?: string): Promise<PaymentMethod[]> => {
      const params: any = {};
      if (categoryId) params.category_id = categoryId;
      if (countryCode) params.country_code = countryCode;
      
      const queryString = new URLSearchParams(params).toString();
      const url = `/payment-methods/methods${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient<{ success: boolean; data: PaymentMethod[] }>(
        url,
        {
          method: 'GET',
        }
      );
      return Array.isArray(response) ? response : (response as any)?.data || [];
    },
    getCountries: async (methodId: number): Promise<PaymentMethodCountry[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentMethodCountry[] }>(
          `/payment-methods/methods/${methodId}/countries`,
          {
            method: 'GET',
          }
        );
        return Array.isArray(response) ? response : (response as any)?.data || [];
      } catch {
        return [];
      }
    },
    setCountry: async (methodId: number, countryCode: string, isActive: boolean): Promise<{ success: boolean; data: PaymentMethodCountry }> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentMethodCountry }>(
          `/payment-methods/methods/${methodId}/countries/${countryCode}`,
          {
            method: 'PUT',
            body: {
              is_active: isActive,
            },
          }
        );
        return response as { success: boolean; data: PaymentMethodCountry };
      } catch (err: any) {
        const errorMessage = err?.message || '';
        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('HTTP_ERROR: 404') || errorMessage.includes('404')) {
          try {
            const response = await apiClient<{ success: boolean; data: PaymentMethodCountry }>(
              `/payment-methods/methods/${methodId}/countries`,
              {
                method: 'POST',
                body: {
                  country_code: countryCode,
                  is_active: isActive,
                },
              }
            );
            return response as { success: boolean; data: PaymentMethodCountry };
          } catch (postErr) {
            throw postErr;
          }
        }
        throw err;
      }
    },
  },
  cards: {
    getAll: async (methodId: number, countryCode?: string): Promise<PaymentCard[]> => {
      const params: any = {};
      if (countryCode) params.country_code = countryCode;
      
      const queryString = new URLSearchParams(params).toString();
      const url = `/payment-methods/methods/${methodId}/cards${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient<{ success: boolean; data: PaymentCard[] }>(
        url,
        {
          method: 'GET',
        }
      );
      return Array.isArray(response) ? response : (response as any)?.data || [];
    },
    getCountries: async (cardId: number): Promise<PaymentCardCountry[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCardCountry[] }>(
          `/payment-methods/cards/${cardId}/countries`,
          {
            method: 'GET',
          }
        );
        return Array.isArray(response) ? response : (response as any)?.data || [];
      } catch {
        return [];
      }
    },
    setCountry: async (cardId: number, countryCode: string, isActive: boolean): Promise<{ success: boolean; data: PaymentCardCountry }> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCardCountry }>(
          `/payment-methods/cards/${cardId}/countries/${countryCode}`,
          {
            method: 'PUT',
            body: {
              is_active: isActive,
            },
          }
        );
        return response as { success: boolean; data: PaymentCardCountry };
      } catch (err: any) {
        const errorMessage = err?.message || '';
        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('HTTP_ERROR: 404') || errorMessage.includes('404')) {
          try {
            const response = await apiClient<{ success: boolean; data: PaymentCardCountry }>(
              `/payment-methods/cards/${cardId}/countries`,
              {
                method: 'POST',
                body: {
                  country_code: countryCode,
                  is_active: isActive,
                },
              }
            );
            return response as { success: boolean; data: PaymentCardCountry };
          } catch (postErr) {
            throw postErr;
          }
        }
        throw err;
      }
    },
  },
  cryptocurrencies: {
    getAll: async (methodId: number, countryCode?: string): Promise<PaymentCryptocurrency[]> => {
      const params: any = {};
      if (countryCode) params.country_code = countryCode;
      
      const queryString = new URLSearchParams(params).toString();
      const url = `/payment-methods/methods/${methodId}/cryptocurrencies${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient<{ success: boolean; data: PaymentCryptocurrency[] }>(
        url,
        {
          method: 'GET',
        }
      );
      return Array.isArray(response) ? response : (response as any)?.data || [];
    },
    create: async (methodId: number, data: {
      name: string;
      symbol: string;
      name_key: string;
      icon?: string | null;
      wallet?: string | null;
      network?: string | null;
      qr_code_image?: string | null;
      min_amount?: number | null;
      max_amount?: number | null;
      is_active?: boolean;
      order?: number;
    }): Promise<{ success: boolean; data: PaymentCryptocurrency }> => {
      const response = await apiClient<{ success: boolean; data: PaymentCryptocurrency }>(
        `/payment-methods/methods/${methodId}/cryptocurrencies`,
        {
          method: 'POST',
          body: data,
        }
      );
      return response as { success: boolean; data: PaymentCryptocurrency };
    },
    update: async (cryptocurrencyId: number, data: {
      name?: string;
      symbol?: string;
      name_key?: string;
      icon?: string | null;
      wallet?: string | null;
      network?: string | null;
      qr_code_image?: string | null;
      min_amount?: number | null;
      max_amount?: number | null;
      is_active?: boolean;
      order?: number;
    }): Promise<{ success: boolean; data: PaymentCryptocurrency }> => {
      const response = await apiClient<{ success: boolean; data: PaymentCryptocurrency }>(
        `/payment-methods/cryptocurrencies/${cryptocurrencyId}`,
        {
          method: 'PUT',
          body: data,
        }
      );
      return response as { success: boolean; data: PaymentCryptocurrency };
    },
    getById: async (cryptocurrencyId: number): Promise<PaymentCryptocurrency> => {
      const response = await apiClient<{ success: boolean; data: PaymentCryptocurrency }>(
        `/payment-methods/cryptocurrencies/${cryptocurrencyId}`,
        {
          method: 'GET',
        }
      );
      return Array.isArray(response) ? response[0] : (response as any)?.data;
    },
    getCountries: async (cryptocurrencyId: number): Promise<PaymentCryptocurrencyCountry[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCryptocurrencyCountry[] }>(
          `/payment-methods/cryptocurrencies/${cryptocurrencyId}/countries`,
          {
            method: 'GET',
          }
        );
        return Array.isArray(response) ? response : (response as any)?.data || [];
      } catch {
        return [];
      }
    },
    setCountry: async (cryptocurrencyId: number, countryCode: string, isActive: boolean): Promise<{ success: boolean; data: PaymentCryptocurrencyCountry }> => {
      try {
        const response = await apiClient<{ success: boolean; data: PaymentCryptocurrencyCountry }>(
          `/payment-methods/cryptocurrencies/${cryptocurrencyId}/countries/${countryCode}`,
          {
            method: 'PUT',
            body: {
              is_active: isActive,
            },
          }
        );
        return response as { success: boolean; data: PaymentCryptocurrencyCountry };
      } catch (err: any) {
        const errorMessage = err?.message || '';
        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('HTTP_ERROR: 404') || errorMessage.includes('404')) {
          try {
            const response = await apiClient<{ success: boolean; data: PaymentCryptocurrencyCountry }>(
              `/payment-methods/cryptocurrencies/${cryptocurrencyId}/countries`,
              {
                method: 'POST',
                body: {
                  country_code: countryCode,
                  is_active: isActive,
                },
              }
            );
            return response as { success: boolean; data: PaymentCryptocurrencyCountry };
          } catch (postErr) {
            throw postErr;
          }
        }
        throw err;
      }
    },
  },
};
