import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateADX } from '@src/shared/lib/indicators';

export const ADXRenderer: IndicatorRenderer = {
  name: 'ADX',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, candles, chartArea } = context;
    const adxData = calculateADX(candles, 14);
    
    // ADX и DI от 0 до 100, отображаем в нижних 20% графика
    const oscHeight = (chartArea.bottom - chartArea.top) * 0.2;
    const oscBottom = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.05;
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FF5722';
    ctx.beginPath();
    let firstPoint = true;
    
    adxData.adx.forEach((value, index) => {
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
    ctx.strokeStyle = '#00E676';
    ctx.beginPath();
    firstPoint = true;
    
    adxData.plusDI.forEach((value, index) => {
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
    ctx.strokeStyle = '#FF1744';
    ctx.beginPath();
    firstPoint = true;
    
    adxData.minusDI.forEach((value, index) => {
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

