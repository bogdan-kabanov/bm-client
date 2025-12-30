import { ChartTimeframe } from '../types';

/**
 * Конфигурация для разных таймфреймов
 */
export interface TimeframeConfig {
  /** Коэффициент ширины свечи (0-1) */
  widthCoefficient: number;
  /** Базовый интервал для вычисления ширины (в миллисекундах) */
  baseWidthInterval?: number;
}

/**
 * Настройки для каждого таймфрейма
 */
export const TIMEFRAME_CONFIG: Record<ChartTimeframe, TimeframeConfig> = {
  '15s': {
    widthCoefficient: 0.42,
    baseWidthInterval: 15 * 1000,
  },
  '30s': {
    widthCoefficient: 0.42,
    baseWidthInterval: 30 * 1000,
  },
  '1m': {
    widthCoefficient: 0.42,
    baseWidthInterval: 60 * 1000,
  },
  '5m': {
    widthCoefficient: 0.42,
  },
  '15m': {
    widthCoefficient: 0.42,
  },
  '30m': {
    widthCoefficient: 0.42,
  },
  '1h': {
    widthCoefficient: 0.42,
  },
};

/**
 * Получить конфигурацию для таймфрейма
 */
export const getTimeframeConfig = (timeframe: ChartTimeframe): TimeframeConfig => {
  return TIMEFRAME_CONFIG[timeframe] || {
    widthCoefficient: 0.42,
  };
};

/**
 * Таймфреймы, которые используют агрегацию из базового таймфрейма
 */
export const AGGREGATION_TIMEFRAMES: ChartTimeframe[] = ['1m'];

/**
 * Проверяет, нужно ли использовать агрегацию для данного таймфрейма
 */
export const shouldUseAggregation = (timeframe: ChartTimeframe): boolean => {
  return AGGREGATION_TIMEFRAMES.includes(timeframe);
};

