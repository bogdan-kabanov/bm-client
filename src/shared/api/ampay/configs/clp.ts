import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для CLP (Чилийское песо)
 */
export const clpMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_TRANSFER',
        sub_method: 'WEBPAY',
        currency: 'CLP',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'CUENTA',
        currency: 'CLP',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'BANK_TRANSFER',
        currency: 'CLP',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    }
];

