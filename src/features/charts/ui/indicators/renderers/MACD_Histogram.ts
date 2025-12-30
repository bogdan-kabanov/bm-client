import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMACD } from '@src/shared/lib/indicators';

export const MACDHistogramRenderer: IndicatorRenderer = {
  name: 'MACD_Histogram',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const macdData = calculateMACD(candles);
    
    // Находим минимальное и максимальное значения гистограммы для нормализации
    const validHistogram = macdData.histogram.filter(v => !isNaN(v));
    if (validHistogram.length === 0) return;
    
    const minHist = Math.min(...validHistogram);
    const maxHist = Math.max(...validHistogram);
    const rangeHist = maxHist - minHist || 1;
    const chartHeight = chartArea.bottom - chartArea.top;
    const histogramHeight = chartHeight * 0.15; // Занимаем 15% высоты графика
    const scale = histogramHeight / rangeHist;
    const zeroLineY = chartArea.bottom - chartHeight * 0.1; // Нулевая линия внизу графика (10% от низа)
    
    macdData.histogram.forEach((value, index) => {
      if (!isNaN(value)) {
        const x = xScale.getPixelForValue(candles[index].x);
        // Нормализуем значение относительно минимума
        const normalizedValue = (value - minHist) * scale;
        const zeroNormalized = (0 - minHist) * scale; // Нормализованное значение нуля
        const barHeight = Math.abs(normalizedValue - zeroNormalized);
        const barY = value >= 0 
          ? zeroLineY - (normalizedValue - zeroNormalized)
          : zeroLineY - (zeroNormalized - normalizedValue);
        ctx.fillStyle = value >= 0 ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)';
        ctx.fillRect(x - 2, Math.min(zeroLineY, barY), 4, barHeight);
      }
    });
  }
};

