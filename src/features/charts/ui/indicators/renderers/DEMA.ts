import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateDEMA } from '@src/shared/lib/indicators';

export const DEMARenderer: IndicatorRenderer = {
  name: 'DEMA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const dema = calculateDEMA(candles, 20);
    
    ctx.strokeStyle = '#00ACC1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    dema.forEach((value, index) => {
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

