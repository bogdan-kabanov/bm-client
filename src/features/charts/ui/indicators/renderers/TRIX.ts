import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateTRIX } from '@src/shared/lib/indicators';

export const TRIXRenderer: IndicatorRenderer = {
  name: 'TRIX',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const trix = calculateTRIX(candles, 14);
    
    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    trix.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice * (1 + value / 10000);
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(priceValue);
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

