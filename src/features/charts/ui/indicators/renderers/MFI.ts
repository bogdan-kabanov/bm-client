import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMFI } from '@src/shared/lib/indicators';

export const MFIRenderer: IndicatorRenderer = {
  name: 'MFI',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const mfi = calculateMFI(candles, 14);
    
    // MFI от 0 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    let firstPoint = true;
    
    mfi.forEach((value, index) => {
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
    ctx.setLineDash([]);
    
    // Рисуем линии уровней 20 и 80
    ctx.strokeStyle = 'rgba(233, 30, 99, 0.3)';
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

