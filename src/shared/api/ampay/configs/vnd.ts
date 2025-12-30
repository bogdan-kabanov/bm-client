import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для VND (Вьетнамский донг)
 */
export const vndMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'E_WALLET',
        sub_method: 'MOMO',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'QR',
        sub_method: 'TECHCOM_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'QR',
        sub_method: 'ACB_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'QR',
        sub_method: 'MB_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'QR',
        sub_method: 'BIDV',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'QR',
        sub_method: 'VP_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'QR',
        sub_method: 'VIETCOM',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'QR',
        sub_method: 'VIETIN_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 8
    },
    {
        method: 'QR',
        sub_method: 'TP_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 9
    },
    {
        method: 'QR',
        sub_method: 'VIB_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 10
    },
    {
        method: 'QR',
        sub_method: 'AGRI_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 11
    },
    {
        method: 'QR',
        sub_method: 'PVCOM_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 12
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 13
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_TECHCOM_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 14
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_ACB_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 15
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_MB_VIET',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 16
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_BIDV',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 17
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_VP_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 18
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_VIETCOM',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 19
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_VIETIN_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 20
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_TP_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 21
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_VIB_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 22
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_AGRI_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 23
    },
    {
        method: 'QR',
        sub_method: 'WINDOW_PVCOM_BANK',
        currency: 'VND',
        direction: 'IN',
        commission: 6,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 24
    },
    {
        method: 'BANK_ACCOUNT',
        sub_method: 'BANK_VA',
        currency: 'VND',
        direction: 'OUT',
        commission: 4,
        additional_commission: null,
        test_mode: true,
        is_active: true,
        order: 25
    },
    {
        method: 'E_WALLET',
        sub_method: 'MOMO',
        currency: 'VND',
        direction: 'OUT',
        commission: 4,
        additional_commission: null,
        test_mode: true,
        is_active: true,
        order: 26
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'VND',
        direction: 'OUT',
        commission: 1,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 27
    }
];

