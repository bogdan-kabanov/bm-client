import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для BRL (Бразильский реал)
 */
export const brlMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'E_WALLET',
        sub_method: 'PIX',
        currency: 'BRL',
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
        currency: 'BRL',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'E_WALLET',
        sub_method: 'PIX',
        currency: 'BRL',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    }
];

