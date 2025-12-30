import type { ChartTimeframe } from '@/src/features/charts/ui/types';

export type ChartViewMode = 'candles' | 'line' | 'area';

export const getChartViewOptions = (t: (key: string) => string): Array<{ id: ChartViewMode; label: string }> => [
  { id: 'candles', label: t('trading.chartViewCandles') },
  { id: 'line', label: t('trading.chartViewLine') },
  { id: 'area', label: t('trading.chartViewArea') },
];

export const CHART_VIEW_SEQUENCE: ChartViewMode[] = ['candles', 'line', 'area'];

export const TIMEFRAME_OPTIONS: Array<{ value: ChartTimeframe; label: string }> = [
  { value: '15s', label: '15s' },
  { value: '30s', label: '30s' },
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
];

