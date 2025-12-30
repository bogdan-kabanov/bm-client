import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для TRY (Турецкая лира)
 */
export const tryMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'IBAN',
        currency: 'TRY',
        direction: 'OUT',
        commission: 4,
        additional_commission: null,
        test_mode: true,
        is_active: true,
        order: 1
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'TRY',
        direction: 'OUT',
        commission: 2,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'H2H_P2P',
        sub_method: 'IBAN',
        currency: 'TRY',
        direction: 'IN',
        commission: 7,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'TRY',
        direction: 'IN',
        commission: 1.8,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    }
];

