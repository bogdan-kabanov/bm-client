import { apiClient } from '../client';
import type { CurrencyCategory } from './types';

// Глобальный кеш для предотвращения множественных запросов
let globalCurrencyCache: CurrencyCategory[] | null = null;
let globalCurrencyCachePromise: Promise<CurrencyCategory[]> | null = null;
let globalCurrencyCacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

export const currencyApi = {
  getCurrenciesGrouped: async (): Promise<CurrencyCategory[]> => {
    const now = Date.now();
    
    // Если есть свежий кеш, возвращаем его
    if (globalCurrencyCache !== null && (now - globalCurrencyCacheTimestamp) < CACHE_TTL_MS) {
      return globalCurrencyCache;
    }
    
    // Если уже есть активный промис, ждем его
    if (globalCurrencyCachePromise !== null) {
      try {
        const result = await globalCurrencyCachePromise;
        return result;
      } catch (error) {
        // Если промис завершился с ошибкой, сбрасываем и пробуем снова
        globalCurrencyCachePromise = null;
      }
    }
    
    // Создаем новый промис для загрузки
    globalCurrencyCachePromise = (async (): Promise<CurrencyCategory[]> => {
      try {
        const response = await apiClient<{ success: boolean; data: CurrencyCategory[] }>('/currencies/public/grouped', {
          method: 'GET',
          noAuth: true,
        });
        
        // Обрабатываем ответ
        let categories: CurrencyCategory[] = [];
        if (Array.isArray(response)) {
          categories = response;
        } else if (response && typeof response === 'object') {
          // Проверяем разные варианты структуры ответа
          if ('data' in response && Array.isArray(response.data)) {
            categories = response.data;
          } else if ((response as any).data && Array.isArray((response as any).data)) {
            categories = (response as any).data;
          }
        }
        
        // Логируем результат для отладки
        if (categories.length === 0) {
          console.warn('[currencyApi] Получен пустой массив категорий валют', {
            responseType: typeof response,
            isArray: Array.isArray(response),
            hasData: response && typeof response === 'object' && 'data' in response,
            responseKeys: response && typeof response === 'object' ? Object.keys(response) : []
          });
        }
        
        // Сохраняем в кеш
        globalCurrencyCache = categories;
        globalCurrencyCacheTimestamp = Date.now();
        globalCurrencyCachePromise = null;
        
        return categories;
      } catch (error) {
        globalCurrencyCachePromise = null;
        throw error;
      }
    })();
    
    return globalCurrencyCachePromise;
  },
  
  // Функция для сброса кеша (если нужно)
  clearCache: () => {
    globalCurrencyCache = null;
    globalCurrencyCachePromise = null;
    globalCurrencyCacheTimestamp = 0;
  },
};
