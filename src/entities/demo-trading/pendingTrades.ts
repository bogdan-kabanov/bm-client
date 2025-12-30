import { demoLog } from './logger';

const pendingDemoTrades = new Map<string, number>();

export const trackPendingDemoTrade = (tradeId: string, amount: number) => {
    if (!tradeId) {
        demoLog('trackPendingDemoTrade() skipped: empty tradeId', { amount });
        return;
    }
    pendingDemoTrades.set(tradeId, amount);
    demoLog('trackPendingDemoTrade()', { tradeId, amount, size: pendingDemoTrades.size });
};

export const consumePendingDemoTrade = (tradeId: string): number | undefined => {
    if (!tradeId) {
        demoLog('consumePendingDemoTrade() skipped: empty tradeId');
        return undefined;
    }

    const amount = pendingDemoTrades.get(tradeId);
    if (pendingDemoTrades.has(tradeId)) {
        pendingDemoTrades.delete(tradeId);
    }
    demoLog('consumePendingDemoTrade()', { tradeId, amount, size: pendingDemoTrades.size });
    return amount;
};

export const clearPendingDemoTrades = () => {
    pendingDemoTrades.clear();
    demoLog('clearPendingDemoTrades()');
};

