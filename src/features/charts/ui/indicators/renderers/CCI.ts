import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateCCI } from '@src/shared/lib/indicators';

export const CCIRenderer: IndicatorRenderer = {
  name: 'CCI',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const cci = calculateCCI(candles, 20);
    
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let firstPoint = true;
    const lastPrice = candles[candles.length - 1]?.c || 100;
    
    cci.forEach((value, index) => {
      if (!isNaN(value)) {
        const priceValue = lastPrice * (1 + value / 1000);
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

