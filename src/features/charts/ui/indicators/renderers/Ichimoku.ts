import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateIchimoku } from '@src/shared/lib/indicators';

export const IchimokuRenderer: IndicatorRenderer = {
  name: 'Ichimoku',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ichimoku = calculateIchimoku(candles);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FF69B4';
    ctx.beginPath();
    let firstPoint = true;
    
    ichimoku.tenkanSen.forEach((value, index) => {
      if (!isNaN(value)) {
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(value);
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
    ctx.strokeStyle = '#4169E1';
    ctx.beginPath();
    firstPoint = true;
    
    ichimoku.kijunSen.forEach((value, index) => {
      if (!isNaN(value)) {
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(value);
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

