import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для ARS (Аргентинское песо)
 */
export const arsMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'WINDOW',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'P2P_ARG_COINAG',
        sub_method: 'WINDOW',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'USERNAME',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'PAN',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'WINDOW_PAN',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'WINDOW_USERNAME',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'P2P_ARG_COINAG',
        sub_method: 'USERNAME',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'P2P_ARG_COINAG',
        sub_method: 'PAN',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 8
    },
    {
        method: 'P2P_ARG_COINAG',
        sub_method: 'WINDOW_PAN',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 9
    },
    {
        method: 'P2P_ARG_COINAG',
        sub_method: 'WINDOW_USERNAME',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 10
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'ARS',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 11
    },
    {
        method: 'P2P_ARG',
        sub_method: 'CVU',
        currency: 'ARS',
        direction: 'OUT',
        commission: 3.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 12
    },
    {
        method: 'P2P_ARG_LEMON',
        sub_method: 'USERNAME',
        currency: 'ARS',
        direction: 'OUT',
        commission: 3.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 13
    }
];

