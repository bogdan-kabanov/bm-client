import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateFisherTransform } from '@src/shared/lib/indicators';

export const FisherRenderer: IndicatorRenderer = {
  name: 'Fisher',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const fisher = calculateFisherTransform(candles, 10);
    
    ctx.strokeStyle = '#9E9E9E';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    fisher.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice * (1 + value / 10);
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

