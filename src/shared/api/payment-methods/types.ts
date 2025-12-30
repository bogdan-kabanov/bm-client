export interface PaymentCategory {
  id: number;
  name: string;
  name_key: string;
  icon: string | null;
  is_active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: number;
  category_id: number;
  name: string;
  name_key: string;
  type: 'card' | 'crypto' | 'ewallet' | 'bank_transfer' | 'other';
  icon: string | null;
  is_active: boolean;
  description: string | null;
  show_header: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  category?: PaymentCategory;
}

export interface PaymentCard {
  id: number;
  payment_method_id: number;
  name: string;
  name_key: string;
  icon: string | null;
  is_active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCryptocurrency {
  id: number;
  payment_method_id: number;
  name: string;
  symbol: string;
  name_key: string;
  icon: string | null;
  wallet: string | null;
  network: string | null;
  qr_code_image: string | null;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCategoryCountry {
  id: number;
  category_id: number;
  country_code: string;
  is_active: boolean;
}

export interface PaymentMethodCountry {
  id: number;
  payment_method_id: number;
  country_code: string;
  is_active: boolean;
}

export interface PaymentCardCountry {
  id: number;
  card_id: number;
  country_code: string;
  is_active: boolean;
}

export interface PaymentCryptocurrencyCountry {
  id: number;
  cryptocurrency_id: number;
  country_code: string;
  is_active: boolean;
}

export interface StructuredCryptocurrency {
  id: number;
  name: string;
  symbol: string;
  name_key: string;
  icon: string | null;
  wallet: string | null;
  network: string | null;
  qr_code_image: string | null;
  min_amount: number | null;
  max_amount: number | null;
  order: number;
}

export interface StructuredCard {
  id: number;
  name: string;
  name_key: string;
  icon: string | null;
  order: number;
}

export interface StructuredMethod {
  id: number;
  name: string;
  name_key: string;
  type: 'card' | 'crypto' | 'ewallet' | 'bank_transfer' | 'other';
  icon: string | null;
  description: string | null;
  show_header: boolean;
  order: number;
  min_amount: number | null;
  max_amount: number | null;
  cryptocurrencies: StructuredCryptocurrency[];
  cards: StructuredCard[];
}

export interface StructuredCategory {
  id: number;
  name: string;
  name_key: string;
  icon: string | null;
  order: number;
  methods: StructuredMethod[];
}
