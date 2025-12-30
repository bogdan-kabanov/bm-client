import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateTEMA } from '@src/shared/lib/indicators';

export const TEMARenderer: IndicatorRenderer = {
  name: 'TEMA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const tema = calculateTEMA(candles, 20);
    
    ctx.strokeStyle = '#AB47BC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    tema.forEach((value, index) => {
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

