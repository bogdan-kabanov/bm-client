import { WebSocketClient } from './websocket-client';
import { WebSocketMessage } from './websocket-types';
import { registerHandlers } from './message-handlers';
import { AppDispatch } from '@src/app/store';
import { websocketMonitor } from '@src/shared/lib/websocket-monitor';

type Listener = () => void;

export class WebSocketStore {
    client: WebSocketClient | null = null;
    isConnected = false;
    error: string | null = null;
    isInitializing = false;
    isAuthenticated = false;
    private userId: number | null = null;
    private pendingHandlers: Array<{ type: string; handler: (message: WebSocketMessage) => void }> = [];
    private currentUrl: string | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private dispatch: AppDispatch | null = null;
    private pendingOutboundMessages: WebSocketMessage[] = [];
    private static readonly MAX_PENDING_MESSAGES = 50;
    private listeners = new Set<Listener>();
    private connectionCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Не запускаем проверку соединения до инициализации
        // startConnectionCheck будет вызван в initialize() если есть токен
    }

    private startConnectionCheck(): void {
        // Connection check disabled for performance
        return;

        this.connectionCheckInterval = setInterval(() => {
            if (this.client) {
                const wasConnected = this.isConnected;
                const isNowConnected = (this.client as any).isConnected;

                if (wasConnected !== isNowConnected) {
                    this.isConnected = isNowConnected;
                    
                    if (isNowConnected) {
                        this.error = null;
                        this.isInitializing = false;
                        websocketMonitor.updateConnectionState('connected');
                        
                        if (this.dispatch && !this.pendingHandlers.length) {
                            registerHandlers(this, this.dispatch);
                        }

                        const customQuoteHandlers = this.pendingHandlers.filter(h => h.type === 'custom_quote');
                        this.pendingHandlers.forEach(({ type, handler }) => {
                            (this.client as any)?.on(type, handler);
                        });
                        this.pendingHandlers = [];

                        if (this.userId) {
                            this.authenticate(this.userId);
                        }

                        if (typeof window !== 'undefined') {
                            setTimeout(() => {
                                if (this.isConnected) {
                                    window.dispatchEvent(new CustomEvent('websocketReconnected'));
                                }
                            }, 500);
                        }
                    } else {
                        websocketMonitor.updateConnectionState('disconnected');
                    }
                    
                    this.notify();
                }
            }
        }, 10000);
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private lastNotifyState: { isConnected: boolean; error: string | null } = { isConnected: false, error: null };

    private notify(): void {
        const currentState = { isConnected: this.isConnected, error: this.error };
        // Уведомляем только если состояние действительно изменилось
        if (currentState.isConnected !== this.lastNotifyState.isConnected || 
            currentState.error !== this.lastNotifyState.error) {
            this.lastNotifyState = { ...currentState };
            this.listeners.forEach(listener => listener());
        }
    }

    initialize(url: string, dispatch: AppDispatch): void {
        const token = localStorage.getItem('token');
        if (!token) {
            this.error = 'Authentication required';
            this.notify();
            return;
        }

        if (this.isDisconnecting) {
            return;
        }

        if (this.client && this.isConnected && this.currentUrl === url && (this.client as any).isConnected) {
            return;
        }

        if (this.isInitializing && this.currentUrl === url) {
            return;
        }
        
        this.isDisconnecting = false;

        // Always use full URL from .env file without normalization
        const envWsUrl = import.meta.env.VITE_WS_URL;
        if (!envWsUrl || envWsUrl.trim().length === 0) {
            throw new Error('VITE_WS_URL must be specified in .env file');
        }
        const normalizedUrl = envWsUrl.trim();

        this.isInitializing = true;
        this.currentUrl = normalizedUrl;
        this.dispatch = dispatch;
        this.notify();
        
        // Запускаем проверку соединения только если есть токен
        if (!this.connectionCheckInterval) {
            this.startConnectionCheck();
        }

        if (this.client) {
            this.disconnect();
        }

        const wsUrl = normalizedUrl;
        this.isAuthenticated = false;
        this.pendingOutboundMessages = [];

        this.client = new WebSocketClient(wsUrl);

        this.client.connect()
            .then(() => {
                this.isConnected = true;
                this.isInitializing = false;
                this.error = null;
                this.notify();
                websocketMonitor.updateConnectionState('connected');

                if (this.dispatch) {
                    registerHandlers(this, this.dispatch);
                }

                const customQuoteHandlers = this.pendingHandlers.filter(h => h.type === 'custom_quote');
                this.pendingHandlers.forEach(({ type, handler }) => {
                    (this.client as any)?.on(type, handler);
                });
                this.pendingHandlers = [];

                if (this.userId) {
                    this.authenticate(this.userId);
                }

                if (typeof window !== 'undefined') {
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('websocketReconnected'));
                    }, 500);
                }
            })
            .catch(error => {
                this.error = error instanceof Error ? error.message : 'Unknown error';
                this.isConnected = false;
                this.isInitializing = false;
                this.notify();
                websocketMonitor.updateConnectionState('error');
                
                if (!this.reconnectTimeout && this.currentUrl && this.dispatch) {
                    this.reconnectTimeout = setTimeout(() => {
                        this.reconnectTimeout = null;
                        if (this.currentUrl && this.dispatch && !this.isInitializing && !this.isConnected) {
                            this.initialize(this.currentUrl, this.dispatch);
                        }
                    }, 2000);
                }
            });
    }

    setUserId(userId: number): void {
        this.userId = userId;
        this.isAuthenticated = false;
        this.notify();
        if (this.client && this.isConnected) {
            this.authenticate(userId);
        }
    }

    setAuthenticated(value: boolean): void {
        const wasAuthenticated = this.isAuthenticated;
        console.log(`[WebSocketStore] 🔐 setAuthenticated вызван: ${value}`, {
            wasAuthenticated,
            willBeAuthenticated: value,
            hasClient: !!this.client,
            isConnected: this.isConnected,
            pendingMessagesCount: this.pendingOutboundMessages.length
        });
        this.isAuthenticated = value;
        this.notify();
        
        // Если аутентификация успешна, отправляем сообщения из очереди
        if (value && !wasAuthenticated && this.pendingOutboundMessages.length > 0) {
            console.log(`[WebSocketStore] 📤 Отправка ${this.pendingOutboundMessages.length} сообщений из очереди после аутентификации`);
            const messagesToSend = [...this.pendingOutboundMessages];
            this.pendingOutboundMessages = [];
            messagesToSend.forEach(msg => {
                if (msg.type === 'place-trade') {
                    console.log(`[WebSocketStore] 📤 Отправка отложенного place-trade сообщения:`, msg);
                }
                try {
                    if (this.client && this.isConnected && (this.client as any).isConnected) {
                        (this.client as any).send(msg);
                    } else {
                        console.warn(`[WebSocketStore] ⚠️ Не удалось отправить сообщение из очереди: WebSocket не подключен`);
                        // Возвращаем сообщение в очередь, если соединение потеряно
                        this.pendingOutboundMessages.push(msg);
                    }
                } catch (error) {
                    console.error(`[WebSocketStore.setAuthenticated] ❌ Ошибка отправки отложенного сообщения:`, error);
                    // Возвращаем сообщение в очередь при ошибке
                    this.pendingOutboundMessages.push(msg);
                }
            });
        }
    }

    authenticate(userId: number): void {
        if (this.client) {
            this.client.setUserId(userId);
        }
    }

    sendMessage(message: WebSocketMessage): void {
        // Логируем place-trade сообщения для отладки
        if (message.type === 'place-trade') {
            console.log(`[WebSocketStore] 📤 ========== SENDING place-trade MESSAGE ==========`);
            console.log(`[WebSocketStore] 📤 sendMessage вызван для place-trade:`, {
                message,
                hasClient: !!this.client,
                isConnected: this.isConnected,
                clientReadyState: this.client ? (this.client as any).ws?.readyState : 'no client',
                dataId: message.data?.id,
                dataIdType: typeof message.data?.id
            });
        }
        try {
            if (this.client && this.isConnected && (this.client as any).isConnected) {
                if (message.type !== 'auth' && !this.isAuthenticated) {
                    if (message.type === 'place-trade') {
                        console.warn(`[WebSocketStore] ⚠️ place-trade сообщение добавлено в очередь (не аутентифицирован):`, {
                            isAuthenticated: this.isAuthenticated,
                            pendingMessagesCount: this.pendingOutboundMessages.length
                        });
                    }
                    if (this.pendingOutboundMessages.length >= WebSocketStore.MAX_PENDING_MESSAGES) {
                        this.pendingOutboundMessages.shift();
                    }
                    this.pendingOutboundMessages.push(message);
                    return;
                }
                
                if (message.type === 'place-trade') {
                    console.log(`[WebSocketStore] ✅ Отправка place-trade через WebSocketClient:`, {
                        isAuthenticated: this.isAuthenticated,
                        isConnected: this.isConnected
                    });
                }
                
                (this.client as any).send(message);
            } else {
                this.isConnected = false;
                this.notify();

                if (this.pendingOutboundMessages.length >= WebSocketStore.MAX_PENDING_MESSAGES) {
                    this.pendingOutboundMessages.shift();
                }
                this.pendingOutboundMessages.push(message);

                if (!this.isInitializing) {
                    if (this.client) {
                        this.reconnect();
                    } else if (this.currentUrl && this.dispatch) {
                        const queuedMessages = [...this.pendingOutboundMessages];
                        this.initialize(this.currentUrl, this.dispatch);
                        this.pendingOutboundMessages = queuedMessages;
                    }
                }
            }
        } catch (error) {
            console.error('[WebSocketStore.sendMessage] Ошибка отправки сообщения:', error);
        }
    }

    onMessage(messageType: string, handler: (message: WebSocketMessage) => void): () => void {
        if (this.client && this.isConnected) {
            (this.client as any).on(messageType, handler);
            return () => {
                (this.client as any)?.off(messageType, handler);
            };
        } else {
            this.pendingHandlers.push({ type: messageType, handler });
            return () => {
                const index = this.pendingHandlers.findIndex(h => h.type === messageType && h.handler === handler);
                if (index !== -1) {
                    this.pendingHandlers.splice(index, 1);
                }
            };
        }
    }

    private isDisconnecting = false;

    disconnect(): void {
        if (this.isDisconnecting) {
            return;
        }
        
        this.isDisconnecting = true;
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }

        try {
            if (this.client) {
                const client = this.client;
                this.client = null;
                try {
                    (client as any).disconnect();
                } catch (disconnectError) {
                    if (disconnectError instanceof Error && !disconnectError.message.includes('closed before the connection')) {
                        console.error('[WebSocketStore.disconnect] Ошибка при отключении:', disconnectError);
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && !error.message.includes('closed before the connection')) {
                console.error('[WebSocketStore.disconnect] Ошибка:', error);
            }
        }
        
        this.isConnected = false;
        this.isInitializing = false;
        this.currentUrl = null;
        this.isAuthenticated = false;
        websocketMonitor.updateConnectionState('disconnected');
        this.client = null;
        this.userId = null;
        this.dispatch = null;
        this.pendingHandlers = [];
        this.pendingOutboundMessages = [];
        this.notify();
        
        // Не перезапускаем проверку соединения при отключении без токена
        // this.startConnectionCheck();
        this.isDisconnecting = false;
    }

    reconnect(): void {
        if (this.currentUrl && this.dispatch) {
            (this.client as any)?.reconnect();
        }
    }

    retryAuthentication(): void {
        if (this.userId) {
            this.isAuthenticated = false;
            this.notify();
            this.authenticate(this.userId);
        }
    }

    get hasUserId(): boolean {
        return this.userId !== null;
    }
}

export const websocketStore = new WebSocketStore();