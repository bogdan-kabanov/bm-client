import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для TJS (Таджикский сомони)
 */
export const tjsMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'TJS',
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
        currency: 'TJS',
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
        currency: 'TJS',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    }
];

