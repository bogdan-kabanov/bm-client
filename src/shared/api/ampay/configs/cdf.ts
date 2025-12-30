import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Конфигурация методов AmPay для CDF (Конголезский франк)
 */
export const cdfMethods: CreateAmpayMethodConfigRequest[] = [
    {
        method: 'H2H_DEPOSIT',
        sub_method: 'MOBILE_NUMBER',
        currency: 'CDF',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        order: 1
    }
];

