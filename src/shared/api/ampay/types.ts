export interface AmpayPaymentMethod {
    id: number;
    method: string;
    sub_method: string;
    currency: string;
    direction: 'IN' | 'OUT';
    category: string | null;
    display_name: string | null;
    icon_url: string | null;
    min_amount: number | null;
    is_active: boolean;
    order: number;
    created_at: string;
    updated_at: string;
}

export interface AmpayTransaction {
    id: number;
    user_id: number;
    tracker_id: string | null;
    system_id: string | null;
    client_transaction_id: string;
    payment_method: string;
    sub_method: string;
    currency: string;
    amount: number;
    amount_to_pay: number | null;
    commission: number | null;
    amount_after_commission: number | null;
    status: 'ACCEPTED' | 'SUCCESS' | 'DECLINED';
    redirect_url: string | null;
    payment_data: any | null;
    callback_data: any | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface CreateTransactionRequest {
    payment_method: string;
    sub_method: string;
    currency: string;
    amount: number;
    customer: {
        full_name: string;
        email: string;
        phone: string;
        country?: string;
        city?: string;
        postal_code?: string;
        address?: string;
        ip: string;
        language?: string;
        document_number?: string;
        document_type?: string;
    };
    success_redirect_url?: string;
    transaction_description?: string;
    bank_token?: string;
    bank_account?: {
        account_number?: string;
        holder_name?: string;
    };
}

export interface MethodsByCategory {
    [category: string]: AmpayPaymentMethod[];
}

// Типы для админки методов AmPay
export interface AmpayMethodConfig {
    id?: number;
    method: string;
    sub_method: string;
    currency: string;
    direction: 'IN' | 'OUT';
    commission: number; // процент комиссии (например, 8 для 8%)
    additional_commission: number | null; // дополнительная комиссия (например, 7000)
    test_mode: boolean;
    is_active: boolean;
    display_name?: string | null;
    category?: string | null;
    icon_url?: string | null;
    min_amount?: number | null;
    order?: number;
    created_at?: string;
    updated_at?: string;
}

export interface CreateAmpayMethodConfigRequest {
    method: string;
    sub_method: string;
    currency: string;
    direction: 'IN' | 'OUT';
    commission: number;
    additional_commission?: number | null;
    test_mode: boolean;
    is_active: boolean;
    display_name?: string | null;
    category?: string | null;
    icon_url?: string | null;
    min_amount?: number | null;
    order?: number;
}

export interface UpdateAmpayMethodConfigRequest {
    commission?: number;
    additional_commission?: number | null;
    test_mode?: boolean;
    is_active?: boolean;
    display_name?: string | null;
    category?: string | null;
    icon_url?: string | null;
    min_amount?: number | null;
    order?: number;
}
