import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для IDR (Индонезийская рупия)
 */
export const idrMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'QRIS',
        sub_method: 'QRIS_DEFAULT',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'QRIS',
        sub_method: 'WINDOW_QRIS_DEFAULT',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'E_WALLET',
        sub_method: 'DANAWALLET',
        currency: 'IDR',
        direction: 'IN',
        commission: 7,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'E_WALLET',
        sub_method: 'OVOWALLET',
        currency: 'IDR',
        direction: 'IN',
        commission: 7,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'E_WALLET',
        sub_method: 'SHOPEEPAY-APP',
        currency: 'IDR',
        direction: 'IN',
        commission: 7,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'E_WALLET',
        sub_method: 'LINKAJA-APP',
        currency: 'IDR',
        direction: 'IN',
        commission: 7,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'E_WALLET',
        sub_method: 'ACCOUNT',
        currency: 'IDR',
        direction: 'OUT',
        commission: 4.5,
        additional_commission: 7000,
        test_mode: true,
        is_active: true,
        order: 8
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'IDR',
        direction: 'OUT',
        commission: 1.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 9
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'BNIVA',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: 7000,
        test_mode: false,
        is_active: true,
        order: 10
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'PERMATAVA',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: 7000,
        test_mode: false,
        is_active: true,
        order: 11
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'BRIVA',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: 7000,
        test_mode: false,
        is_active: true,
        order: 12
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'MANDIRVA',
        currency: 'IDR',
        direction: 'IN',
        commission: 4.5,
        additional_commission: 7000,
        test_mode: false,
        is_active: true,
        order: 13
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'BANK_VA',
        currency: 'IDR',
        direction: 'OUT',
        commission: 4,
        additional_commission: 7000,
        test_mode: false,
        is_active: true,
        order: 14
    }
];

