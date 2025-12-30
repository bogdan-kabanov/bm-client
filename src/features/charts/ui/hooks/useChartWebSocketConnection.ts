import { useRef, useCallback, RefObject, MutableRefObject } from 'react';

interface UseChartWebSocketConnectionParams {
  wsUrl: string;
  tradesWsUrl: string | null;
  useCustomQuotes: boolean;
  useCustomQuotesRef: RefObject<boolean>;
  customQuotesActiveRef: RefObject<boolean>;
  setErrorMessage: (error: string | null) => void;
  isUnmountedRef: RefObject<boolean>;
  isPageHiddenRef: RefObject<boolean>;
  reconnectTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  socketRef: MutableRefObject<WebSocket | null>;
  tradeSocketRef: MutableRefObject<WebSocket | null>;
  pendingMainReconnectRef: MutableRefObject<(() => void) | null>;
  connectWebSocketLatestRef: MutableRefObject<(() => Promise<void>) | null>;
}

export const useChartWebSocketConnection = (params: UseChartWebSocketConnectionParams) => {
  const {
    wsUrl,
    tradesWsUrl,
    useCustomQuotes,
    useCustomQuotesRef,
    customQuotesActiveRef,
    setErrorMessage,
    isUnmountedRef,
    isPageHiddenRef,
    reconnectTimeoutRef,
    socketRef,
    tradeSocketRef,
    pendingMainReconnectRef,
    connectWebSocketLatestRef,
  } = params;

  const handleConnectWebSocket = useCallback(() => {
    // Не подключаемся к внешним WebSocket - используем только синтетические котировки
    if (!wsUrl) {
      return;
    }
    // WebSocket подключение отключено - используем только синтетические котировки
  }, [wsUrl]);

  const connectWebSocket = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (isPageHiddenRef.current) {
      pendingMainReconnectRef.current = () => {
        connectWebSocketLatestRef.current?.();
      };
      return;
    }

    if (socketRef.current) {
      const oldSocket = socketRef.current;
      const readyState = oldSocket.readyState;
      
      oldSocket.onopen = null;
      oldSocket.onmessage = null;
      oldSocket.onerror = null;
      
      const closePromise = new Promise<void>((resolve) => {
        oldSocket.onclose = () => {
          resolve();
        };
        
        if (readyState !== WebSocket.CLOSED) {
          try {
            if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
              oldSocket.close(1000, 'Reconnecting');
            } else if (readyState === WebSocket.CLOSING) {
              resolve();
            }
          } catch (error) {
            resolve();
          }
        } else {
          resolve();
        }
      });
      
      socketRef.current = null;
      
      await Promise.race([
        closePromise,
        new Promise<void>((resolve) => setTimeout(resolve, 500))
      ]);
    }

    handleConnectWebSocket();
  }, [handleConnectWebSocket, isPageHiddenRef, pendingMainReconnectRef, connectWebSocketLatestRef, reconnectTimeoutRef, socketRef]);

  connectWebSocketLatestRef.current = connectWebSocket;

  const connectTradeWebSocket = useCallback(() => {
    // Trade WebSocket отключен - используем только синтетические котировки
  }, []);

  return {
    connectWebSocket,
    connectTradeWebSocket,
  };
};

