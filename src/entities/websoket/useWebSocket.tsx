import { createContext, useContext } from 'react';
import { WebSocketContextType, WebSocketMessage } from './websocket-types';
import { websocketStore } from './websocket.store';

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = (): WebSocketContextType => {
    const context = useContext(WebSocketContext);
    if (!context) {
        return getWebSocketContextValue();
    }
    return context;
};

export const getWebSocketContextValue = (): WebSocketContextType => ({
    isConnected: websocketStore.isConnected,
    error: websocketStore.error,
    sendMessage: (message: WebSocketMessage) => websocketStore.sendMessage(message),
    onMessage: (messageType: string, handler: (message: WebSocketMessage) => void) =>
        websocketStore.onMessage(messageType, handler),
    authenticate: (userId: number) => websocketStore.authenticate(userId),
    disconnect: () => websocketStore.disconnect(),
});