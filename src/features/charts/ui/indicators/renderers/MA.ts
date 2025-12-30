import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMA } from '@src/shared/lib/indicators';

export const MARenderer: IndicatorRenderer = {
  name: 'MA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ma = calculateMA(candles, 20);
    
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    ma.forEach((value, index) => {
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

