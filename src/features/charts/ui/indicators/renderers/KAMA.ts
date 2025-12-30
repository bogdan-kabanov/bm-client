import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateKAMA } from '@src/shared/lib/indicators';

export const KAMARenderer: IndicatorRenderer = {
  name: 'KAMA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const kama = calculateKAMA(candles, 14);
    
    ctx.strokeStyle = '#009688';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    kama.forEach((value, index) => {
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

