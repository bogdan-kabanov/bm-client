import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateKeltnerChannels } from '@src/shared/lib/indicators';

export const KeltnerRenderer: IndicatorRenderer = {
  name: 'Keltner',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const keltner = calculateKeltnerChannels(candles, 20, 2);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(156, 39, 176, 0.5)';
    ctx.beginPath();
    let firstPoint = true;
    
    keltner.upper.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(156, 39, 176, 0.3)';
    ctx.beginPath();
    firstPoint = true;
    
    keltner.middle.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(156, 39, 176, 0.5)';
    ctx.beginPath();
    firstPoint = true;
    
    keltner.lower.forEach((value, index) => {
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

