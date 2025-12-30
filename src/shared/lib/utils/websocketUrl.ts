export const getWebSocketUrl = (): string => {
    // Всегда используем полный URL из .env файла без нормализации
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (!envWsUrl || envWsUrl.trim().length === 0) {
        throw new Error('VITE_WS_URL должен быть указан в .env файле');
    }
    return envWsUrl.trim();
};

// Экспорт для обратной совместимости
export const websocketUrl = getWebSocketUrl;

