import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateDonchianChannels } from '@src/shared/lib/indicators';

export const DonchianRenderer: IndicatorRenderer = {
  name: 'Donchian',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const donchian = calculateDonchianChannels(candles, 20);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
    ctx.beginPath();
    let firstPoint = true;
    
    donchian.upper.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)';
    ctx.beginPath();
    firstPoint = true;
    
    donchian.middle.forEach((value, index) => {
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
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
    ctx.beginPath();
    firstPoint = true;
    
    donchian.lower.forEach((value, index) => {
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

