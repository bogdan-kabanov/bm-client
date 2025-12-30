import { ChartTimeframe } from '../types';

export const BYBIT_INTERVAL_MAP: Record<ChartTimeframe, string> = {
  '15s': '15',
  '30s': '30',
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
};

export const MAX_CANDLES = 200;
export const DEFAULT_TIMEFRAME: ChartTimeframe = '15s';
export const DEFAULT_CHART_VIEW = 'candles' as const;

