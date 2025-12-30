// ТОЛЬКО TypeScript интерфейсы и типы, БЕЗ логики!

// Базовый интерфейс для общих настроек Win/Loss
export interface BaseWinLossConfig {
  id?: number;
  user_id: number;
  enabled: boolean;
  active_variant: 1 | 2 | null; // активный вариант (null если выключено)
  custom_quotes_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// Интерфейс для настроек Варианта 1 (процент выигрыша от N сделок)
export interface Variant1Config {
  enabled: boolean;
  winrate_percent: number; // процент выигрыша (0-100)
  window_size: number; // размер окна сделок
}

// Интерфейс для настроек Варианта 2 (прогрессивная система)
export interface Variant2Config {
  enabled: boolean;
  start_percent: number; // стартовый процент
  min_percent: number; // минимальный процент
  step_percent: number; // шаг снижения
  current_percent: number; // текущий процент (только для чтения, обновляется автоматически)
}

// Полный интерфейс конфигурации (объединяет базовые настройки и настройки обоих вариантов)
// Настройки вариантов сохраняются независимо, но активен только один
export interface UserWinLossConfig extends BaseWinLossConfig {
  variant1: Variant1Config; // настройки варианта 1 (всегда присутствуют, даже если неактивен)
  variant2: Variant2Config; // настройки варианта 2 (всегда присутствуют, даже если неактивен)
}

// Интерфейс для статистики Варианта 1
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

// Интерфейс для статистики Варианта 2
export interface Variant2Stats {
  consecutive_wins: number; // подряд выигрышей
  total_wins: number;
  total_losses: number;
  last_updated?: string;
}

// Полный интерфейс статистики (объединяет статистику обоих вариантов)
// Статистика вариантов хранится независимо, обновляется только для активного варианта
export interface UserWinLossStats {
  id?: number;
  user_id: number;
  config_id?: number;
  variant1: Variant1Stats; // статистика варианта 1 (всегда присутствует)
  variant2: Variant2Stats; // статистика варианта 2 (всегда присутствует)
  // Общая статистика (для справки, вычисляется из вариантов):
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

