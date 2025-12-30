/**
 * Minimum deposit amounts for payment methods by country and method type
 * All amounts are in the currency of the payment method
 */
export interface PaymentMethodMinAmount {
    country: string;
    method: string;
    sub_method?: string;
    currency: string;
    minAmount: number;
}

export const PAYMENT_METHOD_MIN_AMOUNTS: PaymentMethodMinAmount[] = [
    // China
    { country: 'CN', method: 'E_WALLET', sub_method: 'ALIPAY', currency: 'CNY', minAmount: 800 },
    { country: 'CN', method: 'WINDOW_ASIA-ALL', currency: 'CNY', minAmount: 800 },
    
    // Colombia
    { country: 'CO', method: 'BANK_TRANSFER', sub_method: 'PSE', currency: 'COP', minAmount: 10000 },
    { country: 'CO', method: 'E_WALLET', sub_method: 'NEQUI_PUSH', currency: 'COP', minAmount: 11000 },
    { country: 'CO', method: 'E_WALLET', sub_method: 'NEQUI_P2P', currency: 'COP', minAmount: 11000 },
    { country: 'CO', method: 'E_WALLET', sub_method: 'WINDOW_NEQUI_P2P', currency: 'COP', minAmount: 11000 },
    { country: 'CO', method: 'WINDOW_P2P', currency: 'COP', minAmount: 11000 },
    
    // Turkey
    { country: 'TR', method: 'H2H_P2P', sub_method: 'IBAN', currency: 'TRY', minAmount: 5000 },
    { country: 'TR', method: 'BANK_ACCOUNT', sub_method: 'IBAN', currency: 'TRY', minAmount: 5000 },
    
    // Vietnam
    { country: 'VN', method: 'E_WALLET', sub_method: 'MOMO', currency: 'VND', minAmount: 20000 },
    
    // Indonesia
    { country: 'ID', method: 'QRIS', sub_method: 'QRIS_DEFAULT', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'QRIS', sub_method: 'WINDOW_QRIS_DEFAULT', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'E_WALLET', sub_method: 'DANAWALLET', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'E_WALLET', sub_method: 'OVOWALLET', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'E_WALLET', sub_method: 'SHOPEEPAY-APP', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'E_WALLET', sub_method: 'LINKAJA-APP', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'BANK_ACCOUNT', sub_method: 'BNIVA', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'BANK_ACCOUNT', sub_method: 'PERMATAVA', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'BANK_ACCOUNT', sub_method: 'BRIVA', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'BANK_ACCOUNT', sub_method: 'MANDIRVA', currency: 'IDR', minAmount: 10 },
    { country: 'ID', method: 'WINDOW_P2P', currency: 'IDR', minAmount: 10 },
    
    // India
    { country: 'IN', method: 'WINDOW_INDIA', sub_method: 'UPI', currency: 'INR', minAmount: 100 },
    { country: 'IN', method: 'WINDOW_INDIA', sub_method: 'WINDOW_UPI', currency: 'INR', minAmount: 100 },
    { country: 'IN', method: 'INDIA_H2H', sub_method: 'UPI', currency: 'INR', minAmount: 100 },
    { country: 'IN', method: 'WINDOW_P2P', sub_method: 'CIS', currency: 'INR', minAmount: 100 },
    { country: 'IN', method: 'WINDOW_P2P', currency: 'INR', minAmount: 100 },
    
    // Azerbaijan
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'QR', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'CARD', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'WINDOW_CARD', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'WINDOW_MOBILE_NUMBER', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'WINDOW', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'TEST', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'CARD_TEST', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CIS', sub_method: 'MOBILE_NUMBER', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'WINDOW_P2P', sub_method: 'CIS', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'WINDOW_P2P', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CARD', sub_method: 'FTD', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CARD', sub_method: 'STD', currency: 'AZN', minAmount: 10 },
    { country: 'AZ', method: 'P2P_CARD', sub_method: 'WINDOW', currency: 'AZN', minAmount: 10 },
    
    // Europe
    { country: 'EU', method: 'OPENBANKING', sub_method: 'GAM', currency: 'EUR', minAmount: 10 },
    { country: 'EU', method: 'OPENBANKING', sub_method: 'FOR', currency: 'EUR', minAmount: 10 },
    
    // Bangladesh
    { country: 'BD', method: 'E_WALLET', currency: 'BDT', minAmount: 200 },
    
    // Argentina
    { country: 'AR', method: 'P2P_ARG_LEMON', currency: 'ARS', minAmount: 5000 },
    { country: 'AR', method: 'P2P_ARG_COINAG', currency: 'ARS', minAmount: 5000 },
    { country: 'AR', method: 'P2P_ARG', currency: 'ARS', minAmount: 5000 },
    { country: 'AR', method: 'WINDOW_P2P', currency: 'ARS', minAmount: 5000 },
    
    // Venezuela
    { country: 'VE', method: 'BANK_TRANSFER', currency: 'VES', minAmount: 5000 },
];

/**
 * Get minimum amount for a payment method
 */
export function getMinAmountForMethod(
    countryCode: string,
    method: string,
    subMethod?: string,
    currency?: string
): number | null {
    const countryUpper = countryCode.toUpperCase();
    
    // Try exact match first
    let match = PAYMENT_METHOD_MIN_AMOUNTS.find(
        item => 
            item.country === countryUpper &&
            item.method === method &&
            (subMethod ? item.sub_method === subMethod : !item.sub_method) &&
            (!currency || item.currency === currency)
    );
    
    // If no exact match, try without sub_method
    if (!match) {
        match = PAYMENT_METHOD_MIN_AMOUNTS.find(
            item => 
                item.country === countryUpper &&
                item.method === method &&
                (!currency || item.currency === currency)
        );
    }
    
    return match ? match.minAmount : null;
}

/**
 * Get currency for a payment method
 */
export function getCurrencyForMethod(
    countryCode: string,
    method: string,
    subMethod?: string
): string | null {
    const match = PAYMENT_METHOD_MIN_AMOUNTS.find(
        item => 
            item.country === countryCode.toUpperCase() &&
            item.method === method &&
            (subMethod ? item.sub_method === subMethod : !item.sub_method)
    );
    
    return match ? match.currency : null;
}

