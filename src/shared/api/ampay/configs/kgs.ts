import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для KGS (Киргизский сом)
 */
export const kgsMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'KGS',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'KGS',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'KGS',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    }
];

