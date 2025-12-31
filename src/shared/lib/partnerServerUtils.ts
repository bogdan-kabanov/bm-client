/**
 * Утилиты для работы с партнерским сервером
 * Все домены берутся из переменных окружения
 */

/**
 * Получает URL партнерского сервера из переменных окружения
 * @returns URL партнерского сервера или null если не настроен
 */
export function getPartnerServerUrl(): string | null {
  const partnerServerUrl = import.meta.env.VITE_PARTNER_SERVER_URL;
  
  if (!partnerServerUrl || partnerServerUrl.trim().length === 0) {
    return null;
  }
  
  return partnerServerUrl.trim();
}

/**
 * Получает домен партнерской программы из переменных окружения
 * @returns Домен партнерской программы или null если не настроен
 */
export function getPartnerDomain(): string | null {
  const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN;
  
  if (!partnerDomain || partnerDomain.trim().length === 0) {
    return null;
  }
  
  // Убираем протокол если есть
  return partnerDomain.replace(/^https?:\/\//, '').trim();
}

/**
 * Получает полный URL партнерской программы
 * @returns Полный URL партнерской программы или null если не настроен
 */
export function getPartnerProgramUrl(): string | null {
  const domain = getPartnerDomain();
  
  if (!domain) {
    return null;
  }
  
  // Определяем протокол на основе текущего хоста
  const isSecure = typeof window !== 'undefined' 
    ? window.location.protocol === 'https:'
    : true;
  
  const protocol = isSecure ? 'https://' : 'http://';
  return `${protocol}${domain}`;
}

