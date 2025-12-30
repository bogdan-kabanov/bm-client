import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateBollingerBands } from '@src/shared/lib/indicators';

export const BollingerRenderer: IndicatorRenderer = {
  name: 'Bollinger',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const bb = calculateBollingerBands(candles);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
    ctx.beginPath();
    let firstPoint = true;
    
    bb.upper.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.3)';
    ctx.beginPath();
    firstPoint = true;
    
    bb.middle.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
    ctx.beginPath();
    firstPoint = true;
    
    bb.lower.forEach((value, index) => {
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

