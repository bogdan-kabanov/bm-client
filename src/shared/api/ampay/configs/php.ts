import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для PHP (Филиппинское песо)
 */
export const phpMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_TRANSFER',
        sub_method: 'GRABPAY',
        currency: 'PHP',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'MAYA',
        currency: 'PHP',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'GCASH',
        currency: 'PHP',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    }
];

