import { getApiBaseUrl } from '@src/shared/api/client';

export const ensureHttps = (url?: string | null): string | null => {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // Если уже абсолютный URL (http:// или https://), обрабатываем протокол
  if (trimmed.startsWith('//')) {
    // Для localhost оставляем http://, для остальных используем https://
    const urlLower = trimmed.toLowerCase();
    if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1')) {
      return `http:${trimmed}`;
    }
    return `https:${trimmed}`;
  }

  if (trimmed.toLowerCase().startsWith('http://')) {
    const urlLower = trimmed.toLowerCase();
    // Для localhost оставляем http://, для остальных преобразуем в https://
    if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1')) {
      return trimmed;
    }
    return `https://${trimmed.slice(7)}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Для localhost оставляем как есть, даже если это http://
    const urlLower = trimmed.toLowerCase();
    if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1')) {
      return trimmed;
    }
    return trimmed;
  }

  // Если относительный путь, нужно добавить базовый URL API
  if (typeof window !== 'undefined' && trimmed.startsWith('/')) {
    try {
      const baseUrl = getApiBaseUrl();
      // Если путь начинается с /v3/, убираем префикс /v3, так как baseUrl уже содержит /api (который соответствует /v3)
      if (trimmed.startsWith('/v3/')) {
        const pathWithoutV3 = trimmed.replace(/^\/v3/, '');
        return `${baseUrl}${pathWithoutV3}`;
      }
      // Для путей /uploads/... добавляем baseUrl
      if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/support/')) {
        return `${baseUrl}${trimmed}`;
      }
      // Для остальных относительных путей просто добавляем baseUrl
      return `${baseUrl}${trimmed}`;
    } catch (error) {
      console.error('Error getting API base URL:', error);
      return trimmed;
    }
  }

  return trimmed;
};

