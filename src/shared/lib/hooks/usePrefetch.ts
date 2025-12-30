import { useCallback, useRef } from 'react';

type PrefetchMap = {
    [key: string]: () => Promise<any>;
};

const prefetchCache = new Set<string>();
const prefetchPromises = new Map<string, Promise<any>>();

const pagePrefetchMap: PrefetchMap = {
    '/trading': () => import('@pages/trading').then((m) => ({ default: m.TradingPage })),
    '/profile': () => import('@pages/profile').then((m) => ({ default: m.ProfilePage })),
    '/bots': () => import('@pages/bots/BotsPage').then((m) => ({ default: m.BotsPage })),
    '/referrals': () => import('@pages/referrals/ReferralsPage').then((m) => ({ default: m.ReferralsPage })),
};

export const usePrefetch = () => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const prefetch = useCallback((path: string) => {
        if (prefetchCache.has(path)) {
            return;
        }

        const prefetchFn = pagePrefetchMap[path];
        if (!prefetchFn) {
            return;
        }

        if (!prefetchPromises.has(path)) {
            const promise = prefetchFn().catch((error) => {

                prefetchPromises.delete(path);
            });
            prefetchPromises.set(path, promise);
            promise.then(() => {
                prefetchCache.add(path);
            });
        }
    }, []);

    const prefetchOnHover = useCallback((path: string, delay: number = 100) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            prefetch(path);
        }, delay);
    }, [prefetch]);

    const cancelPrefetch = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    return { prefetch, prefetchOnHover, cancelPrefetch };
};

