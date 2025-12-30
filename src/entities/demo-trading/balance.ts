import { DEFAULT_DEMO_BALANCE, DEMO_BALANCE_EVENT, DEMO_BALANCE_KEY } from './constants';
import type { DemoBalanceUpdateDetail } from './types';
import { demoLog } from './logger';

const isBrowser = typeof window !== 'undefined';

export const sanitizeDemoBalance = (value: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_DEMO_BALANCE;
    }
    const normalized = Math.max(0, value);
    // Ограничиваем до двух знаков после запятой без потерь в точности при сравнении
    return Math.round(normalized * 100) / 100;
};

export const readDemoBalance = (): number => {
    if (!isBrowser) {
        return DEFAULT_DEMO_BALANCE;
    }

    try {
        const saved = window.localStorage.getItem(DEMO_BALANCE_KEY);
        const value = saved ? parseFloat(saved) : NaN;
        const result = Number.isFinite(value) ? sanitizeDemoBalance(value) : DEFAULT_DEMO_BALANCE;
        demoLog('readDemoBalance()', { raw: saved, parsed: value, result });
        return result;
    } catch {
        demoLog('readDemoBalance() failed, returning default');
        return DEFAULT_DEMO_BALANCE;
    }
};

export const persistDemoBalance = (value: number): number => {
    const sanitized = sanitizeDemoBalance(value);

    if (!isBrowser) {
        return sanitized;
    }

    try {
        window.localStorage.setItem(DEMO_BALANCE_KEY, sanitized.toString());
    } catch {
        // Игнорируем ошибки доступа к localStorage
    }

    return sanitized;
};

export const calculateNextDemoBalance = (
    current: number,
    detail: DemoBalanceUpdateDetail,
): number => {
    demoLog('calculateNextDemoBalance()', { current, detail });
    if (
        detail.newBalance !== undefined &&
        detail.newBalance !== null &&
        !Number.isNaN(detail.newBalance)
    ) {
        return sanitizeDemoBalance(detail.newBalance);
    }

    const amount = Number.isFinite(detail.amount ?? NaN)
        ? Number(detail.amount)
        : 0;

    if (detail.transactionType === 'REPLENISHMENT') {
        return sanitizeDemoBalance(current + amount);
    }

    if (detail.transactionType === 'WITHDRAWAL' || detail.transactionType === 'LOSS') {
        return sanitizeDemoBalance(current - amount);
    }

    return sanitizeDemoBalance(current);
};

export const broadcastDemoBalanceUpdate = (
    detail: DemoBalanceUpdateDetail,
): number => {
    if (!isBrowser) {
        // Возвращаем ожидаемое значение без бродкаста
        const next = calculateNextDemoBalance(readDemoBalance(), detail);
        demoLog('broadcastDemoBalanceUpdate() skipped (no window)', { detail, next });
        return next;
    }

    const current = readDemoBalance();
    const next = calculateNextDemoBalance(current, detail);
    const sanitized = persistDemoBalance(next);

    demoLog('broadcastDemoBalanceUpdate()', {
        detail,
        current,
        next,
        sanitized,
    });

    const eventDetail: DemoBalanceUpdateDetail = {
        ...detail,
        newBalance: sanitized,
    };

    window.dispatchEvent(
        new CustomEvent(DEMO_BALANCE_EVENT, {
            detail: eventDetail,
        }),
    );

    return sanitized;
};

export const subscribeDemoBalance = (
    listener: (detail: DemoBalanceUpdateDetail) => void,
): (() => void) => {
    if (!isBrowser) {
        demoLog('subscribeDemoBalance() skipped (no window)');
        return () => undefined;
    }

    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<DemoBalanceUpdateDetail>;
        demoLog('subscribeDemoBalance() event received', customEvent.detail);
        listener(customEvent.detail);
    };

    window.addEventListener(
        DEMO_BALANCE_EVENT,
        handler as EventListener,
    );

    return () => {
        demoLog('subscribeDemoBalance() unsubscribe');
        window.removeEventListener(
            DEMO_BALANCE_EVENT,
            handler as EventListener,
        );
    };
};

