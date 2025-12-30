import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateEMA } from '@src/shared/lib/indicators';

export const EMARenderer: IndicatorRenderer = {
  name: 'EMA',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ema = calculateEMA(candles, 20);
    
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let firstPoint = true;
    
    ema.forEach((value, index) => {
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

