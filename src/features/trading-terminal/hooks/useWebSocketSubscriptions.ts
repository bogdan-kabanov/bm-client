import { useEffect, useRef } from 'react';

interface UseWebSocketSubscriptionsProps {
  wsSendMessage: ((message: any) => void) | null;
  wsOnMessage: ((event: string, handler: (message: any) => void) => (() => void) | undefined) | null;
  isConnected: boolean;
  selectedBase: string;
  timeframe: string;
  tradingMode?: 'manual' | 'demo';
  activeTrades?: any[];
  handleTradesWithRigging?: (trades: any[]) => void;
}

export const useWebSocketSubscriptions = ({
  wsSendMessage,
  wsOnMessage,
  isConnected,
  selectedBase,
  timeframe,
}: UseWebSocketSubscriptionsProps) => {
  const customQuotesSubscribedRef = useRef<Set<string>>(new Set());
  const prevSelectedBaseRef = useRef<string>(selectedBase);

  useEffect(() => {
    if (prevSelectedBaseRef.current !== selectedBase) {
      if (wsSendMessage) {
        customQuotesSubscribedRef.current.forEach(key => {
          try {
            // Ключ в формате "currency_123", извлекаем ID
            const currencyIdMatch = key.match(/^currency_(\d+)$/);
            if (currencyIdMatch) {
              const currencyId = parseInt(currencyIdMatch[1], 10);
              wsSendMessage({ type: 'unsubscribe-custom-quotes', id: currencyId, timeframe } as any);
            }
          } catch (error) {
            console.error('[useWebSocketSubscriptions] Ошибка отписки при смене валюты:', error);
          }
        });
      }
      customQuotesSubscribedRef.current.clear();
      prevSelectedBaseRef.current = selectedBase;
    }
  }, [selectedBase, wsSendMessage, timeframe]);

  // Подписки на сделки обрабатываются через handleTradesWithRigging в TradingTerminal.tsx,
  // который уже использует id, поэтому этот код больше не нужен


  useEffect(() => {
    return () => {
      if (wsSendMessage && customQuotesSubscribedRef.current.size > 0) {
        customQuotesSubscribedRef.current.forEach(key => {
          try {
            // Ключ в формате "currency_123", извлекаем ID
            const currencyIdMatch = key.match(/^currency_(\d+)$/);
            if (currencyIdMatch) {
              const currencyId = parseInt(currencyIdMatch[1], 10);
              wsSendMessage({ type: 'unsubscribe-custom-quotes', id: currencyId, timeframe } as any);
            }
          } catch (error) {
            console.error('[useWebSocketSubscriptions] Ошибка отписки при размонтировании:', error);
          }
        });
        customQuotesSubscribedRef.current.clear();
      }
    };
  }, [wsSendMessage, timeframe]);

  return {
    customQuotesSubscribedRef,
  };
};

