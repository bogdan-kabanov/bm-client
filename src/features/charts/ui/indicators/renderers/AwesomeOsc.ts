import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateAwesomeOscillator } from '@src/shared/lib/indicators';

export const AwesomeOscRenderer: IndicatorRenderer = {
  name: 'AwesomeOsc',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const ao = calculateAwesomeOscillator(candles);
    
    // Находим минимальное и максимальное значения для нормализации
    const validAO = ao.filter(v => !isNaN(v));
    if (validAO.length === 0) return;
    
    const minAO = Math.min(...validAO);
    const maxAO = Math.max(...validAO);
    const rangeAO = maxAO - minAO || 1;
    const chartHeight = chartArea.bottom - chartArea.top;
    const histogramHeight = chartHeight * 0.15; // Занимаем 15% высоты графика
    const scale = histogramHeight / rangeAO;
    const zeroLineY = chartArea.bottom - chartHeight * 0.1; // Нулевая линия внизу графика (10% от низа)
    
    ao.forEach((value, index) => {
      if (!isNaN(value)) {
        const x = xScale.getPixelForValue(candles[index].x);
        // Нормализуем значение относительно минимума
        const normalizedValue = (value - minAO) * scale;
        const zeroNormalized = (0 - minAO) * scale; // Нормализованное значение нуля
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

