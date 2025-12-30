import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для CNY (Китайский юань)
 */
export const cnyMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'WINDOW_ASIA',
        sub_method: 'ALL',
        currency: 'CNY',
        direction: 'IN',
        commission: 8,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'E_WALLET',
        sub_method: 'ALIPAY',
        currency: 'CNY',
        direction: 'IN',
        commission: 8,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    }
];

