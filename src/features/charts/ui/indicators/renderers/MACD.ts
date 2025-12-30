import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMACD } from '@src/shared/lib/indicators';

export const MACDRenderer: IndicatorRenderer = {
  name: 'MACD',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles, chartArea } = context;
    const macdData = calculateMACD(candles);
    
    // Объединяем все значения MACD и signal для нормализации
    const allValues = [...macdData.macd, ...macdData.signal].filter(v => !isNaN(v));
    if (allValues.length === 0) return;
    
    const minMACD = Math.min(...allValues);
    const maxMACD = Math.max(...allValues);
    const rangeMACD = maxMACD - minMACD || 1;
    
    // Нормализуем MACD к диапазону цен (используем нижние 30% графика)
    const macdHeight = (chartArea.bottom - chartArea.top) * 0.3;
    const macdBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.1;
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FF00FF';
    ctx.beginPath();
    let firstPoint = true;
    
    macdData.macd.forEach((value, index) => {
      if (!isNaN(value)) {
        const normalizedValue = (value - minMACD) / rangeMACD; // 0-1
        const y = macdBottom - (normalizedValue * macdHeight);
        const x = xScale.getPixelForValue(candles[index].x);
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
    ctx.strokeStyle = '#FFA500';
    ctx.beginPath();
    firstPoint = true;
    
    macdData.signal.forEach((value, index) => {
      if (!isNaN(value)) {
        const normalizedValue = (value - minMACD) / rangeMACD; // 0-1
        const y = macdBottom - (normalizedValue * macdHeight);
        const x = xScale.getPixelForValue(candles[index].x);
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
  }
};

