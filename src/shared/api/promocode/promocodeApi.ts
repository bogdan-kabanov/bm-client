import { apiClient } from '../client';

export interface PromocodeValidation {
  valid: boolean;
  discount?: number;
  finalAmount?: number;
  error?: string;
  minAmount?: number | null;
  discountValue?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
}

export interface ReferralPromocode {
  promocodeId: number;
  code: string;
  name: string | null;
  isActive: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minAmount?: number | null;
  maxDiscount?: number | null;
  description?: string | null;
}

export const promocodeApi = {
  validate: async (code: string, amount: number): Promise<PromocodeValidation> => {
    try {
      const response = await apiClient<{ success: boolean; data: PromocodeValidation }>('/promocodes/validate', {
        method: 'POST',
        body: {
          code,
          amount
        }
      });
      console.log('[promocodeApi] Ответ от API /promocodes/validate:', response);
      
      // Проверяем структуру ответа
      if (response && response.data) {
        return response.data;
      } else if (response && typeof response === 'object' && 'valid' in response) {
        // Если ответ пришел напрямую без обертки data
        return response as PromocodeValidation;
      } else {
        console.error('[promocodeApi] Неожиданная структура ответа:', response);
        return { valid: false, error: 'Неожиданный формат ответа от сервера' };
      }
    } catch (error) {
      console.error('[promocodeApi] Ошибка при валидации промокода:', error);
      return { valid: false, error: 'Ошибка при проверке промокода' };
    }
  },
  getReferralPromocode: async (): Promise<ReferralPromocode | null> => {
    try {
      // apiClient может вернуть либо data.data, либо весь объект ответа
      // Пробуем сначала получить как обёрнутый ответ
      const response = await apiClient<any>('/promocodes/referral', {
        method: 'GET'
      });
      
      console.log('[promocodeApi] Полный ответ от API /promocodes/referral:', response);
      console.log('[promocodeApi] Тип ответа:', typeof response);
      console.log('[promocodeApi] Является null:', response === null);
      console.log('[promocodeApi] Является undefined:', response === undefined);
      
      // Если ответ null или undefined
      if (response === null || response === undefined) {
        console.log('[promocodeApi] Промокод не найден (null/undefined)');
        return null;
      }
      
      // Проверяем, является ли ответ обёрткой { success: true, data: ... }
      let promoData: any = null;
      if (typeof response === 'object' && 'success' in response && 'data' in response) {
        console.log('[promocodeApi] Ответ в формате обёртки { success, data }');
        promoData = response.data;
      } else if (typeof response === 'object' && 'code' in response) {
        // Если ответ уже является промокодом напрямую
        console.log('[promocodeApi] Ответ уже является промокодом');
        promoData = response;
      } else {
        console.log('[promocodeApi] Неожиданный формат ответа:', response);
        return null;
      }
      
      // Проверяем, что данные валидны
      if (promoData === null || promoData === undefined) {
        console.log('[promocodeApi] Промокод не найден (data = null/undefined)');
        return null;
      }
      
      if (typeof promoData === 'object' && 'code' in promoData) {
        const promo = promoData as ReferralPromocode;
        console.log('[promocodeApi] ✅ Промокод найден:', {
          code: promo.code,
          isActive: promo.isActive,
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue
        });
        return promo;
      }
      
      console.log('[promocodeApi] Промокод невалидный - отсутствует поле code:', promoData);
      return null;
    } catch (error) {
      console.error('[promocodeApi] Ошибка при получении реферального промокода:', error);
      if (error instanceof Error) {
        console.error('[promocodeApi] Детали ошибки:', {
          message: error.message,
          stack: error.stack
        });
      }
      return null;
    }
  }
};

