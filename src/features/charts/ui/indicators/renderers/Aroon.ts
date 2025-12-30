import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateAroon } from '@src/shared/lib/indicators';

export const AroonRenderer: IndicatorRenderer = {
  name: 'Aroon',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const aroon = calculateAroon(candles, 14);
    
    // Aroon от 0 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4CAF50';
    ctx.beginPath();
    let firstPoint = true;
    
    aroon.aroonUp.forEach((value, index) => {
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
    ctx.strokeStyle = '#F44336';
    ctx.beginPath();
    firstPoint = true;
    
    aroon.aroonDown.forEach((value, index) => {
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
  }
};

