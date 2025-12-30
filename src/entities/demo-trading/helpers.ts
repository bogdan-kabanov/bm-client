// Общая функция для извлечения идентификатора сделки из разных структур
import { demoLog } from './logger';

export const resolveTradeId = (data: any): string | undefined => {
    if (!data) {
        demoLog('resolveTradeId() called with empty data');
        return undefined;
    }

    const candidate =
        data.tradeId ??
        data.id ??
        data.trade?.id ??
        data.trade_id ??
        data.trade?.tradeId;

    const result = typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : undefined;

    demoLog('resolveTradeId()', { candidate, result, data });

    return result;
};

