import { useEffect, useRef, useState, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { WebSocketProviderProps, WebSocketContextType } from './websocket-types';
import { registerHandlers, registerSupportAndPresenceHandlers } from './message-handlers';
import { websocketStore } from './websocket.store';
import { WebSocketContext, getWebSocketContextValue } from './useWebSocket';
import { websocketMonitor } from '@src/shared/lib/websocket-monitor';

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ url, children }) => {
    const user = useAppSelector(selectProfile);
    const dispatch = useAppDispatch();
    const initializedRef = useRef(false);
    const isAuthenticatedRef = useRef(false);
    const lastReconnectAttemptRef = useRef<number>(0);
    const disconnectRef = useRef(false);
    const RECONNECT_THROTTLE = 5000;

    useEffect(() => {
        disconnectRef.current = false;

        if (!initializedRef.current) {
            if (websocketStore.isConnected || websocketStore.isInitializing) {
                registerHandlers(websocketStore as any, dispatch);
                registerSupportAndPresenceHandlers(websocketStore as any);
                initializedRef.current = true;
                return;
            }
            
            websocketStore.initialize(url, dispatch);
            registerHandlers(websocketStore as any, dispatch);
            registerSupportAndPresenceHandlers(websocketStore as any);
            initializedRef.current = true;
        }

        // Интеграция с монитором веб-сокетов
        const handleConnectionStateChange = () => {
            // НЕ вызываем updateConnectionState здесь, чтобы избежать рекурсии
        };

        const checkAndReconnect = (source: string) => {
            const now = Date.now();
            if (now - lastReconnectAttemptRef.current <= RECONNECT_THROTTLE) {
                return;
            }

            const isStoreConnected = websocketStore.isConnected;
            const isClientConnected = websocketStore.client?.isConnected ?? false;
            const isActuallyConnected = isStoreConnected && isClientConnected;

            if (!isActuallyConnected && !websocketStore.isInitializing) {
                lastReconnectAttemptRef.current = now;
                if (websocketStore.client) {
                    websocketStore.reconnect();
                } else {
                    websocketStore.initialize(url, dispatch);
                }
            } else if (isActuallyConnected) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('requestCandleUpdate'));
                    window.dispatchEvent(new CustomEvent('websocketReconnected'));
                }, 500);
            }
        };

        const handlePageVisible = () => {
            checkAndReconnect('pageVisible');
        };

        const handlePageHidden = () => {
        };

        const handleCheckConnections = () => {
            checkAndReconnect('checkConnections');
        };

        // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования производительности
        // const handleWindowFocus = () => {
        //     checkAndReconnect('windowFocus');
        // };

        const unsubscribeVisibility = websocketMonitor.on('pageVisible', handlePageVisible);
        const unsubscribeHidden = websocketMonitor.on('pageHidden', handlePageHidden);
        const unsubscribeCheckConnections = websocketMonitor.on('checkConnections', handleCheckConnections);
        const unsubscribeConnectionState = websocketMonitor.on('connectionStateChange', handleConnectionStateChange);

        // window.addEventListener('focus', handleWindowFocus);

        const disposer = websocketStore.onMessage('error', (message) => {
            if (false) 
            websocketMonitor.incrementErrorCount();
        });

        handleConnectionStateChange();

        return () => {
            if (disconnectRef.current) {
                return;
            }
            disconnectRef.current = true;
            
            const timeoutId = setTimeout(() => {
                try {
                    if (!websocketStore.isConnected && !websocketStore.isInitializing) {
                        websocketStore.disconnect();
                    }
                } catch (error) {
                }
            }, 100);
            
            initializedRef.current = false;
            isAuthenticatedRef.current = false;
            disposer();
            unsubscribeVisibility();
            unsubscribeHidden();
            unsubscribeCheckConnections();
            unsubscribeConnectionState();
            
            return () => {
                clearTimeout(timeoutId);
            };
        };
    }, [url, dispatch]);

    const [storeState, setStoreState] = useState(() => ({
        isConnected: websocketStore.isConnected,
        error: websocketStore.error,
    }));

    // Подписка на изменения состояния WebSocket для своевременной установки userId
    useEffect(() => {
        const unsubscribe = websocketStore.subscribe(() => {
            setStoreState({
                isConnected: websocketStore.isConnected,
                error: websocketStore.error,
            });
        });

        return unsubscribe;
    }, []);

    // Устанавливаем userId как только он доступен, не дожидаясь установки соединения
    // Это гарантирует, что auth сообщение будет отправлено сразу после открытия соединения
    useEffect(() => {
        if (!user?.id) {
            return;
        }

        // Устанавливаем userId сразу, если он еще не установлен
        // Это позволит authenticateIfConnected() отправить auth сообщение при открытии соединения
        if (!websocketStore.hasUserId) {
            websocketStore.setUserId(user.id);
        }

        // Если соединение уже установлено, но пользователь не аутентифицирован, повторяем аутентификацию
        if (websocketStore.isConnected && !websocketStore.isAuthenticated && !isAuthenticatedRef.current) {
            websocketStore.setUserId(user.id);
            isAuthenticatedRef.current = true;
        }
    }, [user?.id, storeState.isConnected]);

    const baseContextValue = useMemo(() => getWebSocketContextValue(), []);

    const contextValue: WebSocketContextType = useMemo(() => ({
        ...baseContextValue,
        isConnected: storeState.isConnected,
        error: storeState.error,
    }), [baseContextValue, storeState.isConnected, storeState.error]);

    return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};