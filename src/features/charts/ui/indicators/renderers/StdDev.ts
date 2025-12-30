import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMA, calculateStandardDeviation } from '@src/shared/lib/indicators';

export const StdDevRenderer: IndicatorRenderer = {
  name: 'StdDev',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ma = calculateMA(candles, 20);
    const stdDev = calculateStandardDeviation(candles, 20);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 195, 74, 0.5)';
    ctx.beginPath();
    let firstPoint = true;
    
    ma.forEach((value, index) => {
      if (!isNaN(value) && !isNaN(stdDev[index])) {
        const upper = value + stdDev[index];
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(upper);
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
    ctx.strokeStyle = 'rgba(139, 195, 74, 0.5)';
    ctx.beginPath();
    firstPoint = true;
    
    ma.forEach((value, index) => {
      if (!isNaN(value) && !isNaN(stdDev[index])) {
        const lower = value - stdDev[index];
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(lower);
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

