import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateHMA } from '@src/shared/lib/indicators';

export const HMARenderer: IndicatorRenderer = {
  name: 'HMA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const hma = calculateHMA(candles, 20);
    
    ctx.strokeStyle = '#FF4081';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    hma.forEach((value, index) => {
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

