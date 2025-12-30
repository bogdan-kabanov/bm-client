/**
 * Утилита для мониторинга состояния веб-сокетов и обработки событий видимости страницы
 */

export interface WebSocketMonitorState {
    isPageVisible: boolean;
    isPageFocused: boolean;
    lastVisibilityChange: number;
    lastFocusChange: number;
    connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastActivity: number;
    messageCount: number;
    errorCount: number;
}

export class WebSocketMonitor {
    private state: WebSocketMonitorState = {
        isPageVisible: !document.hidden,
        isPageFocused: document.hasFocus(),
        lastVisibilityChange: Date.now(),
        lastFocusChange: Date.now(),
        connectionState: 'disconnected',
        lastActivity: Date.now(),
        messageCount: 0,
        errorCount: 0
    };

    private listeners: Map<string, Function[]> = new Map();
    private isMonitoring = false;
    private visibilityHandler: (() => void) | null = null;
    private focusHandler: (() => void) | null = null;
    private blurHandler: (() => void) | null = null;

    constructor() {
        // Monitoring disabled for performance
        return;
    }

    private setupPageVisibilityHandlers(): void {
        // Page visibility handlers disabled for performance
        return;
        // // Удаляем предыдущие обработчики если они есть
        // if (this.visibilityHandler) {
        //     document.removeEventListener('visibilitychange', this.visibilityHandler);
        //     this.visibilityHandler = null;
        // }
        // 
        // this.visibilityHandler = () => {
        //     const isVisible = !document.hidden;
        //     const wasVisible = this.state.isPageVisible;
        //     
        //     this.state.isPageVisible = isVisible;
        //     this.state.lastVisibilityChange = Date.now();
        //     
        //     this.logStateChange('VISIBILITY_CHANGE', {
        //         isVisible,
        //         wasVisible,
        //         timeHidden: wasVisible && !isVisible ? Date.now() - this.state.lastActivity : 0
        //     });
        //     
        //     this.emit('visibilitychange', { isVisible, wasVisible });
        //     
        //     // Если страница стала видимой после длительного отсутствия
        //     if (!wasVisible && isVisible) {
        //         this.handlePageBecameVisible();
        //     }
        //     
        //     // Если страница стала скрытой
        //     if (wasVisible && !isVisible) {
        //         this.handlePageBecameHidden();
        //     }
        // };
        // 
        // document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    private setupFocusHandlers(): void {
        // Focus handlers disabled for performance
    }

    private handlePageBecameVisible(): void {
        this.logStateChange('PAGE_BECAME_VISIBLE', {
            timeHidden: Date.now() - this.state.lastActivity,
            connectionState: this.state.connectionState
        });
        
        this.emit('pageVisible', this.state);
        
        // Уведомляем о необходимости проверить соединения
        this.emit('checkConnections', this.state);
    }

    private handlePageBecameHidden(): void {
        this.logStateChange('PAGE_BECAME_HIDDEN', {
            connectionState: this.state.connectionState,
            messageCount: this.state.messageCount
        });
        
        this.emit('pageHidden', this.state);
    }

    private startMonitoring(): void {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.logStateChange('MONITORING_STARTED');
        
        // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования производительности
        // Мониторинг каждые 30 секунд
        // const monitoringInterval = setInterval(() => {
        //     this.logStateChange('PERIODIC_CHECK', {
        //         timeSinceLastActivity: Date.now() - this.state.lastActivity,
        //         timeSinceLastVisibilityChange: Date.now() - this.state.lastVisibilityChange,
        //         timeSinceLastFocusChange: Date.now() - this.state.lastFocusChange
        //     });
        // }, 30000);
    }

    public updateConnectionState(state: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
        const previousState = this.state.connectionState;
        this.state.connectionState = state;
        this.state.lastActivity = Date.now();
        
        this.logStateChange('CONNECTION_STATE_CHANGE', {
            previousState,
            newState: state,
            isPageVisible: this.state.isPageVisible,
            isPageFocused: this.state.isPageFocused
        });
        
        this.emit('connectionStateChange', { previousState, newState: state });
    }

    public incrementMessageCount(): void {
        this.state.messageCount++;
        this.state.lastActivity = Date.now();
        
        this.logStateChange('MESSAGE_RECEIVED', {
            messageCount: this.state.messageCount,
            isPageVisible: this.state.isPageVisible,
            isPageFocused: this.state.isPageFocused
        });
    }

    public incrementErrorCount(): void {
        this.state.errorCount++;
        this.state.lastActivity = Date.now();
        
        this.logStateChange('ERROR_OCCURRED', {
            errorCount: this.state.errorCount,
            isPageVisible: this.state.isPageVisible,
            isPageFocused: this.state.isPageFocused
        });
    }

    public getState(): WebSocketMonitorState {
        return { ...this.state };
    }

    public on(event: string, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
        
        return () => {
            const listeners = this.listeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    private emit(event: string, data?: any): void {
        const listeners = this.listeners.get(event) || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                // Logging removed for performance
            }
        });
    }

    private logStateChange(event: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const logData = {
            event,
            timestamp,
            state: { ...this.state },
            ...data
        };
        
        // Логируем только критические события
        const criticalEvents = [
            'ERROR_OCCURRED',
            'MONITORING_STARTED',
            'MONITORING_STOPPED'
        ];
        
        // Logging removed for performance
    }

    public destroy(): void {
        this.isMonitoring = false;
        this.listeners.clear();
        
        // Удаляем обработчики событий
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler);
            this.focusHandler = null;
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }
        
        this.logStateChange('MONITORING_STOPPED');
    }
}

// Глобальный экземпляр монитора (синглтон)
let websocketMonitorInstance: WebSocketMonitor | null = null;

export const websocketMonitor = (() => {
    if (!websocketMonitorInstance) {
        websocketMonitorInstance = new WebSocketMonitor();
    }
    return websocketMonitorInstance;
})();
