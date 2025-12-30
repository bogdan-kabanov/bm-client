import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateAroonOscillator } from '@src/shared/lib/indicators';

export const AroonOscRenderer: IndicatorRenderer = {
  name: 'AroonOsc',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const aroonOsc = calculateAroonOscillator(candles, 14);
    
    // Aroon Oscillator от -100 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let firstPoint = true;
    
    aroonOsc.forEach((value, index) => {
      if (!isNaN(value)) {
        // Преобразуем -100..100 в 0..1
        const normalizedValue = (value + 100) / 200; // 0-1
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
    ctx.setLineDash([]);
    
    // Рисуем нулевую линию
    ctx.strokeStyle = 'rgba(121, 85, 72, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const zeroY = oscBottom - (oscHeight / 2); // 0 соответствует середине
    ctx.beginPath();
    ctx.moveTo(chartArea.left, zeroY);
    ctx.lineTo(chartArea.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

