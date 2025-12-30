import type { ActiveTrade } from '@src/entities/trading/model/types';
import type { CanvasChartHandle } from '../chart/types';

export type ChartTimeframe =
  | '15s'
  | '30s'
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h';

export type ChartView = 'line' | 'area';

export interface Candle {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
  anomaly?: boolean;
}

