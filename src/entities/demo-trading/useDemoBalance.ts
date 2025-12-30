import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_BALANCE_KEY } from './constants';
import {
    broadcastDemoBalanceUpdate,
    calculateNextDemoBalance,
    persistDemoBalance,
    readDemoBalance,
    sanitizeDemoBalance,
    subscribeDemoBalance,
} from './balance';
import type { DemoBalanceUpdateDetail } from './types';
import { demoLog } from './logger';

type UseDemoBalanceOptions = {
    enabled?: boolean;
    listenStorage?: boolean;
};

type UseDemoBalanceResult = {
    balance: number;
    setBalance: (next: number, options?: { broadcast?: boolean }) => void;
    applyUpdate: (detail: DemoBalanceUpdateDetail) => void;
    sync: () => void;
};

const noop = () => undefined;

export const useDemoBalance = (
    options: UseDemoBalanceOptions = {},
): UseDemoBalanceResult => {
    const { enabled = true, listenStorage = true } = options;
    const [balance, setBalanceState] = useState<number>(() => readDemoBalance());
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    useEffect(() => {
        if (!enabled) {
            demoLog('useDemoBalance disabled, skipping init');
            return;
        }
        demoLog('useDemoBalance enabled -> sync');
        setBalanceState(readDemoBalance());
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            demoLog('useDemoBalance subscription skipped (disabled)');
            return;
        }

        const unsubscribe = subscribeDemoBalance((detail) => {
            demoLog('useDemoBalance subscription update', { detail });
            setBalanceState((prev) => calculateNextDemoBalance(prev, detail));
        });

        return unsubscribe;
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !listenStorage || typeof window === 'undefined') {
            demoLog('useDemoBalance storage listener skipped', { enabled, listenStorage });
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== DEMO_BALANCE_KEY || event.newValue === null) {
                return;
            }
            const parsed = parseFloat(event.newValue);
            if (!Number.isNaN(parsed)) {
                demoLog('useDemoBalance storage event', { parsed });
                setBalanceState(sanitizeDemoBalance(parsed));
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [enabled, listenStorage]);

    const sync = useCallback(() => {
        if (!enabledRef.current) {
            demoLog('useDemoBalance.sync() skipped (disabled)');
            return;
        }
        demoLog('useDemoBalance.sync()');
        setBalanceState(readDemoBalance());
    }, []);

    const setBalance = useCallback(
        (next: number, setOptions?: { broadcast?: boolean }) => {
            const sanitized = sanitizeDemoBalance(next);

            if (!enabledRef.current) {
                demoLog('useDemoBalance.setBalance() (disabled)', { next, sanitized });
                persistDemoBalance(sanitized);
                setBalanceState(sanitized);
                return;
            }

            if (setOptions?.broadcast === false) {
                demoLog('useDemoBalance.setBalance() persisted without broadcast', { next, sanitized });
                persistDemoBalance(sanitized);
                setBalanceState(sanitized);
                return;
            }

            demoLog('useDemoBalance.setBalance() broadcasting update', {
                next,
                sanitized,
                previous: balance,
            });
            broadcastDemoBalanceUpdate({
                newBalance: sanitized,
                transactionType: sanitized >= balance ? 'REPLENISHMENT' : 'WITHDRAWAL',
                amount: Math.abs(sanitized - balance),
            });
        },
        [balance],
    );

    const applyUpdate = useCallback((detail: DemoBalanceUpdateDetail) => {
        if (!enabledRef.current) {
            const next = calculateNextDemoBalance(readDemoBalance(), detail);
            persistDemoBalance(next);
            demoLog('useDemoBalance.applyUpdate() (disabled) persisted value', { detail, next });
            return;
        }
        demoLog('useDemoBalance.applyUpdate()', detail);
        broadcastDemoBalanceUpdate(detail);
    }, []);

    return useMemo(
        () => ({
            balance,
            setBalance,
            applyUpdate,
            sync,
        }),
        [applyUpdate, balance, setBalance, sync],
    );
};

export type { DemoBalanceUpdateDetail };

