import { WebSocketMessage } from './websocket-types';

export type TradingMessageHandler = (message: WebSocketMessage) => void;

/**
 * Отдельный WebSocket клиент для торговой страницы
 * С максимальной отказоустойчивостью, ping-pong и логированием
 */
export class TradingWebSocketClient {
    private ws: WebSocket | null = null;
    private messageHandlers: Map<string, TradingMessageHandler[]> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = Infinity;
    private userId: number | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnecting = false;
    private isDisconnecting = false;
    private connectionStartTime: number | null = null;
    private connectPromise: { resolve: () => void; reject: (error: Error) => void } | null = null;
    private lastMessageTime: number | null = null;
    private shouldReconnect = true;
    private pingInterval: NodeJS.Timeout | null = null;
    private pongTimeout: NodeJS.Timeout | null = null;
    private lastPongTime: number | null = null;
    private pendingMessages: WebSocketMessage[] = [];
    private isAuthenticated = false;
    
    // Константы для ping-pong
    private readonly PING_INTERVAL = 30000; // 30 секунд
    private readonly PONG_TIMEOUT = 15000; // 15 секунд - ожидание ответа на ping (увеличен для надежности)
    private readonly MAX_PONG_DELAY = 45000; // 45 секунд - максимальная задержка между pong (увеличен)
    
    // Константы для переподключения
    private readonly MIN_RECONNECT_INTERVAL = 2000;
    private readonly MAX_RECONNECT_INTERVAL = 30000;
    private readonly INITIAL_RECONNECT_DELAY = 2000;
    private lastReconnectAttempt: number = 0;
    
    constructor(private url: string) {
        this.url = this.normalizeUrl(url);
    }

    private normalizeUrl(url: string): string {
        try {
            // Если URL уже полный (начинается с ws:// или wss://), возвращаем как есть без изменений
            if (url && (url.startsWith('ws://') || url.startsWith('wss://'))) {
                return url;
            }

            // Используем полный URL из .env файла
            const envWsUrl = import.meta.env.VITE_WS_URL;
            if (!envWsUrl || envWsUrl.trim().length === 0) {
                throw new Error('VITE_WS_URL должен быть указан в .env файле');
            }
            return envWsUrl.trim();
        } catch (error) {
            return url;
        }
    }

    setUserId(id: number): void {
        try {
            this.userId = id;
            this.authenticateIfConnected();
        } catch (error) {
            // Ошибка установки userId
        }
    }

