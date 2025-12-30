import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateIchimoku } from '@src/shared/lib/indicators';

export const IchimokuFullRenderer: IndicatorRenderer = {
  name: 'Ichimoku_Full',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const ichimoku = calculateIchimoku(candles);
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FF69B4';
    ctx.beginPath();
    let firstPoint = true;
    
    ichimoku.tenkanSen.forEach((value, index) => {
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
    ctx.strokeStyle = '#4169E1';
    ctx.beginPath();
    firstPoint = true;
    
    ichimoku.kijunSen.forEach((value, index) => {
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
    ctx.fillStyle = 'rgba(0, 191, 255, 0.2)';
    ctx.beginPath();
    firstPoint = true;
    
    ichimoku.senkouSpanA.forEach((value, index) => {
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
    
    for (let i = ichimoku.senkouSpanB.length - 1; i >= 0; i--) {
      if (!isNaN(ichimoku.senkouSpanB[i])) {
        const x = xScale.getPixelForValue(candles[i].x);
        const y = yScale.getPixelForValue(ichimoku.senkouSpanB[i]);
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#32CD32';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    firstPoint = true;
    
    ichimoku.chikouSpan.forEach((value, index) => {
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
    ctx.setLineDash([]);
  }
};

