export interface CurrencyCategory {
  id: number;
  name: string;
  name_en: string;
  order: number;
  is_active: boolean;
  icon_url?: string | null;
  currencies?: Currency[];
}

export interface Currency {
  id: number;
  category_id: number;
  symbol: string;
  display_name: string;
  base_currency: string;
  quote_currency: string;
  bybit_symbol: string | null;
  exchange_source: 'bybit';
  profit_percentage: number;
  order: number;
  is_active: boolean;
  icon: string | null;
  average_price?: number | null;
  avg_price?: number | null;
  profit_1m?: number | null;
  profit_5m?: number | null;
  payout_1m?: number | null;
  payout_5m?: number | null;
  category?: CurrencyCategory;
}
