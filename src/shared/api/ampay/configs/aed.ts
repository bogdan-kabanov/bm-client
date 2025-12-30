import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для AED (Дирхам ОАЭ)
 */
export const aedMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_TRANSFER',
        sub_method: 'RARG',
        currency: 'AED',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'BANK_ACCOUNT',
        currency: 'AED',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    }
];

