import { useRef, useCallback, RefObject } from 'react';
import { Candle } from '../types';

interface UseChartAnimationParams {
  chartRef: RefObject<any>;
  tempCandles: RefObject<Candle[]>;
  currentPriceRef: RefObject<number | null>;
  lastCandleRef: RefObject<Candle | null>;
  priceLineRendererRef: RefObject<any>;
}

export const useChartAnimation = ({
  chartRef,
  tempCandles,
  currentPriceRef,
  lastCandleRef,
  priceLineRendererRef,
}: UseChartAnimationParams) => {
  const targetCandleRef = useRef<Candle | null>(null);
  const startCandleRef = useRef<Candle | null>(null);
  const candleAnimationFrameRef = useRef<number | null>(null);
  const isAnimatingCandleRef = useRef<boolean>(false);
  const lastAnimatedSetRef = useRef<number>(0);
  const pendingTargetCandleRef = useRef<Candle | null>(null);
  const prevDeltaRef = useRef<number>(0);

  const animateCandleUpdate = useCallback(() => {
    if (!chartRef.current || !targetCandleRef.current) {
      isAnimatingCandleRef.current = false;
      candleAnimationFrameRef.current = null;
      targetCandleRef.current = null;
      startCandleRef.current = null;
      return;
    }

    const chartInstance = chartRef.current;
    const dataset = chartInstance.data?.datasets?.[0];
    
    if (!dataset || !dataset.data || dataset.data.length === 0) {
      isAnimatingCandleRef.current = false;
      candleAnimationFrameRef.current = null;
      targetCandleRef.current = null;
      startCandleRef.current = null;
      return;
    }

    const candles = tempCandles.current;
    if (candles.length === 0) {
      isAnimatingCandleRef.current = false;
      candleAnimationFrameRef.current = null;
      targetCandleRef.current = null;
      startCandleRef.current = null;
      return;
    }

    const lastCandle = candles[candles.length - 1];
    let targetCandle = targetCandleRef.current;

    if (lastCandle.x !== targetCandle.x) {
      isAnimatingCandleRef.current = false;
      candleAnimationFrameRef.current = null;
      targetCandleRef.current = null;
      startCandleRef.current = null;
      return;
    }

    if (pendingTargetCandleRef.current && pendingTargetCandleRef.current.x === lastCandle.x) {
      targetCandle = pendingTargetCandleRef.current;
      targetCandleRef.current = { ...targetCandle };
      pendingTargetCandleRef.current = null;
    }

    if (!startCandleRef.current || startCandleRef.current.x !== targetCandle.x) {
      startCandleRef.current = { ...lastCandle };
    }

    const THRESHOLD = 1e-10;

    const oDiff = targetCandle.o - lastCandle.o;
    const hDiff = targetCandle.h - lastCandle.h;
    const lDiff = targetCandle.l - lastCandle.l;
    const cDiff = targetCandle.c - lastCandle.c;

    const priceScale = Math.max(1e-12, Math.abs(targetCandle.c || 1));
    const absCDiff = Math.abs(cDiff);
    const relCDiff = absCDiff / priceScale;

    let smoothingFactor: number;
    if (relCDiff < 0.0001) {
      smoothingFactor = 0.15;
    } else if (relCDiff < 0.001) {
      smoothingFactor = 0.20;
    } else {
      smoothingFactor = 0.30;
    }

    if (Math.abs(hDiff) > THRESHOLD) {
      lastCandle.h = targetCandle.h;
    }

    if (Math.abs(lDiff) > THRESHOLD) {
      lastCandle.l = targetCandle.l;
    }

    if (Math.abs(oDiff) > THRESHOLD) {
      lastCandle.o = targetCandle.o;
    }

    const needsUpdate = Math.abs(cDiff) > THRESHOLD;

    if (needsUpdate) {
      const directionChanged = prevDeltaRef.current * cDiff < 0;
      const alpha = directionChanged ? smoothingFactor * 0.4 : smoothingFactor;

      lastCandle.c += cDiff * alpha;

      prevDeltaRef.current = cDiff;
      currentPriceRef.current = lastCandle.c;

      if (lastCandleRef.current) {
        lastCandleRef.current = { ...lastCandle };
      }

      const savedZoom = chartInstance.scales?.x ? {
        min: chartInstance.scales.x.min,
        max: chartInstance.scales.x.max,
      } : null;

      dataset.data = candles.map((candle) => ({
        x: candle.x,
        o: candle.o,
        h: candle.h,
        l: candle.l,
        c: candle.c,
      }));

      
      if (savedZoom && chartInstance.scales?.x) {
        chartInstance.scales.x.min = savedZoom.min;
        chartInstance.scales.x.max = savedZoom.max;
      }
      
      chartInstance.draw();
      
      if (priceLineRendererRef.current) {
        priceLineRendererRef.current.updatePrice(lastCandle.c);
      }
      
      candleAnimationFrameRef.current = requestAnimationFrame(animateCandleUpdate);
    } else {
      
      lastCandle.h = targetCandle.h;
      lastCandle.l = targetCandle.l;
      lastCandle.o = targetCandle.o;

      const finalCDiff = targetCandle.c - lastCandle.c;
      const finalThreshold = 1e-10;
      
      if (Math.abs(finalCDiff) > finalThreshold) {
        const finalAlpha = 0.3;
        lastCandle.c += finalCDiff * finalAlpha;
        
        currentPriceRef.current = lastCandle.c;
        if (lastCandleRef.current) {
          lastCandleRef.current = { ...lastCandle };
        }
        
        const savedZoom = chartInstance.scales?.x ? {
          min: chartInstance.scales.x.min,
          max: chartInstance.scales.x.max,
        } : null;

        dataset.data = candles.map((candle) => ({
          x: candle.x,
          o: candle.o,
          h: candle.h,
          l: candle.l,
          c: candle.c,
        }));
        
        
        if (savedZoom && chartInstance.scales?.x) {
          chartInstance.scales.x.min = savedZoom.min;
          chartInstance.scales.x.max = savedZoom.max;
        }
        
        chartInstance.draw();
        
        if (priceLineRendererRef.current) {
          priceLineRendererRef.current.updatePrice(lastCandle.c);
        }
        
        candleAnimationFrameRef.current = requestAnimationFrame(animateCandleUpdate);
        return;
      }
      
      lastCandle.c = targetCandle.c;

      currentPriceRef.current = targetCandle.c;
      
      if (priceLineRendererRef.current) {
        priceLineRendererRef.current.updatePrice(targetCandle.c);
      }
      
      if (lastCandleRef.current) {
        lastCandleRef.current = { ...targetCandle };
      }

      tempCandles.current = candles;

      const savedZoom = chartInstance.scales?.x ? {
        min: chartInstance.scales.x.min,
        max: chartInstance.scales.x.max,
      } : null;

      dataset.data = candles.map((candle) => ({
        x: candle.x,
        o: candle.o,
        h: candle.h,
        l: candle.l,
        c: candle.c,
      }));

      
      if (savedZoom && chartInstance.scales?.x) {
        chartInstance.scales.x.min = savedZoom.min;
        chartInstance.scales.x.max = savedZoom.max;
      }
      
      chartInstance.draw();
      
      if (priceLineRendererRef.current) {
        priceLineRendererRef.current.updatePrice(targetCandle.c);
      }
      
      isAnimatingCandleRef.current = false;
      candleAnimationFrameRef.current = null;
      targetCandleRef.current = null;
      startCandleRef.current = null;
    }
  }, [
    chartRef,
    tempCandles,
    currentPriceRef,
    lastCandleRef,
    priceLineRendererRef,
  ]);

  return {
    targetCandleRef,
    startCandleRef,
    candleAnimationFrameRef,
    isAnimatingCandleRef,
    lastAnimatedSetRef,
    pendingTargetCandleRef,
    animateCandleUpdate,
  };
};

