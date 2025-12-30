import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { WebSocketMessage } from './websocket-types';
import { TradingWebSocketClient } from './trading-websocket-client';
import { getWebSocketUrl } from '@src/shared/lib/utils/websocketUrl';

export interface UseTradingWebSocketReturn {
    isConnected: boolean;
    isAuthenticated: boolean;
    isReady: boolean;
    sendMessage: (message: WebSocketMessage) => void;
    onMessage: (messageType: string, handler: (message: WebSocketMessage) => void) => () => void;
    error: string | null;
}

/**
 * Хук для использования WebSocket соединения на торговой странице
 * Обеспечивает отдельное, отказоустойчивое соединение с ping-pong
 */
export const useTradingWebSocket = (): UseTradingWebSocketReturn => {
    const user = useAppSelector(selectProfile);
    const clientRef = useRef<TradingWebSocketClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handlersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(new Map());
    const isInitializedRef = useRef(false);
    const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Получаем URL WebSocket
    const wsUrl = useMemo(() => {
        try {
            return getWebSocketUrl();
        } catch (err) {
            return '';
        }
    }, []);

    // Инициализация клиента
    useEffect(() => {
        if (!wsUrl || isInitializedRef.current) {
            return;
        }

        try {
            isInitializedRef.current = true;
            
            const client = new TradingWebSocketClient(wsUrl);
            clientRef.current = client;

            // Подписываемся на изменения состояния соединения
            const checkConnection = () => {
                try {
                    const connected = client.isConnected;
                    const ready = client.isReady;
                    setIsConnected(prev => {
                        if (prev !== connected) {
                            if (connected) {
                                setError(null);
                            }
                            return connected;
                        }
                        return prev;
                    });
                    setIsReady(ready);
                    setIsAuthenticated(connected);
                } catch (err) {
                    // Ошибка проверки соединения
                }
            };

            // Подписываемся на события WebSocket для мгновенного обновления состояния
            const onOpen = () => {
                console.log('[useTradingWebSocket] ✅ WebSocket OPEN - immediately updating state');
                checkConnection();
            };
            
            const onClose = () => {
                console.log('[useTradingWebSocket] ❌ WebSocket CLOSE - immediately updating state');
                checkConnection();
            };

            // Добавляем слушатели событий для мгновенного обновления
            if (client.ws) {
                client.ws.addEventListener('open', onOpen);
                client.ws.addEventListener('close', onClose);
            }

            // Проверяем соединение каждые 500ms для более быстрой реакции (было 2000ms)
            connectionCheckIntervalRef.current = setInterval(checkConnection, 500);

            // Подключаемся
            client.connect()
                .then(() => {
                    checkConnection();
                })
                .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Ошибка подключения');
                    setIsConnected(false);
                    setIsAuthenticated(false);
                });

            return () => {
                // Удаляем слушатели событий
                if (client.ws) {
                    client.ws.removeEventListener('open', onOpen);
                    client.ws.removeEventListener('close', onClose);
                }
                try {
                    if (connectionCheckIntervalRef.current) {
                        clearInterval(connectionCheckIntervalRef.current);
                        connectionCheckIntervalRef.current = null;
                    }
                    if (client) {
                        client.disconnect();
                    }
                    handlersRef.current.clear();
                    isInitializedRef.current = false;
                } catch (err) {
                    // Ошибка при очистке
                }
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка инициализации');
        }
        // Убираем isConnected из зависимостей, чтобы избежать бесконечных переподключений
         
    }, [wsUrl]);

    // Установка userId при изменении пользователя
    useEffect(() => {
        if (clientRef.current && user?.id) {
            try {
                clientRef.current.setUserId(user.id);
            } catch (err) {
                // Ошибка установки userId
            }
        }
    }, [user?.id]);

    // Функция отправки сообщения
    const sendMessage = useCallback((message: WebSocketMessage) => {
        try {
            if (!clientRef.current) {
                throw new Error('WebSocket client not initialized');
            }

            if (!clientRef.current.isConnected) {
                // Сообщение будет добавлено в очередь внутри клиента
            }

            clientRef.current.send(message);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка отправки сообщения');
            throw err;
        }
    }, []);

    // Функция подписки на сообщения
    const onMessage = useCallback((messageType: string, handler: (message: WebSocketMessage) => void) => {
        try {
            if (!clientRef.current) {
                return () => {};
            }

            // Сохраняем обработчик в ref для последующего удаления
            if (!handlersRef.current.has(messageType)) {
                handlersRef.current.set(messageType, new Set());
            }
            handlersRef.current.get(messageType)!.add(handler);

            // Регистрируем обработчик в клиенте
            clientRef.current.on(messageType, handler);

            // Возвращаем функцию отписки
            return () => {
                try {
                    if (clientRef.current) {
                        clientRef.current.off(messageType, handler);
                    }
                    const handlers = handlersRef.current.get(messageType);
                    if (handlers) {
                        handlers.delete(handler);
                        if (handlers.size === 0) {
                            handlersRef.current.delete(messageType);
                        }
                    }
                } catch (err) {
                    // Ошибка при отписке
                }
            };
        } catch (err) {
            return () => {};
        }
    }, []);

    return useMemo(() => ({
        isConnected,
        isAuthenticated,
        isReady,
        sendMessage,
        onMessage,
        error,
    }), [isConnected, isAuthenticated, isReady, sendMessage, onMessage, error]);
};

