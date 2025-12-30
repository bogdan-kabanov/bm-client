import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для INR (Индийская рупия)
 */
export const inrMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'WINDOW_INDIA',
        sub_method: 'P2P',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'WINDOW_INDIA',
        sub_method: 'UPI',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'WINDOW_INDIA',
        sub_method: 'WINDOW_UPI',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'INDIA_H2H',
        sub_method: 'UPI',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'WINDOW_P2P',
        sub_method: 'FTD',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'WINDOW_P2P',
        sub_method: 'STD',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 8
    },
    {
        method: 'WINDOW_P2P',
        sub_method: 'WINDOW',
        currency: 'INR',
        direction: 'IN',
        commission: 9,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 9
    },
    {
        method: 'PAYOUT_INDIA',
        sub_method: 'UPI',
        currency: 'INR',
        direction: 'OUT',
        commission: 6,
        additional_commission: 10,
        test_mode: true,
        is_active: true,
        order: 10
    },
    {
        method: 'PAYOUT_INDIA',
        sub_method: 'IFSC',
        currency: 'INR',
        direction: 'OUT',
        commission: 6,
        additional_commission: 10,
        test_mode: true,
        is_active: true,
        order: 11
    }
];

