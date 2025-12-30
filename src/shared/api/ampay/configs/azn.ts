import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для AZN (Азербайджанский манат)
 */
export const aznMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'P2P_CIS',
        sub_method: 'QR',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    },
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 2
    },
    {
        method: 'P2P_CIS',
        sub_method: 'WINDOW_CARD',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 3
    },
    {
        method: 'P2P_CIS',
        sub_method: 'WINDOW_MOBILE_NUMBER',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 4
    },
    {
        method: 'WINDOW_P2P',
        sub_method: 'CIS',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 5
    },
    {
        method: 'P2P_CIS',
        sub_method: 'WINDOW',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 6
    },
    {
        method: 'P2P_CIS',
        sub_method: 'TEST',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 7
    },
    {
        method: 'P2P_CIS',
        sub_method: 'CARD_TEST',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 8
    },
    {
        method: 'WINDOW_P2P',
        sub_method: '',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 9
    },
    {
        method: 'P2P_CARD',
        sub_method: 'FTD',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 10
    },
    {
        method: 'P2P_CARD',
        sub_method: 'STD',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 11
    },
    {
        method: 'P2P_CARD',
        sub_method: 'WINDOW',
        currency: 'AZN',
        direction: 'IN',
        commission: 12,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 12
    },
    {
        method: 'SETTLEMENT',
        sub_method: '',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 13
    },
    {
        method: 'P2P_CIS',
        sub_method: 'MOBILE_NUMBER',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 14
    },
    {
        method: 'P2P_CIS',
        sub_method: 'CARD',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 15
    },
    {
        method: 'P2P_CARD',
        sub_method: 'FTD',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 16
    },
    {
        method: 'P2P_CARD',
        sub_method: 'STD',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 17
    },
    {
        method: 'P2P_CARD',
        sub_method: 'WINDOW',
        currency: 'AZN',
        direction: 'OUT',
        commission: 5.5,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 18
    }
];

