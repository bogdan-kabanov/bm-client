/**
 * Список всех доступных методов AmPay и их sub_methods
 * Используется для выпадающих списков в админке
 */

export interface MethodWithSubMethods {
    method: string;
    subMethods: string[];
    description?: string;
}

/**
 * Все доступные методы AmPay с их sub_methods
 */
export const availableMethods: MethodWithSubMethods[] = [
    {
        method: 'BANK_ACCOUNT',
        subMethods: ['BNIVA', 'PERMATAVA', 'BRIVA', 'MANDIRVA', 'BANK_VA', 'IBAN', 'ACCOUNT_NUMBER'],
        description: 'Банковский счет'
    },
    {
        method: 'BANK_TRANSFER',
        subMethods: ['PAGO_MOVIL', 'WINDOW_PAGO_MOVIL', 'PSE'],
        description: 'Банковский перевод'
    },
    {
        method: 'CARD',
        subMethods: [],
        description: 'Карта'
    },
    {
        method: 'CARD_WINDOW',
        subMethods: [],
        description: 'Окно карты'
    },
    {
        method: 'E_WALLET',
        subMethods: [
            'ALIPAY',
            'DANAWALLET',
            'OVOWALLET',
            'SHOPEEPAY-APP',
            'LINKAJA-APP',
            'ACCOUNT',
            'MOMO',
            'NEQUI_PUSH',
            'NEQUI_P2P',
            'WINDOW_NEQUI_P2P',
            'ACCOUNT_NUMBER'
        ],
        description: 'Электронный кошелек'
    },
    {
        method: 'H2H_DEPOSIT',
        subMethods: [],
        description: 'H2H депозит'
    },
    {
        method: 'H2H_P2P',
        subMethods: ['IBAN'],
        description: 'H2H P2P'
    },
    {
        method: 'INDIA_H2H',
        subMethods: ['UPI'],
        description: 'India H2H'
    },
    {
        method: 'OPENBANKING',
        subMethods: ['GAM', 'FOR'],
        description: 'Open Banking'
    },
    {
        method: 'P2P_ARG',
        subMethods: ['CVU'],
        description: 'P2P Аргентина'
    },
    {
        method: 'P2P_ARG_COINAG',
        subMethods: ['WINDOW', 'USERNAME', 'PAN', 'WINDOW_PAN', 'WINDOW_USERNAME'],
        description: 'P2P Аргентина Coinag'
    },
    {
        method: 'P2P_ARG_LEMON',
        subMethods: ['WINDOW', 'USERNAME', 'PAN', 'WINDOW_PAN', 'WINDOW_USERNAME'],
        description: 'P2P Аргентина Lemon'
    },
    {
        method: 'P2P_CARD',
        subMethods: ['FTD', 'STD', 'WINDOW'],
        description: 'P2P Карта'
    },
    {
        method: 'P2P_CIS',
        subMethods: [
            'QR',
            'CARD',
            'WINDOW_CARD',
            'WINDOW_MOBILE_NUMBER',
            'WINDOW',
            'TEST',
            'CARD_TEST',
            'MOBILE_NUMBER'
        ],
        description: 'P2P CIS'
    },
    {
        method: 'P2P_PAGO_MOVIL',
        subMethods: ['VEN'],
        description: 'P2P Pago Movil'
    },
    {
        method: 'P2P_VEN',
        subMethods: ['PAGO_MOVIL'],
        description: 'P2P Венесуэла'
    },
    {
        method: 'PAYOUT_INDIA',
        subMethods: ['UPI', 'IFSC'],
        description: 'Вывод в Индию'
    },
    {
        method: 'QR',
        subMethods: [
            'TECHCOM_VIET',
            'ACB_VIET',
            'MB_VIET',
            'BIDV',
            'VP_BANK',
            'VIETCOM',
            'VIETIN_BANK',
            'TP_BANK',
            'VIB_BANK',
            'AGRI_BANK',
            'PVCOM_BANK',
            'WINDOW_TECHCOM_VIET',
            'WINDOW_ACB_VIET',
            'WINDOW_MB_VIET',
            'WINDOW_BIDV',
            'WINDOW_VP_BANK',
            'WINDOW_VIETCOM',
            'WINDOW_VIETIN_BANK',
            'WINDOW_TP_BANK',
            'WINDOW_VIB_BANK',
            'WINDOW_AGRI_BANK',
            'WINDOW_PVCOM_BANK'
        ],
        description: 'QR код'
    },
    {
        method: 'QRIS',
        subMethods: ['QRIS_DEFAULT', 'WINDOW_QRIS_DEFAULT'],
        description: 'QRIS'
    },
    {
        method: 'SETTLEMENT',
        subMethods: [],
        description: 'Расчет'
    },
    {
        method: 'WINDOW_ASIA',
        subMethods: ['ALL'],
        description: 'Окно Азия'
    },
    {
        method: 'WINDOW_INDIA',
        subMethods: ['P2P', 'UPI', 'WINDOW_UPI'],
        description: 'Окно Индия'
    },
    {
        method: 'WINDOW_P2P',
        subMethods: ['', 'CIS', 'FTD', 'STD', 'WINDOW'],
        description: 'Окно P2P'
    }
];

/**
 * Получить список всех методов
 */
export const getAllMethodNames = (): string[] => {
    return availableMethods.map(m => m.method).sort();
};

/**
 * Получить sub_methods для конкретного метода
 */
export const getSubMethodsForMethod = (method: string): string[] => {
    const methodConfig = availableMethods.find(m => m.method === method);
    return methodConfig?.subMethods || [];
};

/**
 * Получить описание метода
 */
export const getMethodDescription = (method: string): string | undefined => {
    const methodConfig = availableMethods.find(m => m.method === method);
    return methodConfig?.description;
};

