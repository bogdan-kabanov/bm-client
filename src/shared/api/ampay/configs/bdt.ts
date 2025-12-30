import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для BDT (Бангладешская така)
 */
export const bdtMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'E_WALLET',
        sub_method: 'NAGAD',
        currency: 'BDT',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'E_WALLET',
        sub_method: 'BKASH',
        currency: 'BDT',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'E_WALLET',
        sub_method: 'BKASH',
        currency: 'BDT',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'E_WALLET',
        sub_method: 'NAGAD',
        currency: 'BDT',
        direction: 'OUT',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    }
];

