import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * AmPay methods configuration for UZS (Uzbekistani Som)
 */
export const uzsMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'UZS',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'P2P_CIS',
        sub_method: 'QR',
        currency: 'UZS',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'UZS',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'UZS',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    }
];

