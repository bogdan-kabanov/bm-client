import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для COP (Колумбийское песо)
 */
export const copMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'E_WALLET',
        sub_method: 'NEQUI_PUSH',
        currency: 'COP',
        direction: 'IN',
        commission: 6.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'E_WALLET',
        sub_method: 'NEQUI_P2P',
        currency: 'COP',
        direction: 'IN',
        commission: 6.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'E_WALLET',
        sub_method: 'WINDOW_NEQUI_P2P',
        currency: 'COP',
        direction: 'IN',
        commission: 6.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'COP',
        direction: 'IN',
        commission: 6.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'E_WALLET',
        sub_method: 'ACCOUNT_NUMBER',
        currency: 'COP',
        direction: 'OUT',
        commission: 4.5,
        additional_commission: null,
        test_mode: true,
        is_active: true,
        order: 5
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'COP',
        direction: 'OUT',
        commission: 3.6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'PSE',
        currency: 'COP',
        direction: 'IN',
        commission: 6.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'ACCOUNT_NUMBER',
        currency: 'COP',
        direction: 'OUT',
        commission: 5,
        additional_commission: null,
        test_mode: true,
        is_active: true,
        order: 8
    }
];

