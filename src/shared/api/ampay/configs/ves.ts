import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для VES (Венесуэльский боливар)
 */
export const vesMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_PAGO_MOVIL',
        sub_method: 'VEN',
        currency: 'VES',
        direction: 'IN',
        commission: 7.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'PAGO_MOVIL',
        currency: 'VES',
        direction: 'IN',
        commission: 7.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'WINDOW_PAGO_MOVIL',
        currency: 'VES',
        direction: 'IN',
        commission: 7.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'VES',
        direction: 'IN',
        commission: 7.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'P2P_VEN',
        sub_method: 'PAGO_MOVIL',
        currency: 'VES',
        direction: 'OUT',
        commission: 5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'BANK_TRANSFER',
        sub_method: 'PAGO_MOVIL',
        currency: 'VES',
        direction: 'OUT',
        commission: 5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    }
];

