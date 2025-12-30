import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateRSI } from '@src/shared/lib/indicators';

export const RSIRenderer: IndicatorRenderer = {
  name: 'RSI',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const rsi = calculateRSI(candles, 14);
    
    // RSI от 0 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    let firstPoint = true;
    
    rsi.forEach((value, index) => {
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
    
    // Рисуем линии уровней 30 и 70
    ctx.strokeStyle = 'rgba(156, 39, 176, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const level30Y = oscBottom - (0.3 * oscHeight);
    const level70Y = oscBottom - (0.7 * oscHeight);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, level30Y);
    ctx.lineTo(chartArea.right, level30Y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chartArea.left, level70Y);
    ctx.lineTo(chartArea.right, level70Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

