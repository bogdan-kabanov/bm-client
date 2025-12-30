export interface SyntheticQuoteConfig {
  id: number;
  symbol: string;
  enabled: boolean;
  tick_interval_min_ms: number;
  tick_interval_max_ms: number;
  second_15_max_move_percent?: number;
  base_volatility: number;
  drift_strength: number;
  mean_reversion_strength: number;
  bias: number;
  timeframes: string[];
  pattern_type?: string;
  pattern_amplitude?: number;
  pattern_frequency?: number;
  pattern_period_ms?: number;
  trend_type?: string;
  cycle_duration_ms?: number;
  spike_probability?: number;
  spike_amplitude?: number;
  wave_count?: number;
  trend_strength?: number;
  boundary_overshoot_percent?: number;
  last_real_anchor_price: number | null;
  last_real_anchor_at: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyntheticCandle {
  start: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  turnover: string;
  confirm: boolean;
}
