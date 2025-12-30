import type { ChartData } from 'chart.js';
import type { Candle } from '../types';

interface CreateChartDataParams {
  selectedBase: string;
  candles: Candle[];
  tempCandles: React.MutableRefObject<Candle[]>;
  appendDebugLog: (message: string) => void;
}

export const createChartData = ({
  selectedBase,
  candles,
  tempCandles,
  appendDebugLog,
}: CreateChartDataParams): ChartData<any> => {
  const currentCandles = candles.length > 0 ? candles : tempCandles.current;
  appendDebugLog(`📊 [CHART_DATA] chartData обновлен: candles.length=${candles.length}, tempCandles.length=${tempCandles.current.length}, currentCandles.length=${currentCandles.length}`);
  if (currentCandles.length > 0) {
    appendDebugLog(`📊 [CHART_DATA] Последняя свеча в chartData: x=${new Date(currentCandles[currentCandles.length - 1].x).toLocaleTimeString()}`);
  }
  
  return {
    datasets: [
      {
        label: `${selectedBase}/USDT`,
        data: currentCandles,
        backgroundColors: {
          up: '#2ECC71',
          down: '#E74C3C',
          unchanged: '#8FA2C2',
        },
        borderColors: {
          up: '#2ECC71',
          down: '#E74C3C',
          unchanged: '#8FA2C2',
        },
        backgroundColor: (ctx: any) => {
          const candle = ctx.raw;
          if (!candle || typeof candle !== 'object') return '#2ECC71';
          const isUp = candle.c >= candle.o;
          const isDown = candle.c < candle.o;
          if (isUp) return '#2ECC71';
          if (isDown) return '#E74C3C';
          return '#8FA2C2';
        },
        borderColor: (ctx: any) => {
          const candle = ctx.raw;
          if (!candle || typeof candle !== 'object') return '#2ECC71';
          const isUp = candle.c >= candle.o;
          const isDown = candle.c < candle.o;
          if (isUp) return '#2ECC71';
          if (isDown) return '#E74C3C';
          return '#8FA2C2';
        },
        hoverBackgroundColor: (ctx: any) => {
          const dataset = ctx.dataset;
          const colors = dataset.backgroundColors || dataset.backgroundColor || {
            up: '#2ECC71',
            down: '#E74C3C',
            unchanged: '#8FA2C2',
          };
          const candle = ctx.raw;
          if (!candle || typeof candle !== 'object') {
            return typeof colors === 'object' && colors && typeof colors.up === 'string' ? colors.up : '#2ECC71';
          }
          const isUp = candle.c >= candle.o;
          const isDown = candle.c < candle.o;
          if (isUp) {
            return typeof colors === 'object' && colors && typeof colors.up === 'string' ? colors.up : '#2ECC71';
          }
          if (isDown) {
            return typeof colors === 'object' && colors && typeof colors.down === 'string' ? colors.down : '#E74C3C';
          }
          return typeof colors === 'object' && colors && typeof colors.unchanged === 'string' ? colors.unchanged : '#8FA2C2';
        },
        hoverBorderColor: (ctx: any) => {
          const dataset = ctx.dataset;
          const colors = dataset.borderColors || dataset.borderColor || {
            up: '#2ECC71',
            down: '#E74C3C',
            unchanged: '#8FA2C2',
          };
          const candle = ctx.raw;
          if (!candle || typeof candle !== 'object') {
            return typeof colors === 'object' && colors && typeof colors.up === 'string' ? colors.up : '#2ECC71';
          }
          const isUp = candle.c >= candle.o;
          const isDown = candle.c < candle.o;
          if (isUp) {
            return typeof colors === 'object' && colors && typeof colors.up === 'string' ? colors.up : '#2ECC71';
          }
          if (isDown) {
            return typeof colors === 'object' && colors && typeof colors.down === 'string' ? colors.down : '#E74C3C';
          }
          return typeof colors === 'object' && colors && typeof colors.unchanged === 'string' ? colors.unchanged : '#8FA2C2';
        },
        borderWidth: 2,
        barPercentage: 0.8,
        categoryPercentage: 0.95,
      } as any,
    ],
  };
};

