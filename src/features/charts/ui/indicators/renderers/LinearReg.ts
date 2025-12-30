import { IndicatorRenderer, IndicatorRenderContext } from '../types';
import { calculateLinearRegression } from '@src/shared/lib/indicators';

export const LinearRegRenderer: IndicatorRenderer = {
  name: 'LinearReg',
  minCandles: 20,
  
  render(context: IndicatorRenderContext) {
    const { ctx, xScale, yScale, candles } = context;
    const lr = calculateLinearRegression(candles, 14);
    
    ctx.strokeStyle = '#FF5722';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let firstPoint = true;
    
    lr.intercept.forEach((intercept, index) => {
      if (!isNaN(intercept) && !isNaN(lr.slope[index])) {
        const x = xScale.getPixelForValue(candles[index].x);
        const predictedValue = intercept + lr.slope[index] * 14;
        const y = yScale.getPixelForValue(predictedValue);
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

