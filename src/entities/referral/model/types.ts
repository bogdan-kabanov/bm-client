export interface Referral {
  id: number;
  telegram_id: string;
  ref_id: string;
  is_trading: boolean;
  trading_banned: boolean;
  balance: string;
  balance_profit: string;
  coins: number;
  trading_duration: number | null;
  trading_start_time: string | null;
  firstname?: string | null;
  lastname?: string | null;
  wallets: string | null;
  banned: boolean;
  ref_balance: string;
  ref_count: number;
  total_ref_earnings: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReferralStats {
  ref_balance: string;
  ref_count: number;
  total_ref_earnings: string;
}

export interface ReferralsResponse {
  success: boolean;
  data: Referral[];
}

export interface ReferralStatsResponse {
  success: boolean;
  data: ReferralStats;
}