import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для EUR (Евро)
 */
export const eurMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'CARD',
        sub_method: 'FTD',
        currency: 'EUR',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'CARD',
        sub_method: 'STD',
        currency: 'EUR',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'CARD_WINDOW',
        sub_method: 'FTD',
        currency: 'EUR',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'CARD_WINDOW',
        sub_method: 'STD',
        currency: 'EUR',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'OPENBANKING',
        sub_method: 'GAM',
        currency: 'EUR',
        direction: 'IN',
        commission: 8.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'OPENBANKING',
        sub_method: 'FOR',
        currency: 'EUR',
        direction: 'IN',
        commission: 8.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'EUR',
        direction: 'IN',
        commission: 1,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    }
];

