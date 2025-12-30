import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculatePPO } from '@src/shared/lib/indicators';

export const PPORenderer: IndicatorRenderer = {
  name: 'PPO',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ppo = calculatePPO(candles);
    
    ctx.strokeStyle = '#8BC34A';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    ppo.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice * (1 + value / 100);
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

