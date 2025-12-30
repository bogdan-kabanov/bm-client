import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { tradingService } from '../services/TradingService';
import { useWebSocket } from '@src/entities/websoket/useWebSocket';
import { getServerTime } from '@src/shared/lib/serverTime';

export const useTradingService = (getServerTimeFn?: () => number) => {
    const dispatch = useAppDispatch();
    const { isConnected } = useWebSocket();
    const initializedRef = useRef(false);

    const serverTimeFn = useCallback(() => {
        return getServerTimeFn ? getServerTimeFn() : getServerTime();
    }, [getServerTimeFn]);

    useEffect(() => {
        if (!initializedRef.current && dispatch) {
            tradingService.initialize(dispatch, serverTimeFn);
            initializedRef.current = true;
        }
    }, [dispatch, serverTimeFn]);

    const placeTrade = useCallback((params: {
        symbol: string;
        direction: 'buy' | 'sell';
        amount: number;
        expirationSeconds: number;
        mode?: 'manual' | 'demo';
        timeframe?: string;
    }) => {
        tradingService.placeTrade(params);
    }, []);

    const requestTradeHistory = useCallback((limit?: number, offset?: number) => {
        tradingService.requestTradeHistory(limit, offset);
    }, []);

    const updatePriceForSymbol = useCallback((symbol: string, currentPrice: number) => {
        tradingService.updatePriceForSymbol(symbol, currentPrice);
    }, []);

    return {
        placeTrade,
        requestTradeHistory,
        updatePriceForSymbol,
        getServerTime: serverTimeFn,
        clientId: tradingService.getClientId(),
    };
};

