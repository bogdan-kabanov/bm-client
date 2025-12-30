import { useRef, useCallback, RefObject } from 'react';
import { Candle } from '../types';

interface UseChartAdaptiveParams {
  tempCandles: RefObject<Candle[]>;
}

export const useChartAdaptive = ({ tempCandles }: UseChartAdaptiveParams) => {
  const lastAdaptiveIntervalRef = useRef<number>(200);

  const getAdaptiveUpdateIntervalMs = useCallback(() => {
    const candles = tempCandles.current;
    if (!Array.isArray(candles) || candles.length < 2) {
      return lastAdaptiveIntervalRef.current || 200;
    }
    const last20 = candles.slice(Math.max(0, candles.length - 20));
    let bodySum = 0;
    let rangeSum = 0;
    let count = 0;
    for (const c of last20) {
      const o = c.o, h = c.h, l = c.l, cl = c.c;
      if ([o, h, l, cl].every(Number.isFinite) && o > 0) {
        const body = Math.abs(cl - o) / o;
        const range = Math.max(0, (h - l) / o);
        bodySum += body;
        rangeSum += range;
        count++;
      }
    }
    if (count === 0) {
      return lastAdaptiveIntervalRef.current || 200;
    }
    const bodyAvg = bodySum / count;
    const wickiness = Math.max(0, (rangeSum / count) - bodyAvg);
    const vol = bodyAvg * 0.65 + wickiness * 0.35;
    const volClamped = Math.max(0.0003, Math.min(0.012, vol));
    const minMs = 110;
    const maxMs = 380;
    const t = (Math.log(volClamped) - Math.log(0.0003)) / (Math.log(0.012) - Math.log(0.0003));
    const interval = Math.round(maxMs - Math.max(0, Math.min(1, t)) * (maxMs - minMs));
    lastAdaptiveIntervalRef.current = interval;
    return interval;
  }, []);

  const getVolatilityParams = useCallback(() => {
    const candles = tempCandles.current;
    const n = candles.length;
    if (n < 2) {
      return {
        thresholdAbs: 0,
        smoothingAlpha: 0.02,
        relATR: 0.0008,
      };
    }
    const last20 = candles.slice(Math.max(0, n - 20));
    let prevClose: number | null = null;
    let atrSum = 0;
    let count = 0;
    const lastClose = candles[n - 1]?.c ?? 0;
    for (const c of last20) {
      const o = c.o, h = c.h, l = c.l, cl = c.c;
      if ([o, h, l, cl].every(Number.isFinite)) {
        if (prevClose == null) {
          prevClose = cl;
          continue;
        }
        const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
        atrSum += tr;
        count++;
        prevClose = cl;
      }
    }
    if (count === 0) {
      return {
        thresholdAbs: Math.max(1e-8, Math.abs((candles[n - 1]?.c ?? 0)) * 1e-5),
        smoothingAlpha: 0.02,
        relATR: 0.0008,
      };
    }
    const atr = atrSum / count;
    const priceScale = Math.max(1e-12, Math.abs(lastClose || 0));
    const relATR = atr / priceScale;
    const thresholdRel = Math.max(0.00005, Math.min(0.003, relATR * 0.45));
    const thresholdAbs = priceScale * thresholdRel;
    const alphaMin = 0.015;
    const alphaMax = 0.04;
    const t = Math.max(0, Math.min(1, (Math.log(Math.max(relATR, 1e-6)) - Math.log(0.0003)) / (Math.log(0.012) - Math.log(0.0003))));
    const smoothingAlpha = alphaMin + t * (alphaMax - alphaMin);
    return { thresholdAbs, smoothingAlpha, relATR };
  }, []);

  return {
    getAdaptiveUpdateIntervalMs,
    getVolatilityParams,
    lastAdaptiveIntervalRef,
  };
};

