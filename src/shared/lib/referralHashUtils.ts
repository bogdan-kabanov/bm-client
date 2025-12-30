/**
 * Утилиты для работы с реферальными хешами
 * Генерирует хеш из user_id для использования в реферальных ссылках
 */

const REFERRAL_SALT = 'ref_salt_2024';
const REFERRAL_PREFIX = 'REF';

/**
 * Генерирует реферальный хеш из user_id
 * @param userId - ID пользователя
 * @returns Реферальный хеш (например, REFaGVsbG8=)
 */
export const generateReferralHash = (userId: number): string => {
  if (!userId || userId <= 0) {
    return String(userId);
  }
  
  // Создаем строку с ID и солью
  const data = `${userId}_${REFERRAL_SALT}`;
  
  // Кодируем в base64
  const encoded = btoa(data);
  
  // Добавляем префикс
  return `${REFERRAL_PREFIX}${encoded}`;
};

/**
 * Декодирует реферальный хеш обратно в user_id
 * @param hash - Реферальный хеш (например, REFaGVsbG8=)
 * @returns user_id (число) или null, если не удалось декодировать
 */
export const decodeReferralHash = (hash: string): number | null => {
  if (!hash) {
    return null;
  }
  
  // Если это простой числовой ID (старый формат), возвращаем его
  const numericId = parseInt(hash, 10);
  if (!isNaN(numericId) && numericId > 0) {
    return numericId;
  }
  
  // Проверяем префикс
  if (!hash.startsWith(REFERRAL_PREFIX)) {
    return null;
  }
  
  try {
    // Убираем префикс
    const encoded = hash.substring(REFERRAL_PREFIX.length);
    
    // Декодируем из base64
    const decoded = atob(encoded);
    
    // Извлекаем ID (формат: "123_ref_salt_2024")
    const parts = decoded.split('_');
    if (parts.length < 2) {
      return null;
    }
    
    const userId = parseInt(parts[0], 10);
    if (isNaN(userId) || userId <= 0) {
      return null;
    }
    
    // Проверяем соль
    const salt = parts.slice(1).join('_');
    if (salt !== REFERRAL_SALT) {
      return null;
    }
    
    return userId;
  } catch (error) {
    // Если не удалось декодировать, возвращаем null
    return null;
  }
};

