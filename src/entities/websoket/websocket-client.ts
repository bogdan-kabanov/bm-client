import { WebSocketMessage } from './websocket-types';

export type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private messageHandlers: Map<string, MessageHandler[]> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = Infinity;
    private userId: number | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnecting = false;
    private connectionStartTime: number | null = null;
    private connectPromise: { resolve: () => void; reject: (error: Error) => void } | null = null;
    private lastMessageTime: number | null = null;
    private messageCount = 0;
    private errorCount = 0;
    private shouldReconnect = true;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    private normalizeUrl(url: string): string {
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
    }

    constructor(private url: string) {
        this.url = this.normalizeUrl(url);
    }

    setUserId(id: number): void {
        this.userId = id;
        this.authenticateIfConnected();
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
            this.connectPromise = { resolve, reject };
            const wasConnecting = this.isConnecting;
            
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    const connectionTime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.shouldReconnect = true;
                    if (this.reconnectTimeout) {
                        clearTimeout(this.reconnectTimeout);
                        this.reconnectTimeout = null;
                    }
                    if (this.healthCheckInterval) {
                        clearInterval(this.healthCheckInterval);
                        this.healthCheckInterval = null;
                    }
                    this.startHealthCheck();
                    this.authenticateIfConnected();
                    if (this.connectPromise) {
                        this.connectPromise.resolve();
                        this.connectPromise = null;
                    }
                };

                this.ws.onmessage = (event) => {
                    this.messageCount++;
                    this.lastMessageTime = Date.now();
                    
                    // Log all raw messages that might be trade_placed before parsing
                    if (event.data && typeof event.data === 'string') {
                        try {
                            const preCheck = JSON.parse(event.data);
                            if (preCheck && (preCheck.type === 'trade_placed' || preCheck.type === 'error')) {
                                console.log(`[WebSocketClient] 🔍 PRE-PARSE CHECK:`, {
                                    rawData: event.data,
                                    type: preCheck.type,
                                    hasSuccess: preCheck.success,
                                    message: preCheck.message
                                });
                            }
                        } catch (e) {
                            // Ignore pre-check errors
                        }
                    }
                    
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        
                        // Log custom_quote messages
                        if (message.type === 'custom_quote') {
                            const klineData = (message as any).data || message;
                            const topic = klineData?.topic || 'unknown';
                            console.log(`[WebSocketClient] 📊 Получен custom_quote:`, {
                                type: message.type,
                                topic: topic,
                                timestamp: new Date().toISOString(),
                                messageCount: this.messageCount,
                                hasData: !!(message as any).data,
                                klineDataCount: Array.isArray(klineData?.data) ? klineData.data.length : 0
                            });
                        }
                        
                        // Log auth messages
                        if (message.type === 'auth' || message.type === 'auth_success') {
                            console.log(`[WebSocketClient] 🔐 ========== RAW AUTH MESSAGE RECEIVED ==========`);
                            console.log(`[WebSocketClient] 🔐 RAW AUTH MESSAGE:`, {
                                type: message.type,
                                hasSuccess: (message as any).success,
                                success: (message as any).success,
                                message: (message as any).message,
                                rawData: event.data,
                                parsedMessage: message
                            });
                        }
                        
                        // Log trade_placed messages
                        if (message.type === 'trade_placed') {
                            console.log(`[WebSocketClient] 📥 ========== RAW MESSAGE RECEIVED: trade_placed ==========`);
                            console.log(`[WebSocketClient] 📥 RAW MESSAGE RECEIVED: trade_placed`, {
                                type: message.type,
                                timestamp: new Date().toISOString(),
                                messageCount: this.messageCount,
                                rawData: event.data,
                                parsedMessage: message,
                                hasSuccess: (message as any).success,
                                hasData: !!(message as any).data,
                                data: (message as any).data,
                                newBalance: (message as any).data?.newBalance
                            });
                        }
                        
                        // Log balance_updated messages
                        if (message.type === 'balance_updated') {
                            console.log(`💰 [WebSocketClient] ========== RAW MESSAGE RECEIVED: balance_updated ==========`);
                            console.log(`💰 [WebSocketClient] RAW MESSAGE RECEIVED: balance_updated`, {
                                type: message.type,
                                timestamp: new Date().toISOString(),
                                messageCount: this.messageCount,
                                rawData: event.data,
                                parsedMessage: message,
                                hasSuccess: (message as any).success,
                                hasData: !!(message as any).data,
                                balance: (message as any).data?.balance,
                                coins: (message as any).data?.coins
                            });
                        }
                        
                        this.handleMessage(message);
                    } catch (error) {
                        this.errorCount++;
                        console.error(`[WebSocket] ❌ Ошибка парсинга сообщения:`, error);
                        if (event.data && typeof event.data === 'string') {
                            if (event.data.includes('custom_quote')) {
                                console.error(`[WebSocket] ❌ Ошибка парсинга custom_quote:`, event.data, error);
                            }
                            if (event.data.includes('trade_placed')) {
                                console.error(`[WebSocket] ❌ КРИТИЧЕСКАЯ ОШИБКА парсинга trade_placed:`, {
                                    rawData: event.data,
                                    error: error,
                                    errorMessage: error instanceof Error ? error.message : String(error),
                                    errorStack: error instanceof Error ? error.stack : undefined
                                });
                            }
                        }
                    }
                };

                this.ws.onclose = (event) => {
                    this.isConnecting = false;
                    const ws = this.ws;
                    const wasOpen = ws?.readyState === WebSocket.OPEN;
                    const wasDisconnecting = !this.shouldReconnect;
                    this.ws = null;
                    
                    if (this.healthCheckInterval) {
                        clearInterval(this.healthCheckInterval);
                        this.healthCheckInterval = null;
                    }
                    
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
                };

                this.ws.onerror = (error) => {
                    this.isConnecting = false;
                    this.errorCount++;
                    
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
                                    }
                                    this.ws = null;
                                }
                                this.tryReconnect(0);
                            }
                        }, 1000);
                    }
                };
            } catch (error) {
                this.isConnecting = false;
                this.errorCount++;
                if (this.connectPromise) {
                    this.connectPromise.reject(error instanceof Error ? error : new Error(String(error)));
                    this.connectPromise = null;
                }
            }
        });
    }

    private isDisconnecting = false;

    disconnect(): void {
        if (this.isDisconnecting) {
            return;
        }
        
        this.isDisconnecting = true;
        this.shouldReconnect = false;
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
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
                } else if (readyState === WebSocket.CLOSING || readyState === WebSocket.CLOSED) {
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
        this.isDisconnecting = false;
    }

    send(message: WebSocketMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                // Log trade placement messages
                if (message.type === 'place-trade') {
                    console.log(`[WebSocketClient] 📤 ========== SENDING place-trade message ==========`);
                    console.log(`[WebSocketClient] 📤 SENDING place-trade message:`, {
                        message,
                        readyState: this.ws.readyState,
                        isConnected: this.isConnected,
                        messageStr: JSON.stringify(message),
                        hasData: !!message.data,
                        dataId: message.data?.id,
                        dataDirection: message.data?.direction,
                        dataAmount: message.data?.amount
                    });
                }
                
                if (message.type === 'subscribe-custom-quotes' || message.type === 'unsubscribe-custom-quotes') {
                }
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                this.errorCount++;
                console.error(`[WebSocket] ❌ Ошибка отправки сообщения:`, error);
                if (this.shouldReconnect && !this.isConnecting) {
                    this.ws = null;
                    this.tryReconnect(0);
                }
                throw new Error('WebSocket send error');
            }
        } else if (this.ws?.readyState === WebSocket.CONNECTING) {
            setTimeout(() => this.send(message), 100);
        } else {
            this.errorCount++;
            console.error(`[WebSocket] ❌ WebSocket не подключен, readyState=${this.ws?.readyState}, message.type=${message.type}`);
            if (this.shouldReconnect && !this.isConnecting) {
                this.tryReconnect(0);
            }
            throw new Error('WebSocket is not connected');
        }
    }

    on(messageType: string, handler: MessageHandler): void {
        if (messageType === 'custom_quote') {
        }
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType)!.push(handler);
        
        if (messageType === 'trade_placed') {
            console.log('[WebSocketClient] ✅ Зарегистрирован обработчик для trade_placed', {
                messageType,
                handlersCount: this.messageHandlers.get(messageType)?.length || 0,
                allRegisteredTypes: Array.from(this.messageHandlers.keys())
            });
        }
        
        if (messageType === 'custom_quote') {
        }
    }

    off(messageType: string, handler: MessageHandler): void {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    private handleMessage(message: WebSocketMessage): void {
        try {
            // Логируем все сообщения типа trade_placed для диагностики
            if (message.type === 'trade_placed') {
                console.log('[WebSocketClient] 📥 Получено сообщение trade_placed', {
                    message,
                    hasType: !!message.type,
                    type: message.type,
                    hasSuccess: (message as any).success,
                    hasData: !!(message as any).data,
                    handlersCount: this.messageHandlers.get('trade_placed')?.length || 0,
                    allHandlers: Array.from(this.messageHandlers.keys())
                });
            }
            
            // Логируем все сообщения типа balance_updated для диагностики
            if (message.type === 'balance_updated') {
                console.log('💰 [WebSocketClient] 📥 Получено сообщение balance_updated', {
                    message,
                    hasType: !!message.type,
                    type: message.type,
                    hasSuccess: (message as any).success,
                    hasData: !!(message as any).data,
                    balance: (message as any).data?.balance,
                    coins: (message as any).data?.coins,
                    handlersCount: this.messageHandlers.get('balance_updated')?.length || 0,
                    allHandlers: Array.from(this.messageHandlers.keys())
                });
            }
            
            const handlers = this.messageHandlers.get(message.type) || [];
            const wildcardHandlers = this.messageHandlers.get('*') || [];
            const allHandlers = [...handlers, ...wildcardHandlers];
            
            if (message.type === 'trade_placed') {
                console.log('[WebSocketClient] 🔍 Обработка trade_placed', {
                    handlersCount: handlers.length,
                    wildcardHandlersCount: wildcardHandlers.length,
                    allHandlersCount: allHandlers.length
                });
            }
            
            if (message.type === 'balance_updated') {
                console.log('💰 [WebSocketClient] 🔍 Обработка balance_updated', {
                    handlersCount: handlers.length,
                    wildcardHandlersCount: wildcardHandlers.length,
                    allHandlersCount: allHandlers.length
                });
            }
            
            if (message.type === 'custom_quote' && allHandlers.length === 0) {
                return;
            }
            
            if (message.type === 'trade_placed' && allHandlers.length === 0) {
                console.warn('[WebSocketClient] ⚠️ Нет обработчиков для trade_placed!', {
                    registeredTypes: Array.from(this.messageHandlers.keys()),
                    message
                });
                return;
            }
            
            if (message.type === 'balance_updated' && allHandlers.length === 0) {
                console.warn('💰 [WebSocketClient] ⚠️ Нет обработчиков для balance_updated!', {
                    registeredTypes: Array.from(this.messageHandlers.keys()),
                    message
                });
                return;
            }
            
            for (const handler of allHandlers) {
                try {
                    if (message.type === 'trade_placed') {
                        console.log('[WebSocketClient] ✅ Вызов обработчика для trade_placed');
                    }
                    if (message.type === 'balance_updated') {
                        console.log('💰 [WebSocketClient] ✅ Вызов обработчика для balance_updated');
                    }
                    handler(message);
                } catch (error) {
                    this.errorCount++;
                    if (message.type === 'custom_quote') {
                        console.error(`[WebSocket] ❌ Ошибка в обработчике custom_quote:`, error);
                    }
                    if (message.type === 'balance_updated') {
                        console.error(`💰 [WebSocket] ❌ Ошибка в обработчике balance_updated:`, error);
                    }
                }
            }
        } catch (error) {
            this.errorCount++;
            if (message.type === 'custom_quote') {
                console.error(`[WebSocket] ❌ Ошибка обработки custom_quote:`, error);
            }
        }
    }

    private lastReconnectAttempt: number = 0;
    private readonly MIN_RECONNECT_INTERVAL = 1000;
    private readonly MAX_RECONNECT_INTERVAL = 30000;
    private readonly INITIAL_RECONNECT_DELAY = 1000;

    private tryReconnect(closeCode: number): void {
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
    }

    private startHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            if (!this.shouldReconnect) {
                return;
            }

            const ws = this.ws;
            const readyState = ws?.readyState;
            const isActuallyConnected = readyState === WebSocket.OPEN;
            const isConnecting = readyState === WebSocket.CONNECTING;
            const isClosed = readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING;

            if (!isActuallyConnected && !isConnecting && this.shouldReconnect) {
                const now = Date.now();
                const timeSinceLastAttempt = now - this.lastReconnectAttempt;
                
                if (timeSinceLastAttempt >= this.MIN_RECONNECT_INTERVAL && !this.isConnecting) {
                    if (isClosed && ws) {
                        this.ws = null;
                    }
                    this.tryReconnect(0);
                }
            } else if (isActuallyConnected) {
                const now = Date.now();
                if (this.lastMessageTime && now - this.lastMessageTime > 60000) {
                    try {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                        }
                    } catch (error) {
                        if (this.shouldReconnect && !this.isConnecting) {
                            this.ws = null;
                            this.tryReconnect(0);
                        }
                    }
                }
            }
        }, 3000);
    }

    private authenticateIfConnected(): void {
        if (this.ws?.readyState === WebSocket.OPEN && this.userId) {
            const token = localStorage.getItem('token');
            
            if (!token) {
                console.warn('[WebSocket] Токен отсутствует, невозможно выполнить аутентификацию');
                return;
            }

            const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            try {
                this.send({ 
                    type: 'auth', 
                    userId: this.userId,
                    token: token,
                    clientId: clientId
                } as any);
            } catch (error) {
                console.error('[WebSocket] Ошибка отправки сообщения auth:', error);
            }
        }
    }

    reconnect(): void {
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
        
        this.connect().catch(() => {
            this.isConnecting = false;
        });
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}