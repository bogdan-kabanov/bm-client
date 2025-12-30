import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для PKR (Пакистанская рупия)
 */
export const pkrMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'E_WALLET',
        sub_method: 'PAISA',
        currency: 'PKR',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'E_WALLET',
        sub_method: 'PAISA',
        currency: 'PKR',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    }
];

