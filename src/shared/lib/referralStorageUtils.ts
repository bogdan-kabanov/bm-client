/**
 * Утилиты для сохранения реферального кода из URL в localStorage
 * Работает на всех страницах, сохраняет реферальный код даже при переходах по разным страницам
 */

import { decodeReferralHash } from './referralHashUtils';
import { decodePartnerRef } from './partnerReferralUtils';

/**
 * Сохраняет реферальный код из URL параметров в localStorage
 * Если в URL есть новый реферальный код, он перезапишет старый
 * 
 * @returns true если был найден и сохранен реферальный код
 */
export async function saveReferralCodeFromUrl(): Promise<boolean> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get('invite');
    const refParam = urlParams.get('ref');
    const promocodeParam = urlParams.get('promocode');
    
    // Сохраняем промокод, если он есть
    if (promocodeParam) {
      localStorage.setItem('referral_promocode', promocodeParam);
      if (import.meta.env.DEV) {
        console.log('[saveReferralCodeFromUrl] Промокод из URL сохранен:', promocodeParam);
      }
    }
    
    // Обрабатываем invite параметр (приоритет)
    if (inviteParam) {
      const refIdNum = decodeReferralHash(inviteParam);
      if (refIdNum) {
        localStorage.setItem('referral_id', String(refIdNum));
        // Очищаем партнерскую реферальную ссылку, т.к. приоритет у обычной реферальной ссылки
        localStorage.removeItem('partner_referral');
        if (import.meta.env.DEV) {
          console.log('[saveReferralCodeFromUrl] Реферальный код из invite сохранен:', refIdNum);
        }
        return true;
      }
    }
    
    // Обрабатываем ref параметр
    if (refParam) {
      // Сначала пытаемся декодировать как партнерскую ссылку
      try {
        const partnerRef = await decodePartnerRef(refParam);
        if (partnerRef) {
          // Это партнерская ссылка
          const partnerReferralData = {
            partner_id: partnerRef.partnerId || partnerRef.partner_id,
            referral_slug: partnerRef.referralSlug || partnerRef.referral_slug
          };
          localStorage.setItem('partner_referral', JSON.stringify(partnerReferralData));
          // Очищаем обычную реферальную ссылку
          localStorage.removeItem('referral_id');
          if (import.meta.env.DEV) {
            console.log('[saveReferralCodeFromUrl] Партнерская реферальная ссылка сохранена:', partnerReferralData);
          }
          return true;
        }
      } catch (error) {
        // Игнорируем ошибки декодирования партнерской ссылки
        if (import.meta.env.DEV) {
          console.warn('[saveReferralCodeFromUrl] Не удалось декодировать как партнерскую ссылку:', error);
        }
      }
      
      // Если не партнерская ссылка, пробуем как обычную реферальную ссылку
      const refIdNum = parseInt(refParam, 10);
      if (!isNaN(refIdNum) && refIdNum > 0) {
        localStorage.setItem('referral_id', String(refIdNum));
        // Очищаем партнерскую реферальную ссылку
        localStorage.removeItem('partner_referral');
        if (import.meta.env.DEV) {
          console.log('[saveReferralCodeFromUrl] Реферальный код из ref сохранен:', refIdNum);
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[saveReferralCodeFromUrl] Ошибка при сохранении реферального кода:', error);
    }
    return false;
  }
}

/**
 * Получает сохраненный реферальный ID из localStorage
 * @returns числовой ID реферала или undefined
 */
export function getSavedReferralId(): number | undefined {
  try {
    const savedRefId = localStorage.getItem('referral_id');
    if (savedRefId) {
      const refIdNum = parseInt(savedRefId, 10);
      if (!isNaN(refIdNum) && refIdNum > 0) {
        return refIdNum;
      }
    }
    return undefined;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[getSavedReferralId] Ошибка при получении реферального ID:', error);
    }
    return undefined;
  }
}

