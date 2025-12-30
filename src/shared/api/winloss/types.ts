export interface BaseWinLossConfig {
  id?: number;
  user_id: number;
  enabled: boolean;
  active_variant: 1 | 2 | null;
  custom_quotes_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Variant1Config {
  enabled: boolean;
  winrate_percent: number;
  window_size: number;
}

export interface Variant2Config {
  enabled: boolean;
  start_percent: number;
  min_percent: number;
  step_percent: number;
  current_percent: number;
}

export interface UserWinLossConfig extends BaseWinLossConfig {
  variant1: Variant1Config;
  variant2: Variant2Config;
}

export interface Variant1Stats {
  window_trades: Array<{ 
    trade_id: number; 
    outcome: 'win' | 'loss'; 
    timestamp: number 
  }>;
  window_win_count: number;
  window_loss_count: number;
  total_wins: number;
  total_losses: number;
  last_updated?: string;
}

export interface Variant2Stats {
  consecutive_wins: number;
  total_wins: number;
  total_losses: number;
  last_updated?: string;
}

export interface UserWinLossStats {
  id?: number;
  user_id: number;
  config_id?: number;
  variant1: Variant1Stats;
  variant2: Variant2Stats;
  total_wins: number;
  total_losses: number;
  last_updated?: string;
}

export interface UserCustomCandle {
  id?: number;
  user_id: number;
  symbol: string;
  timeframe: string;
  start_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  turnover?: string;
  confirm?: boolean;
  trade_id?: number;
  is_sent?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type WinLossVariant = 1 | 2 | null;
