import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateATR } from '@src/shared/lib/indicators';

export const ATRRenderer: IndicatorRenderer = {
  name: 'ATR',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const atr = calculateATR(candles, 14);
    const lastCandle = candles[candles.length - 1];
    
    if (lastCandle) {
      const currentATR = atr[atr.length - 1];
      if (!isNaN(currentATR)) {
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        const x = xScale.getPixelForValue(lastCandle.x);
        const upperY = yScale.getPixelForValue(lastCandle.c + currentATR);
        const lowerY = yScale.getPixelForValue(lastCandle.c - currentATR);
        ctx.beginPath();
        ctx.moveTo(x, upperY);
        ctx.lineTo(x, lowerY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
};

