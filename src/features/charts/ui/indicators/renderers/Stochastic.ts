import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateStochastic } from '@src/shared/lib/indicators';

export const StochasticRenderer: IndicatorRenderer = {
  name: 'Stochastic',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const stoch = calculateStochastic(candles, 14, 3);
    
    // Stochastic от 0 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00BCD4';
    ctx.beginPath();
    let firstPoint = true;
    
    stoch.k.forEach((value, index) => {
      if (!isNaN(value)) {
        const normalizedValue = value / 100; // 0-1
        const y = oscBottom - (normalizedValue * oscHeight);
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
    ctx.strokeStyle = '#FF9800';
    ctx.beginPath();
    firstPoint = true;
    
    stoch.d.forEach((value, index) => {
      if (!isNaN(value)) {
        const normalizedValue = value / 100; // 0-1
        const y = oscBottom - (normalizedValue * oscHeight);
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
    
    // Рисуем линии уровней 20 и 80
    ctx.strokeStyle = 'rgba(0, 188, 212, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const level20Y = oscBottom - (0.2 * oscHeight);
    const level80Y = oscBottom - (0.8 * oscHeight);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, level20Y);
    ctx.lineTo(chartArea.right, level20Y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chartArea.left, level80Y);
    ctx.lineTo(chartArea.right, level80Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

