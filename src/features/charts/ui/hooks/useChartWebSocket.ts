import { useRef, useCallback, RefObject } from 'react';
import { Candle } from '../types';
import { getServerTime } from '@src/shared/lib/serverTime';

interface UseChartWebSocketParams {
  symbol: string;
  wsUrl: string;
  tradesWsUrl?: string;
  tempCandles: RefObject<Candle[]>;
  alignTimestampToTimeframe: (timestamp: number) => number;
  normalizeCandlesArray: (candles: Candle[]) => Candle[];
  aggregateCandles: (candle: Candle) => void;
  applyTradeUpdate: (price: number, tradeTime?: number) => void;
  scheduleChartUpdate: (options?: { force?: boolean; alignLatest?: boolean; adjustY?: boolean }) => void;
  isPageHiddenRef: RefObject<boolean>;
  isUnmountedRef: RefObject<boolean>;
}

export const useChartWebSocket = ({
  symbol,
  wsUrl,
  tradesWsUrl,
  tempCandles,
  alignTimestampToTimeframe,
  normalizeCandlesArray,
  aggregateCandles,
  applyTradeUpdate,
  scheduleChartUpdate,
  isPageHiddenRef,
  isUnmountedRef,
}: UseChartWebSocketParams) => {
  const socketRef = useRef<WebSocket | null>(null);
  const tradeSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tradeReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (isPageHiddenRef.current) {
      return;
    }

    // WebSocket подключение реализовано в TradingTerminal
  }, [symbol, wsUrl, isPageHiddenRef, aggregateCandles, scheduleChartUpdate, alignTimestampToTimeframe]);

  const connectTradeWebSocket = useCallback(() => {
    if (!tradesWsUrl) {
      return;
    }

    if (isPageHiddenRef.current) {
      return;
    }

    if (tradeSocketRef.current?.readyState === WebSocket.OPEN || tradeSocketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (tradeSocketRef.current) {
      try {
        if (tradeSocketRef.current.readyState !== WebSocket.CLOSED && tradeSocketRef.current.readyState !== WebSocket.CLOSING) {
          tradeSocketRef.current.close();
        }
      } catch {}
      tradeSocketRef.current = null;
    }

    try {
      const tws = new WebSocket(tradesWsUrl);
      tradeSocketRef.current = tws;

      tws.onopen = () => {
      };

      tws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          
          const priceStr = msg.p || msg.price || msg.c;
          if (!priceStr) {
            return;
          }
          
          const price = parseFloat(priceStr);
          const tradeTime = msg.T || msg.ts || getServerTime();
          applyTradeUpdate(price, tradeTime);
        } catch (error) {
        }
      };

      tws.onerror = (error) => {
      };
      
      tws.onclose = (event) => {
        tradeSocketRef.current = null;
        
        if (!isUnmountedRef.current && event.code !== 1000) {
          tradeReconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connectTradeWebSocket();
            }
          }, 3000);
        }
      };
    } catch (error) {
      
      if (!isUnmountedRef.current) {
        tradeReconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connectTradeWebSocket();
          }
        }, 3000);
      }
    }
  }, [tradesWsUrl, symbol, isPageHiddenRef, isUnmountedRef, applyTradeUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      const socket = socketRef.current;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try {
          socket.close(1000, 'Component cleanup');
        } catch (error) {
        }
      }
      
      socketRef.current = null;
    }

    if (tradeSocketRef.current) {
      const tradeSocket = tradeSocketRef.current;
      tradeSocket.onopen = null;
      tradeSocket.onmessage = null;
      tradeSocket.onerror = null;
      tradeSocket.onclose = null;
      try {
        tradeSocket.close(1000, 'Component cleanup');
      } catch (error) {
      }
      tradeSocketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (tradeReconnectTimeoutRef.current) {
      clearTimeout(tradeReconnectTimeoutRef.current);
      tradeReconnectTimeoutRef.current = null;
    }
  }, []);

  return {
    connectWebSocket,
    connectTradeWebSocket,
    disconnect,
    socketRef,
    tradeSocketRef,
  };
};

