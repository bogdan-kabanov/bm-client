import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для MXN (Мексиканское песо)
 */
export const mxnMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_TRANSFER',
        sub_method: 'STP',
        currency: 'MXN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'TARJETA',
        currency: 'MXN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'CODI_VA',
        currency: 'MXN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'CLABE',
        currency: 'MXN',
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
        currency: 'MXN',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'CLABE',
        currency: 'MXN',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'P2P_MXN',
        sub_method: 'BANK_TRANSFER',
        currency: 'MXN',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'PAYOUT_MEXICO',
        sub_method: 'CARD',
        currency: 'MXN',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 8
    }
];

