import type { CurrencyCategory } from '@src/shared/api/currency/types';

export interface CurrencyState {
    currentPair: string;
    availablePairs: readonly string[];
    interval: number;
    // Данные с сервера
    categories: CurrencyCategory[];
    categoriesLoading: boolean;
    categoriesError: string | null;
}