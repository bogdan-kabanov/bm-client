import type { TradeMarker } from '@src/entities/trading/model/types';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';

interface PendingMarkerData {
    markerId: string;
    tradeData: {
        symbol: string;
        direction: 'buy' | 'sell';
        amount: number;
        price: number;
        trade_timestamp: number;
    };
}

class PendingTradeMarkersStore {
    private pendingMarkers = new Map<string, PendingMarkerData>();

    add(markerKey: string, data: PendingMarkerData): void {
        this.pendingMarkers.set(markerKey, data);
    }

    findAndRemove(tradeData: {
        symbol?: string;
        direction?: 'buy' | 'sell';
        amount?: number;
        entryPrice?: number;
        price?: number;
        trade_timestamp?: number;
        tradeTimestamp?: number;
        createdAt?: number;
    }): string | null {
        if (!tradeData.symbol || !tradeData.direction || !tradeData.amount) {
            return null;
        }

        const symbol = tradeData.symbol;
        const direction = tradeData.direction;
        const amount = tradeData.amount;
        const price = tradeData.entryPrice || tradeData.price;
        const timestamp = tradeData.trade_timestamp || tradeData.tradeTimestamp || tradeData.createdAt;

        if (!price || !timestamp) {
            return null;
        }

        for (const [key, data] of this.pendingMarkers.entries()) {
            const markerData = data.tradeData;
            const normalizedMarkerSymbol = normalizeCurrencyPair(markerData.symbol);
            const normalizedSymbol = normalizeCurrencyPair(symbol);
            if (
                normalizedMarkerSymbol === normalizedSymbol &&
                markerData.direction === direction &&
                Math.abs(markerData.amount - amount) < 0.01 &&
                Math.abs(markerData.price - price) < 0.01 &&
                Math.abs(markerData.trade_timestamp - timestamp) < 5000
            ) {
                this.pendingMarkers.delete(key);
                return data.markerId;
            }
        }

        return null;
    }

    removeByMarkerId(markerId: string): void {
        for (const [key, data] of this.pendingMarkers.entries()) {
            if (data.markerId === markerId) {
                this.pendingMarkers.delete(key);
                break;
            }
        }
    }

    clear(): void {
        this.pendingMarkers.clear();
    }
}

export const pendingTradeMarkersStore = new PendingTradeMarkersStore();

