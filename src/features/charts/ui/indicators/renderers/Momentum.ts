import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateMomentum } from '@src/shared/lib/indicators';

export const MomentumRenderer: IndicatorRenderer = {
  name: 'Momentum',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const momentum = calculateMomentum(candles, 10);
    
    ctx.strokeStyle = '#3F51B5';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    momentum.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice + value;
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
    ctx.setLineDash([]);
  }
};

