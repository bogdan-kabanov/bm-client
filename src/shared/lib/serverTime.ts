import { timeApi } from '@src/shared/api';

// Храним последнее полученное время с сервера и время получения
let lastServerTime: number | null = null;
let lastServerTimeReceivedAt: number = 0;

// Получаем серверное время с интерполяцией
// Если время еще не получено, возвращаем текущее время клиента
// После получения времени с сервера, интерполируем его на основе прошедшего времени
export const getServerTime = (): number => {
    if (lastServerTime === null) {
        // Если время еще не получено, возвращаем текущее время клиента
        return Date.now();
    }
    
    // Интерполируем время: последнее_серверное_время + (текущее_время_клиента - время_получения)
    const elapsed = Date.now() - lastServerTimeReceivedAt;
    return lastServerTime + elapsed;
};

// Устанавливаем время с сервера
export const setServerTime = (serverTime: number): void => {
    lastServerTime = serverTime;
    lastServerTimeReceivedAt = Date.now();
    // Логирование удалено для уменьшения шума в консоли
};

// Получаем время с сервера через HTTP
export const syncServerTime = async (): Promise<void> => {
    try {
        const clientTimeBefore = Date.now();
        const data = await timeApi.getServerTime();
        const clientTimeAfter = Date.now();
        const networkLatency = (clientTimeAfter - clientTimeBefore) / 2;
        
        // Используем время с сервера + половина задержки сети
        const serverTime = (data.timestamp || data.time || Date.now()) + networkLatency;
        setServerTime(serverTime);
    } catch (error) {
        // Тихо игнорируем ошибки синхронизации времени в продакшн
        // В dev режиме логируем только первые несколько ошибок, чтобы не засорять консоль
        if (import.meta.env.DEV) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Логируем только ошибки, не связанные с таймаутом (они частые и не критичны)
            if (!errorMessage.includes('timeout') && !errorMessage.includes('TIMEOUT')) {
                console.warn('[serverTime] ⚠️ Ошибка при получении времени с сервера:', error);
            }
        }
    }
};

// Устанавливаем время из WebSocket или HTTP ответа
export const syncServerTimeFromWebSocket = (serverTime: number): void => {
    setServerTime(serverTime);
};

// Инициализация синхронизации времени
export const initServerTimeSync = (): void => {
    // Получаем время с сервера сразу при инициализации
    syncServerTime().then(() => {
        // Обновляем время каждые 10 секунд
        setInterval(() => {
            syncServerTime();
        }, 10000);
    }).catch(() => {
        // Если не удалось, все равно запускаем периодическую синхронизацию
        setInterval(() => {
            syncServerTime();
        }, 10000);
    });
};

