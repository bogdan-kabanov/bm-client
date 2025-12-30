import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateSTC } from '@src/shared/lib/indicators';

export const STCRenderer: IndicatorRenderer = {
  name: 'STC',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const stc = calculateSTC(candles);
    
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    stc.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice * (0.5 + value / 200);
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

