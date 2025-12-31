/**
 * Утилиты для работы с партнерскими реферальными ссылками
 */

import { getPartnerServerUrl } from './partnerServerUtils';

const ENCODING_KEY = 'partner-ref-2025';

/**
 * Декодирует токен партнерской ссылки обратно в параметры
 * Поддерживает два формата:
 * 1. Новый формат: короткий ID (3-6 цифр) - запрашивает данные через API
 * 2. Старый формат: base64 токен - декодирует локально
 */
export async function decodePartnerRef(token: string): Promise<{ 
    partnerId: number; 
    referralSlug: string;
    utmParams?: Record<string, string>;
} | null> {
    try {
        // Проверяем, является ли токен коротким ID (только цифры, 3-6 символов)
        const shortIdMatch = /^\d{3,6}$/.test(token);
        
        if (shortIdMatch) {
            // Новый формат: короткий ID - запрашиваем данные через API
            try {
                const partnerServerUrl = getPartnerServerUrl();
                
                // Если партнерский сервер не настроен в env, не делаем запрос
                if (!partnerServerUrl) {
                    if (import.meta.env.DEV) {
                        console.warn('[decodePartnerRef] VITE_PARTNER_SERVER_URL не настроен в .env файле');
                    }
                    return null;
                }
                
                const url = `${partnerServerUrl}/api/referrals/short/${token}`;

                console.log('[decodePartnerRef] Запрос информации о партнере:', url);
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                });
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    console.error('[decodePartnerRef] ❌ API вернул ошибку:', response.status, response.statusText, errorText);
                    return null;
                }
                
                const data = await response.json().catch((error) => {
                    console.error('[decodePartnerRef] ❌ Ошибка парсинга JSON:', error);
                    return null;
                });
                
                if (!data || !data.partnerId || !data.referralSlug) {
                    console.error('[decodePartnerRef] ❌ Неполные данные от API:', data);
                    return null;
                }
                
                console.log('[decodePartnerRef] ✅ Данные партнера получены:', {
                    partnerId: data.partnerId,
                    referralSlug: data.referralSlug
                });
                
                const utmParams: Record<string, string> = {};
                
                if (data.utm_source) utmParams.utm_source = data.utm_source;
                if (data.utm_medium) utmParams.utm_medium = data.utm_medium;
                if (data.utm_campaign) utmParams.utm_campaign = data.utm_campaign;
                if (data.utm_term) utmParams.utm_term = data.utm_term;
                if (data.utm_content) utmParams.utm_content = data.utm_content;
                if (data.utm_event) utmParams.utm_event = data.utm_event;
                if (data.utm_id) utmParams.utm_id = data.utm_id;
                if (data.utm_creative) utmParams.utm_creative = data.utm_creative;
                if (data.utm_placement) utmParams.utm_placement = data.utm_placement;
                if (data.utm_network) utmParams.utm_network = data.utm_network;
                if (data.utm_device) utmParams.utm_device = data.utm_device;
                if (data.utm_geo) utmParams.utm_geo = data.utm_geo;
                if (data.utm_language) utmParams.utm_language = data.utm_language;
                
                return {
                    partnerId: data.partnerId,
                    referralSlug: data.referralSlug,
                    utmParams: Object.keys(utmParams).length > 0 ? utmParams : undefined,
                };
            } catch (error) {
                console.error('[decodePartnerRef] ❌ Ошибка при запросе к API:', error);
                return null;
            }
        }
        
        // Старый формат: base64 токен - декодируем локально
        // Восстанавливаем замененные символы
        const restored = token.replace(/-/g, '+').replace(/_/g, '/');
        // Добавляем padding если нужно
        const padded = restored + '='.repeat((4 - (restored.length % 4)) % 4);
        const decoded = atob(padded);
        const parts = decoded.split('|');
        
        if (parts.length !== 2 || parts[1] !== ENCODING_KEY) {
            return null;
        }
        
        const [partnerIdStr, referralSlug] = parts[0].split(':');
        const partnerId = parseInt(partnerIdStr, 10);
        
        if (isNaN(partnerId) || !referralSlug) {
            return null;
        }
        
        return { partnerId, referralSlug, utmParams: undefined };
    } catch (error) {
        return null;
    }
}

export async function trackPartnerClick(partnerId: number, referralSlug: string, utmParams?: Record<string, string>) {
    try {
        // Используем apiClient для правильной обработки CORS и ошибок
        const { apiClient } = await import('@src/shared/api');
        const payload = {
            partnerId,
            referralSlug,
            ...utmParams,
        };

        if (import.meta.env.DEV) {
            console.log('[trackPartnerClick] Отправка запроса на отслеживание клика:', {
                payload: { ...payload, ...(utmParams || {}) }
            });
        }

        const result = await apiClient<{ success: boolean }>('/affiliate/click', {
            method: 'POST',
            body: payload,
            noAuth: true, // Этот эндпоинт не требует авторизации
        });

        if (import.meta.env.DEV) {
            console.log('[trackPartnerClick] ✅ Клик успешно отслежен:', result);
        }

        return true;
    } catch (error) {
        // Не логируем ошибки в production, чтобы не засорять консоль
        if (import.meta.env.DEV) {
            console.error('[trackPartnerClick] ❌ Ошибка при отслеживании клика:', error);
            if (error instanceof Error) {
                console.error('[trackPartnerClick] Детали ошибки:', error.message, error.stack);
            }
        }
        // Возвращаем false, но не прерываем работу приложения
        return false;
    }
}

/**
 * Регистрирует регистрацию пользователя по партнерской ссылке
 * Теперь это делается автоматически на сервере при регистрации, но оставляем для обратной совместимости
 */
export async function trackPartnerRegistration(
    partnerId: number,
    referralSlug: string,
    userId: number,
    email: string,
    phone?: string
) {
    // Регистрация теперь отслеживается автоматически на сервере при создании пользователя
    // Эта функция оставлена для обратной совместимости, но больше не вызывается

    return true;
}

