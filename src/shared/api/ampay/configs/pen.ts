import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для PEN (Перуанский соль)
 */
export const penMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_TRANSFER',
        sub_method: 'P2P',
        currency: 'PEN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'P2P_CUENTA',
        currency: 'PEN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'P2P_YAPE',
        currency: 'PEN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'BANK_TRANSFER',
        currency: 'PEN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'PEN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'BANK_TRANSFER',
        currency: 'PEN',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    }
];

