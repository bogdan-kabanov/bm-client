/**
 * Утилиты для работы с кодом трейдера
 * Поддерживает два формата:
 * - TRD формат: TRD2738 (отображаемый формат)
 * - Числовой формат: 1 (внутренний user_id)
 */

const TRD_PREFIX = 'TRD';
const TRD_OFFSET = 2737;

/**
 * Конвертирует user_id в TRD формат
 * @param userId - внутренний user_id
 * @returns TRD формат (например, TRD2738)
 */
export const userIdToTraderCode = (userId: number): string => {
  if (!userId || userId <= 0) {
    return String(userId);
  }
  return `${TRD_PREFIX}${Number(userId) + TRD_OFFSET}`;
};

/**
 * Конвертирует код трейдера (TRD формат или числовой) в user_id
 * @param code - код трейдера в любом формате (TRD2738 или 1)
 * @returns user_id (число) или null, если не удалось распарсить
 */
export const traderCodeToUserId = (code: string | number): number | null => {
  if (typeof code === 'number') {
    return code > 0 ? code : null;
  }

  if (!code || typeof code !== 'string') {
    return null;
  }

  const trimmedCode = code.trim().toUpperCase();

  // Если код начинается с TRD, извлекаем числовую часть
  if (trimmedCode.startsWith(TRD_PREFIX)) {
    const numberPart = trimmedCode.slice(TRD_PREFIX.length);
    const numericValue = parseInt(numberPart, 10);
    
    if (!isNaN(numericValue) && numericValue > TRD_OFFSET) {
      return numericValue - TRD_OFFSET;
    }
  }

  // Если код числовой, возвращаем как есть
  const numericCode = parseInt(trimmedCode, 10);
  if (!isNaN(numericCode) && numericCode > 0) {
    return numericCode;
  }

  return null;
};

/**
 * Нормализует код трейдера для отправки на сервер
 * Конвертирует TRD формат в user_id, оставляет числовой формат как есть
 * @param code - код трейдера в любом формате
 * @returns user_id в виде строки для отправки на сервер
 */
export const normalizeTraderCodeForServer = (code: string | number): string => {
  const userId = traderCodeToUserId(code);
  return userId !== null ? String(userId) : String(code);
};

/**
 * Проверяет, является ли код TRD форматом
 * @param code - код для проверки
 * @returns true, если код в TRD формате
 */
export const isTraderCodeFormat = (code: string | number): boolean => {
  if (typeof code === 'number') {
    return false;
  }
  return typeof code === 'string' && code.trim().toUpperCase().startsWith(TRD_PREFIX);
};

/**
 * Форматирует код трейдера для отображения (всегда в TRD формате)
 * @param code - код трейдера в любом формате (TRD3000+ или 1)
 * @returns TRD формат для отображения
 */
export const formatTraderCodeForDisplay = (code: string | number | null | undefined): string => {
  if (!code) {
    return '—';
  }
  
  // Если код уже в формате TRD, возвращаем как есть
  if (typeof code === 'string' && code.trim().toUpperCase().startsWith(TRD_PREFIX)) {
    return code.trim().toUpperCase();
  }
  
  // Если код числовой (старый формат), пытаемся конвертировать через старый offset
  // Но это временная мера для обратной совместимости
  const userId = traderCodeToUserId(code);
  if (userId !== null) {
    // Используем старый offset для обратной совместимости
    return userIdToTraderCode(userId);
  }
  
  // Если не удалось распарсить, возвращаем как есть
  return String(code);
};