    connect(): Promise<void> {
        if (this.isConnecting || this.isDisconnecting) {
            if (this.connectPromise) {
                
                return Promise.resolve();
            }
            return Promise.reject(new Error('Connection in progress or disconnecting'));
        }

        this.isConnecting = true;
        this.isDisconnecting = false;
        this.connectionStartTime = Date.now();
        
        
        return new Promise((resolve, reject) => {
            try {
                this.connectPromise = { resolve, reject };
                
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    try {
                        const connectionTime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
                        
                        
                        this.isConnecting = false;
                        this.reconnectAttempts = 0;
                        this.shouldReconnect = true;
                        this.lastMessageTime = Date.now();
                        this.lastPongTime = Date.now();
                        
                        if (this.reconnectTimeout) {
                            clearTimeout(this.reconnectTimeout);
                            this.reconnectTimeout = null;
                        }
                        
                        this.startPingPong();
                        this.authenticateIfConnected();
                        
                        // Отправляем накопленные сообщения после небольшой задержки
                        // (чтобы аутентификация успела завершиться)
                        setTimeout(() => {
                            this.flushPendingMessages();
                        }, 200);
                        
                        if (this.connectPromise) {
                            this.connectPromise.resolve();
                            this.connectPromise = null;
                        }
                    } catch (error) {
                        if (this.connectPromise) {
                            this.connectPromise.reject(error instanceof Error ? error : new Error(String(error)));
                            this.connectPromise = null;
                        }
                    }
                };

                this.ws.onmessage = (event) => {
                    try {
                        this.lastMessageTime = Date.now();
                        
                        // Преобразуем данные в строку если нужно (для совместимости с Buffer)
                        let dataStr: string;
                        if (typeof event.data === 'string') {
                            dataStr = event.data;
                        } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                            // Для ArrayBuffer и Blob используем FileReader (но это редко для WebSocket)
                            
                            return;
                        } else {
                            // Для других типов (Buffer в Node.js, но в браузере это не должно происходить)
                            dataStr = String(event.data);
                        }
                        
                        // Обработка pong (текстовое сообщение) - соответствует серверной логике
                        if (dataStr === 'pong' || dataStr.trim() === 'pong') {
                            
                            this.handlePong();
                            return;
                        }
                        
                        // Обработка JSON сообщений
                        let message: WebSocketMessage;
                        try {
                            message = JSON.parse(dataStr);
                        } catch (parseError) {
                            // Если не JSON и не 'pong', логируем ошибку
                            return;
                        }
                        
                        // Обработка ответа на ping (JSON формат) - соответствует серверной логике
                        if (message.type === 'pong') {
                            
                            this.handlePong();
                            return;
                        }
                        
                        // Обработка приветственного сообщения при подключении
                        if (message.type === 'connected') {
                            // Сервер подтвердил подключение, можно начинать аутентификацию
                            if (this.userId) {
                                this.authenticateIfConnected();
                            }
                            // Продолжаем обработку через handleMessage
                            this.handleMessage(message);
                            return;
                        }
                        
                        // Обработка ответа на аутентификацию
                        if (message.type === 'auth_success') {
                            const authResponse = message as any;
                            this.isAuthenticated = true;
                            // Небольшая задержка перед отправкой накопленных сообщений
                            setTimeout(() => {
                                this.flushPendingMessages();
                            }, 100);
                            // Продолжаем обработку через handleMessage
                            this.handleMessage(message);
                            return;
                        }
                        
                        // Обработка ошибок от сервера
                        if (message.type === 'error') {
                            const errorMessage = message as any;
                            
                            
                            // Если ошибка связана с аутентификацией, сбрасываем флаг
                            if (errorMessage.message && (
                                errorMessage.message.includes('аутентификац') || 
                                errorMessage.message.includes('токен') ||
                                errorMessage.message.includes('сессия')
                            )) {
                                this.isAuthenticated = false;
                                this.pendingMessages = [];
                            }
                            // Продолжаем обработку через handleMessage
                            this.handleMessage(message);
                            return;
                        }
                        
                        // Обработка других сообщений
                        // Log all incoming messages for debugging
                        if (message.type === 'trade_placed') {
                            console.log('[TradingWebSocketClient] 📥 ========== RECEIVED trade_placed IN ONMESSAGE ==========');
                            console.log('[TradingWebSocketClient] 📥 Received trade_placed in onmessage', {
                                message,
                                hasType: !!message.type,
                                type: message.type,
                                hasSuccess: (message as any).success,
                                hasData: !!(message as any).data,
                                messageStr: dataStr,
                                rawData: event.data
                            });
                        }
                        this.handleMessage(message);
                    } catch (error) {
                        // Ошибка обработки сообщения
                        if (message?.type === 'trade_placed') {
                            console.error('[TradingWebSocketClient] ❌ Error processing trade_placed message', error);
                        }
                    }
                };

                this.ws.onclose = (event) => {
                    try {
                        
                        
                        const wasConnecting = this.isConnecting;
                        this.isConnecting = false;
                        this.isAuthenticated = false;
                        this.stopPingPong();
                        
                        const ws = this.ws;
                        const wasOpen = ws?.readyState === WebSocket.OPEN;
                        const wasDisconnecting = !this.shouldReconnect;
                        this.ws = null;
                        
                        if (wasConnecting && this.connectPromise && !wasOpen && !wasDisconnecting) {
                            try {
                                const errorMessage = event.reason || `Connection closed with code ${event.code}`;
                                
                                if (event.code !== 1000 || !errorMessage.includes('closed before the connection')) {
                                    this.connectPromise.reject(new Error(`WebSocket closed before connection: ${errorMessage}`));
                                } else {
                                    this.connectPromise.reject(new Error(`WebSocket connection cancelled`));
                                }
                            } catch (error) {
                                if (this.connectPromise) {
                                    try {
                                        this.connectPromise.reject(new Error('WebSocket connection error'));
                                    } catch {
                                        // Игнорируем ошибки при отклонении
                                    }
                                }
                            }
                            this.connectPromise = null;
                        } else if (wasDisconnecting && this.connectPromise) {
                            this.connectPromise = null;
                        }
                        
                        if (this.shouldReconnect && event.code !== 1000) {
                            
                            setTimeout(() => {
                                if (this.shouldReconnect && !this.isConnected && !this.isConnecting) {
                                    this.tryReconnect(event.code);
                                }
                            }, 500);
                        }
                    } catch (error) {
                    }
                };

                this.ws.onerror = (error) => {
                    try {
                        
                        const wasConnecting = this.isConnecting;
                        this.isConnecting = false;
                        
                        const currentState = this.ws?.readyState;
                        const isClosed = currentState === WebSocket.CLOSED || currentState === WebSocket.CLOSING;
                        
                        if (wasConnecting && this.connectPromise && currentState !== WebSocket.OPEN) {
                            if (!isClosed) {
                                setTimeout(() => {
                                    if (this.connectPromise && this.ws?.readyState !== WebSocket.OPEN) {
                                        
                                        this.connectPromise.reject(new Error('WebSocket connection error'));
                                        this.connectPromise = null;
                                    }
                                }, 100);
                            } else {
                                this.connectPromise.reject(new Error('WebSocket connection error'));
                                this.connectPromise = null;
                            }
                        }
                        
                        if (isClosed && this.shouldReconnect) {
                            setTimeout(() => {
                                if (this.shouldReconnect && !this.isConnected && !this.isConnecting) {
                                    if (this.ws) {
                                        try {
                                            this.ws.close();
                                        } catch (e) {
                                            // Игнорируем ошибки при закрытии
                                        }
                                        this.ws = null;
                                    }
                                    this.tryReconnect(0);
                                }
                            }, 1000);
                        }
                    } catch (error) {
                    }
                };
            } catch (error) {
                this.isConnecting = false;
                if (this.connectPromise) {
                    this.connectPromise.reject(error instanceof Error ? error : new Error(String(error)));
                    this.connectPromise = null;
                }
            }
        });
    }

    private startPingPong(): void {
        try {
            this.stopPingPong();
            
            const ws = this.ws;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                
                return;
            }
            
            
            // Отправляем первый ping сразу после подключения (с небольшой задержкой)
            setTimeout(() => {
                if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
                    this.sendPing();
                }
            }, 500);
            
            // Устанавливаем интервал для регулярных ping
            this.pingInterval = setInterval(() => {
                try {
                    const ws = this.ws;
                    // Проверяем только readyState, не isConnected
                    if (ws && ws.readyState === WebSocket.OPEN && this.shouldReconnect) {
                        this.sendPing();
                    } else {
                    }
                } catch (error) {
                }
            }, this.PING_INTERVAL);
            
            // Проверяем, не слишком ли долго не было pong
            const pongCheckInterval = setInterval(() => {
                try {
                    const ws = this.ws;
                    // Проверяем только readyState, не isConnected
                    if (!ws || ws.readyState !== WebSocket.OPEN || !this.shouldReconnect) {
                        clearInterval(pongCheckInterval);
                        return;
                    }
                    
                    if (this.lastPongTime) {
                        const timeSinceLastPong = Date.now() - this.lastPongTime;
                        if (timeSinceLastPong > this.MAX_PONG_DELAY) {
                            
                            this.reconnect();
                        }
                    }
                } catch (error) {
                }
            }, 5000);
        } catch (error) {
        }
    }

    private stopPingPong(): void {
        try {
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
                
            }
            
            if (this.pongTimeout) {
                clearTimeout(this.pongTimeout);
                this.pongTimeout = null;
            }
        } catch (error) {
        }
    }

    private sendPing(): void {
        try {
            const ws = this.ws;
            // Проверяем только readyState, не isConnected (который требует аутентификацию)
            // Это соответствует логике на сервере - ping может быть отправлен до аутентификации
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Отправляем ping как текстовое сообщение (как в тестах)
                // Сервер обрабатывает текстовый 'ping' и отвечает текстовым 'pong'
                ws.send('ping');
                
                
                // Устанавливаем timeout для ожидания pong
                if (this.pongTimeout) {
                    clearTimeout(this.pongTimeout);
                }
                
                this.pongTimeout = setTimeout(() => {
                    // Проверяем готовность соединения перед переподключением
                    const currentWs = this.ws;
                    if (currentWs && currentWs.readyState === WebSocket.OPEN && this.shouldReconnect) {
                        
                        this.reconnect();
                    }
                }, this.PONG_TIMEOUT);
            } else {
                
            }
        } catch (error) {
            if (this.shouldReconnect && !this.isConnecting) {
                this.reconnect();
            }
        }
    }

    private handlePong(): void {
        try {
            const previousPongTime = this.lastPongTime;
            const currentTime = Date.now();
            this.lastPongTime = currentTime;
            
            // Логируем время с предыдущего pong для отладки
            if (previousPongTime !== null && previousPongTime > 0) {
                const timeSinceLastPong = currentTime - previousPongTime;
            } else {
            }
            
            // Очищаем timeout ожидания pong
            if (this.pongTimeout) {
                clearTimeout(this.pongTimeout);
                this.pongTimeout = null;
            }
        } catch (error) {
        }
    }

    private flushPendingMessages(): void {
        try {
            const ws = this.ws;
            if (!ws || ws.readyState !== WebSocket.OPEN || !this.isAuthenticated) {
                return;
            }
            
            if (this.pendingMessages.length > 0) {
                
                const messages = [...this.pendingMessages];
                this.pendingMessages = [];
                
                // Дедупликация сообщений перед отправкой
                const uniqueMessages = new Map<string, WebSocketMessage>();
                messages.forEach(message => {
                    const key = `${message.type}_${JSON.stringify(message)}`;
                    if (!uniqueMessages.has(key)) {
                        uniqueMessages.set(key, message);
                    }
                });
                
                uniqueMessages.forEach((message, key) => {
                    try {
                        if (ws && ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
                            ws.send(JSON.stringify(message));
                            
                        } else {
                            // Возвращаем сообщение в очередь, если соединение потеряно
                            if (this.pendingMessages.length < 50) {
                                this.pendingMessages.push(message);
                            }
                        }
                    } catch (error) {
                        // Возвращаем сообщение в очередь при ошибке
                        if (this.pendingMessages.length < 50) {
                            this.pendingMessages.push(message);
                        }
                    }
                });
            }
        } catch (error) {
        }
    }

    disconnect(): void {
        try {
            if (this.isDisconnecting) {
                
                return;
            }
            
            
            this.isDisconnecting = true;
            this.shouldReconnect = false;
            
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            
            this.stopPingPong();
            
            if (this.connectPromise) {
                try {
                    if (this.ws?.readyState !== WebSocket.OPEN && this.ws?.readyState !== WebSocket.CONNECTING) {
                        this.connectPromise.reject(new Error('Connection cancelled'));
                    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
                        const ws = this.ws;
                        const originalOnClose = ws.onclose;
                        ws.onclose = (event) => {
                            try {
                                this.connectPromise?.reject(new Error('Connection cancelled'));
                            } catch (error) {
                                // Игнорируем ошибки
                            }
                            if (originalOnClose) {
                                originalOnClose.call(ws, event);
                            }
                        };
                    }
                } catch (error) {
                }
                this.connectPromise = null;
            }
            
            if (this.ws) {
                try {
                    const readyState = this.ws.readyState;
                    if (readyState === WebSocket.OPEN) {
                        this.ws.onerror = null;
                        const originalOnClose = this.ws.onclose;
                        this.ws.onclose = (event) => {
                            try {
                                if (originalOnClose) {
                                    originalOnClose.call(this.ws, event);
                                }
                            } catch (error) {
                                // Игнорируем ошибки
                            }
                        };
                        this.ws.close(1000, 'Client disconnect');
                        
                    } else if (readyState === WebSocket.CONNECTING) {
                        this.ws.onerror = null;
                        const originalOnClose = this.ws.onclose;
                        this.ws.onclose = (event) => {
                            try {
                                if (originalOnClose) {
                                    originalOnClose.call(this.ws, event);
                                }
                            } catch (error) {
                                // Игнорируем ошибки
                            }
                        };
                        try {
                            if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
                                this.ws.close(1000, 'Client disconnect');
                            }
                        } catch (error) {
                            if (error instanceof Error && !error.message.includes('closed before the connection')) {
                                
                            }
                        }
                    }
                } catch (error) {
                    if (error instanceof Error && !error.message.includes('closed before the connection')) {
                        
                    }
                }
                this.ws = null;
            }
            
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.connectionStartTime = null;
            this.lastMessageTime = null;
            this.lastPongTime = null;
            this.isAuthenticated = false;
            this.pendingMessages = [];
            this.isDisconnecting = false;
            
        } catch (error) {
            this.isDisconnecting = false;
        }
    }

    send(message: WebSocketMessage): void {
        // Log trade placement messages
        if (message.type === 'place-trade') {
            console.log(`[TradingWebSocketClient] 📤 SENDING place-trade message:`, {
                message,
                readyState: this.ws?.readyState,
                isConnected: this.isConnected,
                isAuthenticated: this.isAuthenticated,
                messageStr: JSON.stringify(message),
                wsExists: !!this.ws
            });
        }
        
        try {
            const ws = this.ws;
            
            // Проверяем, не дублируется ли сообщение в очереди
            const messageKey = `${message.type}_${JSON.stringify(message)}`;
            const isDuplicate = this.pendingMessages.some(msg => {
                const msgKey = `${msg.type}_${JSON.stringify(msg)}`;
                return msgKey === messageKey;
            });
            
            // Для unsubscribe и subscribe сообщений не требуем аутентификацию и не бросаем ошибку, если соединение закрыто
            const isUnsubscribe = message.type === 'unsubscribe-custom-quotes' || message.type?.includes('unsubscribe');
            const isSubscribe = message.type === 'subscribe-custom-quotes' || message.type?.includes('subscribe');
            const isSubscriptionMessage = isUnsubscribe || isSubscribe;
            
            if (ws?.readyState === WebSocket.OPEN) {
                if (!this.isAuthenticated && message.type !== 'auth') {
                    // Для unsubscribe/subscribe сообщений разрешаем отправку без аутентификации
                    if (isSubscriptionMessage) {
                        try {
                            ws.send(JSON.stringify(message));
                            return;
                        } catch (error) {
                            // Игнорируем ошибки при подписке/отписке, если соединение уже закрывается
                            // Добавляем в очередь для повторной попытки после переподключения
                            if (!isDuplicate && this.pendingMessages.length < 50) {
                                this.pendingMessages.push(message);
                            }
                            return;
                        }
                    }
                    
                    // КРИТИЧЕСКОЕ: Логируем, если сообщение place-trade блокируется из-за отсутствия аутентификации
                    if (message.type === 'place-trade') {
                        console.error(`[TradingWebSocketClient] ❌ КРИТИЧЕСКАЯ ОШИБКА: place-trade не отправлен - пользователь не аутентифицирован!`, {
                            isAuthenticated: this.isAuthenticated,
                            messageType: message.type,
                            readyState: ws.readyState,
                            message: message
                        });
                    }
                    
                    if (!isDuplicate) {
                        if (this.pendingMessages.length < 50) {
                            this.pendingMessages.push(message);
                        } else {
                            
                        }
                    }
                    return;
                }
                
                try {
                    ws.send(JSON.stringify(message));
                    
                    // Log successful send for trade placement
                    if (message.type === 'place-trade') {
                        console.log(`[TradingWebSocketClient] ✅ place-trade message successfully sent to server`, {
                            messageType: message.type,
                            readyState: ws.readyState,
                            isAuthenticated: this.isAuthenticated
                        });
                    }
                    
                } catch (error) {
                    if (this.shouldReconnect && !this.isConnecting) {
                        if (!isDuplicate && this.pendingMessages.length < 50) {
                            this.pendingMessages.push(message);
                        }
                        this.ws = null;
                        this.tryReconnect(0);
                    }
                    throw new Error('WebSocket send error');
                }
            } else if (ws?.readyState === WebSocket.CONNECTING) {
                if (message.type === 'place-trade') {
                    console.warn(`[TradingWebSocketClient] ⚠️ place-trade message queued - WebSocket is CONNECTING`, {
                        readyState: ws.readyState,
                        pendingMessagesCount: this.pendingMessages.length
                    });
                }
                if (!isDuplicate) {
                    if (this.pendingMessages.length < 50) {
                        this.pendingMessages.push(message);
                    }
                }
                // НЕ создаем setTimeout здесь - сообщения будут отправлены после подключения через flushPendingMessages
            } else {
                if (message.type === 'place-trade') {
                    console.error(`[TradingWebSocketClient] ❌ КРИТИЧЕСКАЯ ОШИБКА: place-trade не отправлен - WebSocket не подключен!`, {
                        readyState: ws?.readyState,
                        wsExists: !!ws,
                        isConnected: this.isConnected,
                        isAuthenticated: this.isAuthenticated,
                        message: message
                    });
                }
                // Для unsubscribe/subscribe сообщений не бросаем ошибку, если соединение закрыто
                // Это нормальная ситуация при размонтировании компонента или переподключении
                if (isSubscriptionMessage) {
                    // Добавляем в очередь для отправки после переподключения
                    if (!isDuplicate && this.pendingMessages.length < 50) {
                        this.pendingMessages.push(message);
                    }
                    if (this.shouldReconnect && !this.isConnecting) {
                        this.tryReconnect(0);
                    }
                    return;
                }
                
                if (!isDuplicate && this.pendingMessages.length < 50) {
                    this.pendingMessages.push(message);
                }
                if (this.shouldReconnect && !this.isConnecting) {
                    this.tryReconnect(0);
                }
                throw new Error('WebSocket is not connected');
            }
        } catch (error) {
            throw error;
        }
    }

    on(messageType: string, handler: TradingMessageHandler): void {
        try {
            if (!this.messageHandlers.has(messageType)) {
                this.messageHandlers.set(messageType, []);
            }
            this.messageHandlers.get(messageType)!.push(handler);
            
            // Log handler registration for trade_placed
            if (messageType === 'trade_placed') {
                console.log('[TradingWebSocketClient] ✅ Registered trade_placed handler', {
                    messageType,
                    handlersCount: this.messageHandlers.get(messageType)?.length || 0,
                    allRegisteredTypes: Array.from(this.messageHandlers.keys()),
                    isConnected: this.isConnected,
                    isAuthenticated: this.isAuthenticated
                });
            }
        } catch (error) {
            if (messageType === 'trade_placed') {
                console.error('[TradingWebSocketClient] ❌ Error registering trade_placed handler', error);
            }
        }
    }

    off(messageType: string, handler: TradingMessageHandler): void {
        try {
            const handlers = this.messageHandlers.get(messageType);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                    
                }
            }
        } catch (error) {
        }
    }

    private handleMessage(message: WebSocketMessage): void {
        try {
            // Log trade_placed messages for debugging
            if (message.type === 'trade_placed') {
                console.log('[TradingWebSocketClient] 📥 Received trade_placed message in handleMessage', {
                    message,
                    hasType: !!message.type,
                    type: message.type,
                    hasSuccess: (message as any).success,
                    hasData: !!(message as any).data,
                    registeredHandlers: Array.from(this.messageHandlers.keys()),
                    handlersCount: this.messageHandlers.get('trade_placed')?.length || 0
                });
            }
            
            const handlers = this.messageHandlers.get(message.type) || [];
            const wildcardHandlers = this.messageHandlers.get('*') || [];
            const allHandlers = [...handlers, ...wildcardHandlers];
            
            if (message.type === 'trade_placed') {
                console.log('[TradingWebSocketClient] 🔍 Processing trade_placed', {
                    handlersCount: handlers.length,
                    wildcardHandlersCount: wildcardHandlers.length,
                    allHandlersCount: allHandlers.length
                });
            }
            
            if (allHandlers.length === 0) {
                if (message.type === 'trade_placed') {
                    console.warn('[TradingWebSocketClient] ⚠️ No handlers registered for trade_placed!', {
                        registeredTypes: Array.from(this.messageHandlers.keys()),
                        message
                    });
                }
                return;
            }
            
            for (const handler of allHandlers) {
                try {
                    if (message.type === 'trade_placed') {
                        console.log('[TradingWebSocketClient] 🔄 Calling handler for trade_placed');
                    }
                    handler(message);
                } catch (error) {
                    if (message.type === 'trade_placed') {
                        console.error('[TradingWebSocketClient] ❌ Error in trade_placed handler', error);
                    }
                }
            }
        } catch (error) {
            if (message.type === 'trade_placed') {
                console.error('[TradingWebSocketClient] ❌ Error in handleMessage for trade_placed', error);
            }
        }
    }

    private tryReconnect(closeCode: number): void {
        try {
            if (closeCode === 1000) {
                return;
            }

            if (!this.shouldReconnect) {
                
                return;
            }

            if (this.reconnectTimeout) {
                
                return;
            }

            if (this.isConnecting) {
                
                return;
            }

            const now = Date.now();
            const timeSinceLastAttempt = now - this.lastReconnectAttempt;
            
            if (timeSinceLastAttempt < this.MIN_RECONNECT_INTERVAL) {
                const remainingDelay = this.MIN_RECONNECT_INTERVAL - timeSinceLastAttempt;
                
                this.reconnectTimeout = setTimeout(() => {
                    this.reconnectTimeout = null;
                    this.tryReconnect(closeCode);
                }, remainingDelay);
                return;
            }

            this.reconnectAttempts++;
            this.lastReconnectAttempt = now;
            
            const baseDelay = this.INITIAL_RECONNECT_DELAY * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
            const delay = Math.min(this.MAX_RECONNECT_INTERVAL, baseDelay);
            
            
            
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                if (this.shouldReconnect && !this.isConnected) {
                    this.connect().catch(error => {
                        this.isConnecting = false;
                        if (this.shouldReconnect) {
                            this.tryReconnect(closeCode);
                        }
                    });
                }
            }, delay);
        } catch (error) {
        }
    }

    private authenticateIfConnected(): void {
        try {
            const ws = this.ws;
            if (ws && ws.readyState === WebSocket.OPEN && this.userId) {
                const token = localStorage.getItem('token');
                
                if (!token) {
                    
                    return;
                }

                const clientId = `trading_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                
                this.send({ 
                    type: 'auth', 
                    userId: this.userId,
                    token: token,
                    clientId: clientId
                } as any);
            } else {
                
            }
        } catch (error) {
        }
    }

    reconnect(): void {
        try {
            
            this.shouldReconnect = true;
            const now = Date.now();
            const timeSinceLastAttempt = now - this.lastReconnectAttempt;
            
            if (timeSinceLastAttempt < this.MIN_RECONNECT_INTERVAL) {
                return;
            }
            
            this.lastReconnectAttempt = now;
            this.reconnectAttempts = 0;
            
            if (this.ws) {
                try {
                    this.ws.close();
                } catch (error) {
                }
            }
            
            this.ws = null;
            this.isConnecting = false;
            this.isAuthenticated = false;
            
            this.connect().catch(() => {
                
                this.isConnecting = false;
            });
        } catch (error) {
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
    }

    get isReady(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

