import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateParabolicSAR } from '@src/shared/lib/indicators';

export const ParabolicSARRenderer: IndicatorRenderer = {
  name: 'ParabolicSAR',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const sar = calculateParabolicSAR(candles);
    
    sar.sar.forEach((value, index) => {
      if (!isNaN(value)) {
        const x = xScale.getPixelForValue(candles[index].x);
        const y = yScale.getPixelForValue(value);
        ctx.fillStyle = sar.trend[index] === 'up' ? '#00BCD4' : '#FF5722';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
};

