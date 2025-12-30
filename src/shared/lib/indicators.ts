// Утилиты для расчета технических индикаторов

// Интерфейс Candle удален - весь код, связанный со свечами, был удален из проекта

// Moving Average (MA)
export const calculateMA = (candles: Candle[], period: number): number[] => {
  const ma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      ma.push(NaN);
    } else {
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.c, 0);
      ma.push(sum / period);
    }
  }
  return ma;
};

// Exponential Moving Average (EMA)
export const calculateEMA = (candles: Candle[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      ema.push(candles[i].c);
    } else {
      ema.push((candles[i].c - ema[i - 1]) * multiplier + ema[i - 1]);
    }
  }
  return ema;
};

// MACD (Moving Average Convergence Divergence)
export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export const calculateMACD = (candles: Candle[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult => {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  
  const macd: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < slowPeriod - 1) {
      macd.push(NaN);
    } else {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // Сигнальная линия (EMA от MACD)
  const signal: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i])) {
      signal.push(NaN);
    } else if (i === 0) {
      signal.push(macd[i]);
    } else {
      const multiplier = 2 / (signalPeriod + 1);
      signal.push((macd[i] - signal[i - 1]) * multiplier + signal[i - 1]);
    }
  }
  
  // Гистограмма
  const histogram: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(macd[i]) || isNaN(signal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - signal[i]);
    }
  }
  
  return { macd, signal, histogram };
};

// RSI (Relative Strength Index)
export const calculateRSI = (candles: Candle[], period: number = 14): number[] => {
  const rsi: number[] = [];
  
  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    changes.push(candles[i].c - candles[i - 1].c);
  }
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      const gainPeriod = changes.slice(i - period, i).filter(c => c > 0);
      const lossPeriod = changes.slice(i - period, i).filter(c => c < 0).map(c => -c);
      
      const avgGain = gainPeriod.reduce((acc, g) => acc + g, 0) / period;
      const avgLoss = lossPeriod.reduce((acc, l) => acc + l, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }
  
  return rsi;
};

// Bollinger Bands
export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export const calculateBollingerBands = (candles: Candle[], period: number = 20, stdDev: number = 2): BollingerBandsResult => {
  const middle = calculateMA(candles, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const mean = middle[i];
      
      // Рассчитываем стандартное отклонение
      const variance = slice.reduce((acc, c) => acc + Math.pow(c.c - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  
  return { upper, middle, lower };
};

// Stochastic Oscillator
export interface StochasticResult {
  k: number[];
  d: number[];
}

export const calculateStochastic = (candles: Candle[], kPeriod: number = 14, dPeriod: number = 3): StochasticResult => {
  const k: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
    } else {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      const close = candles[i].c;
      
      if (highest === lowest) {
        k.push(50);
      } else {
        k.push(((close - lowest) / (highest - lowest)) * 100);
      }
    }
  }
  
  // D-line (SMA of K-line)
  const d: number[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < dPeriod - 1 || isNaN(k[i])) {
      d.push(NaN);
    } else {
      const sum = k.slice(i - dPeriod + 1, i + 1).reduce((acc, val) => acc + val, 0);
      d.push(sum / dPeriod);
    }
  }
  
  return { k, d };
};

// ATR (Average True Range)
export const calculateATR = (candles: Candle[], period: number = 14): number[] => {
  const tr: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(NaN);
    } else {
      const high = candles[i].h;
      const low = candles[i].l;
      const prevClose = candles[i - 1].c;
      
      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
  }
  
  const atr: number[] = [];
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1 || isNaN(tr[i])) {
      atr.push(NaN);
    } else {
      const sum = tr.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      atr.push(sum / period);
    }
  }
  
  return atr;
};

// ADX (Average Directional Index)
export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
}

export const calculateADX = (candles: Candle[], period: number = 14): ADXResult => {
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const adx: number[] = [];
  
  // Calculate +DM and -DM
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].h - candles[i - 1].h;
    const downMove = candles[i - 1].l - candles[i].l;
    
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
      plusDM.push(0);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }
  
  // Calculate TR and DI
  const trValues = calculateATR(candles, period);
  
  for (let i = 0; i < plusDM.length; i++) {
    if (i < period - 1 || isNaN(trValues[i + 1])) {
      plusDI.push(NaN);
      minusDI.push(NaN);
    } else {
      const plusDMsum = plusDM.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      const minusDMsum = minusDM.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      const tr = trValues[i + 1] * period;
      
      plusDI.push((plusDMsum / tr) * 100);
      minusDI.push((minusDMsum / tr) * 100);
    }
  }
  
  // Calculate ADX
  for (let i = 0; i < plusDI.length; i++) {
    if (isNaN(plusDI[i]) || isNaN(minusDI[i])) {
      adx.push(NaN);
    } else {
      const diSum = plusDI[i] + minusDI[i];
      const diDiff = Math.abs(plusDI[i] - minusDI[i]);
      
      if (diSum === 0) {
        adx.push(NaN);
      } else {
        adx.push((diDiff / diSum) * 100);
      }
    }
  }
  
  // Smooth ADX
  const smoothedADX: number[] = [];
  for (let i = 0; i < adx.length; i++) {
    if (i < period - 1 || isNaN(adx[i])) {
      smoothedADX.push(NaN);
    } else {
      const sum = adx.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      smoothedADX.push(sum / period);
    }
  }
  
  return { adx: smoothedADX, plusDI, minusDI };
};

// CCI (Commodity Channel Index)
export const calculateCCI = (candles: Candle[], period: number = 20): number[] => {
  const cci: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      cci.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const typicalPrices = slice.map(c => (c.h + c.l + c.c) / 3);
      const sma = typicalPrices.reduce((acc, tp) => acc + tp, 0) / period;
      
      const meanDeviation = typicalPrices.reduce((acc, tp) => acc + Math.abs(tp - sma), 0) / period;
      const currentTP = (candles[i].h + candles[i].l + candles[i].c) / 3;
      
      if (meanDeviation === 0) {
        cci.push(0);
      } else {
        cci.push((currentTP - sma) / (0.015 * meanDeviation));
      }
    }
  }
  
  return cci;
};

// Williams %R
export const calculateWilliamsR = (candles: Candle[], period: number = 14): number[] => {
  const wr: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      wr.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      const close = candles[i].c;
      
      if (highest === lowest) {
        wr.push(-50);
      } else {
        wr.push(((highest - close) / (highest - lowest)) * -100);
      }
    }
  }
  
  return wr;
};

// Ichimoku Cloud
export interface IchimokuResult {
  tenkanSen: number[];
  kijunSen: number[];
  senkouSpanA: number[];
  senkouSpanB: number[];
  chikouSpan: number[];
}

export const calculateIchimoku = (
  candles: Candle[], 
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): IchimokuResult => {
  const tenkanSen: number[] = [];
  const kijunSen: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    // Tenkan-sen (Conversion Line)
    if (i < tenkanPeriod - 1) {
      tenkanSen.push(NaN);
    } else {
      const slice = candles.slice(i - tenkanPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      tenkanSen.push((highest + lowest) / 2);
    }
    
    // Kijun-sen (Base Line)
    if (i < kijunPeriod - 1) {
      kijunSen.push(NaN);
    } else {
      const slice = candles.slice(i - kijunPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      kijunSen.push((highest + lowest) / 2);
    }
  }
  
  // Senkou Span A (Leading Span A)
  const senkouSpanA: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(tenkanSen[i]) || isNaN(kijunSen[i])) {
      senkouSpanA.push(NaN);
    } else {
      senkouSpanA.push((tenkanSen[i] + kijunSen[i]) / 2);
    }
  }
  
  // Senkou Span B (Leading Span B)
  const senkouSpanB: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < senkouBPeriod - 1) {
      senkouSpanB.push(NaN);
    } else {
      const slice = candles.slice(i - senkouBPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      senkouSpanB.push((highest + lowest) / 2);
    }
  }
  
  // Chikou Span (Lagging Span)
  const chikouSpan: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i + kijunPeriod >= candles.length) {
      chikouSpan.push(NaN);
    } else {
      chikouSpan.push(candles[i + kijunPeriod].c);
    }
  }
  
  return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
};

// Weighted Moving Average (WMA)
export const calculateWMA = (candles: Candle[], period: number): number[] => {
  const wma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      wma.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      let sum = 0;
      let weightSum = 0;
      slice.forEach((c, idx) => {
        const weight = period - idx;
        sum += c.c * weight;
        weightSum += weight;
      });
      wma.push(sum / weightSum);
    }
  }
  return wma;
};

// Parabolic SAR
export interface ParabolicSARResult {
  sar: number[];
  trend: ('up' | 'down')[];
}

export const calculateParabolicSAR = (candles: Candle[], af: number = 0.02, maxAf: number = 0.2): ParabolicSARResult => {
  const sar: number[] = [];
  const trend: ('up' | 'down')[] = [];
  
  if (candles.length < 2) {
    return { sar: [], trend: [] };
  }
  
  let currentSAR = candles[0].l;
  let currentTrend: 'up' | 'down' = 'up';
  let currentAF = af;
  let ep = candles[0].h;
  
  sar.push(NaN);
  trend.push('up');
  
  for (let i = 1; i < candles.length; i++) {
    const prevSAR = currentSAR;
    const prevTrend = currentTrend;
    const prevAF = currentAF;
    const prevEP = ep;
    
    if (prevTrend === 'up') {
      currentSAR = prevSAR + prevAF * (prevEP - prevSAR);
      if (currentSAR > candles[i].l) {
        currentTrend = 'down';
        currentSAR = prevEP;
        ep = candles[i].l;
        currentAF = af;
      } else {
        if (candles[i].h > prevEP) {
          ep = candles[i].h;
          currentAF = Math.min(prevAF + af, maxAf);
        }
      }
    } else {
      currentSAR = prevSAR + prevAF * (prevEP - prevSAR);
      if (currentSAR < candles[i].h) {
        currentTrend = 'up';
        currentSAR = prevEP;
        ep = candles[i].h;
        currentAF = af;
      } else {
        if (candles[i].l < prevEP) {
          ep = candles[i].l;
          currentAF = Math.min(prevAF + af, maxAf);
        }
      }
    }
    
    sar.push(currentSAR);
    trend.push(currentTrend);
  }
  
  return { sar, trend };
};

// TRIX (Triple Exponential Moving Average)
export const calculateTRIX = (candles: Candle[], period: number = 14): number[] => {
  const ema1 = calculateEMA(candles, period);
  const ema2 = calculateEMA(ema1.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), period);
  const ema3 = calculateEMA(ema2.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), period);
  
  const trix: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0 || isNaN(ema3[i]) || isNaN(ema3[i - 1])) {
      trix.push(NaN);
    } else {
      trix.push(((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 10000);
    }
  }
  return trix;
};

// DEMA (Double Exponential Moving Average)
export const calculateDEMA = (candles: Candle[], period: number): number[] => {
  const ema1 = calculateEMA(candles, period);
  const ema2 = calculateEMA(ema1.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), period);
  
  const dema: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(ema1[i]) || isNaN(ema2[i])) {
      dema.push(NaN);
    } else {
      dema.push(2 * ema1[i] - ema2[i]);
    }
  }
  return dema;
};

// TEMA (Triple Exponential Moving Average)
export const calculateTEMA = (candles: Candle[], period: number): number[] => {
  const ema1 = calculateEMA(candles, period);
  const ema2 = calculateEMA(ema1.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), period);
  const ema3 = calculateEMA(ema2.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), period);
  
  const tema: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(ema1[i]) || isNaN(ema2[i]) || isNaN(ema3[i])) {
      tema.push(NaN);
    } else {
      tema.push(3 * ema1[i] - 3 * ema2[i] + ema3[i]);
    }
  }
  return tema;
};

// Donchian Channels
export interface DonchianChannelsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export const calculateDonchianChannels = (candles: Candle[], period: number = 20): DonchianChannelsResult => {
  const upper: number[] = [];
  const lower: number[] = [];
  const middle: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      middle.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      upper.push(highest);
      lower.push(lowest);
      middle.push((highest + lowest) / 2);
    }
  }
  
  return { upper, middle, lower };
};

// Keltner Channels
export interface KeltnerChannelsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export const calculateKeltnerChannels = (candles: Candle[], period: number = 20, multiplier: number = 2): KeltnerChannelsResult => {
  const middle = calculateEMA(candles, period);
  const atr = calculateATR(candles, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(middle[i]) || isNaN(atr[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + multiplier * atr[i]);
      lower.push(middle[i] - multiplier * atr[i]);
    }
  }
  
  return { upper, middle, lower };
};

// Momentum
export const calculateMomentum = (candles: Candle[], period: number = 10): number[] => {
  const momentum: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      momentum.push(NaN);
    } else {
      momentum.push(candles[i].c - candles[i - period].c);
    }
  }
  return momentum;
};

// ROC (Rate of Change)
export const calculateROC = (candles: Candle[], period: number = 12): number[] => {
  const roc: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      roc.push(NaN);
    } else {
      const change = candles[i].c - candles[i - period].c;
      roc.push((change / candles[i - period].c) * 100);
    }
  }
  return roc;
};

// MFI (Money Flow Index)
export const calculateMFI = (candles: Candle[], period: number = 14): number[] => {
  const mfi: number[] = [];
  const typicalPrices: number[] = [];
  const rawMoneyFlows: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].h + candles[i].l + candles[i].c) / 3;
    typicalPrices.push(tp);
    
    if (i === 0) {
      rawMoneyFlows.push(NaN);
    } else {
      const volume = 1; // Assuming volume = 1 if not available
      rawMoneyFlows.push(tp * volume);
    }
  }
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      mfi.push(NaN);
    } else {
      let positiveFlow = 0;
      let negativeFlow = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += rawMoneyFlows[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += rawMoneyFlows[j];
        }
      }
      
      if (negativeFlow === 0) {
        mfi.push(100);
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        mfi.push(100 - (100 / (1 + moneyRatio)));
      }
    }
  }
  
  return mfi;
};

// Aroon
export interface AroonResult {
  aroonUp: number[];
  aroonDown: number[];
}

export const calculateAroon = (candles: Candle[], period: number = 14): AroonResult => {
  const aroonUp: number[] = [];
  const aroonDown: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      aroonUp.push(NaN);
      aroonDown.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      let highestIndex = 0;
      let lowestIndex = 0;
      let highest = slice[0].h;
      let lowest = slice[0].l;
      
      for (let j = 1; j < slice.length; j++) {
        if (slice[j].h > highest) {
          highest = slice[j].h;
          highestIndex = j;
        }
        if (slice[j].l < lowest) {
          lowest = slice[j].l;
          lowestIndex = j;
        }
      }
      
      aroonUp.push(((period - (period - 1 - highestIndex)) / period) * 100);
      aroonDown.push(((period - (period - 1 - lowestIndex)) / period) * 100);
    }
  }
  
  return { aroonUp, aroonDown };
};

// Aroon Oscillator
export const calculateAroonOscillator = (candles: Candle[], period: number = 14): number[] => {
  const aroon = calculateAroon(candles, period);
  const oscillator: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(aroon.aroonUp[i]) || isNaN(aroon.aroonDown[i])) {
      oscillator.push(NaN);
    } else {
      oscillator.push(aroon.aroonUp[i] - aroon.aroonDown[i]);
    }
  }
  
  return oscillator;
};

// Ultimate Oscillator
export const calculateUltimateOscillator = (candles: Candle[], period1: number = 7, period2: number = 14, period3: number = 28): number[] => {
  const uo: number[] = [];
  const buyingPressure: number[] = [];
  const trueRange: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      buyingPressure.push(NaN);
      trueRange.push(NaN);
    } else {
      const bp = candles[i].c - Math.min(candles[i].l, candles[i - 1].c);
      buyingPressure.push(bp);
      const tr = Math.max(
        candles[i].h - candles[i].l,
        Math.abs(candles[i].h - candles[i - 1].c),
        Math.abs(candles[i].l - candles[i - 1].c)
      );
      trueRange.push(tr);
    }
  }
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period3) {
      uo.push(NaN);
    } else {
      let sum1 = 0, sum2 = 0;
      let sum3 = 0, sum4 = 0;
      let sum5 = 0, sum6 = 0;
      
      for (let j = i - period1 + 1; j <= i; j++) {
        sum1 += buyingPressure[j];
        sum2 += trueRange[j];
      }
      
      for (let j = i - period2 + 1; j <= i; j++) {
        sum3 += buyingPressure[j];
        sum4 += trueRange[j];
      }
      
      for (let j = i - period3 + 1; j <= i; j++) {
        sum5 += buyingPressure[j];
        sum6 += trueRange[j];
      }
      
      const avg1 = sum2 === 0 ? 0 : (sum1 / sum2);
      const avg2 = sum4 === 0 ? 0 : (sum3 / sum4);
      const avg3 = sum6 === 0 ? 0 : (sum5 / sum6);
      
      uo.push(100 * ((4 * avg1 + 2 * avg2 + avg3) / 7));
    }
  }
  
  return uo;
};

// Awesome Oscillator
export const calculateAwesomeOscillator = (candles: Candle[]): number[] => {
  const ao: number[] = [];
  
  const sma5: number[] = [];
  const sma34: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const mid5 = i < 4 ? NaN : candles.slice(i - 4, i + 1).reduce((sum, c) => sum + (c.h + c.l) / 2, 0) / 5;
    const mid34 = i < 33 ? NaN : candles.slice(i - 33, i + 1).reduce((sum, c) => sum + (c.h + c.l) / 2, 0) / 34;
    
    sma5.push(mid5);
    sma34.push(mid34);
    
    if (isNaN(mid5) || isNaN(mid34)) {
      ao.push(NaN);
    } else {
      ao.push(mid5 - mid34);
    }
  }
  
  return ao;
};

// PPO (Percentage Price Oscillator)
export const calculatePPO = (candles: Candle[], fastPeriod: number = 12, slowPeriod: number = 26): number[] => {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  const ppo: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i]) || slowEMA[i] === 0) {
      ppo.push(NaN);
    } else {
      ppo.push(((fastEMA[i] - slowEMA[i]) / slowEMA[i]) * 100);
    }
  }
  
  return ppo;
};

// Hull Moving Average (HMA)
export const calculateHMA = (candles: Candle[], period: number): number[] => {
  const wmaHalf = calculateWMA(candles, Math.floor(period / 2));
  const wmaFull = calculateWMA(candles, period);
  
  const diff: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(wmaHalf[i]) || isNaN(wmaFull[i])) {
      diff.push(NaN);
    } else {
      diff.push(2 * wmaHalf[i] - wmaFull[i]);
    }
  }
  
  const hma = calculateWMA(diff.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), Math.floor(Math.sqrt(period)));
  return hma;
};

// Kaufman Adaptive Moving Average (KAMA)
export const calculateKAMA = (candles: Candle[], period: number = 14, fastPeriod: number = 2, slowPeriod: number = 30): number[] => {
  const kama: number[] = [];
  const er: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      kama.push(NaN);
      er.push(NaN);
    } else {
      const change = Math.abs(candles[i].c - candles[i - period].c);
      let volatility = 0;
      for (let j = i - period + 1; j <= i; j++) {
        volatility += Math.abs(candles[j].c - candles[j - 1].c);
      }
      
      const efficiencyRatio = volatility === 0 ? 0 : change / volatility;
      er.push(efficiencyRatio);
      
      if (i === period) {
        kama.push(candles[i].c);
      } else {
        const sc = Math.pow(efficiencyRatio * (2 / (fastPeriod + 1) - 2 / (slowPeriod + 1)) + 2 / (slowPeriod + 1), 2);
        kama.push(kama[kama.length - 1] + sc * (candles[i].c - kama[kama.length - 1]));
      }
    }
  }
  
  return kama;
};

// Standard Deviation
export const calculateStandardDeviation = (candles: Candle[], period: number): number[] => {
  const stdDev: number[] = [];
  const ma = calculateMA(candles, period);
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1 || isNaN(ma[i])) {
      stdDev.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const mean = ma[i];
      const variance = slice.reduce((acc, c) => acc + Math.pow(c.c - mean, 2), 0) / period;
      stdDev.push(Math.sqrt(variance));
    }
  }
  
  return stdDev;
};

// Linear Regression
export interface LinearRegressionResult {
  slope: number[];
  intercept: number[];
  rSquared: number[];
}

export const calculateLinearRegression = (candles: Candle[], period: number = 14): LinearRegressionResult => {
  const slope: number[] = [];
  const intercept: number[] = [];
  const rSquared: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      slope.push(NaN);
      intercept.push(NaN);
      rSquared.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      
      slice.forEach((candle, idx) => {
        const x = idx + 1;
        const y = candle.c;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });
      
      const n = period;
      const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const b = (sumY - m * sumX) / n;
      
      slope.push(m);
      intercept.push(b);
      
      // Calculate R-squared
      const meanY = sumY / n;
      let ssRes = 0, ssTot = 0;
      slice.forEach((candle, idx) => {
        const x = idx + 1;
        const y = candle.c;
        const yPred = m * x + b;
        ssRes += Math.pow(y - yPred, 2);
        ssTot += Math.pow(y - meanY, 2);
      });
      
      rSquared.push(ssTot === 0 ? 0 : 1 - (ssRes / ssTot));
    }
  }
  
  return { slope, intercept, rSquared };
};

// Fisher Transform
export const calculateFisherTransform = (candles: Candle[], period: number = 10): number[] => {
  const fisher: number[] = [];
  const values: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      values.push(NaN);
      fisher.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      
      if (highest === lowest) {
        values.push(0);
      } else {
        const rawValue = 2 * ((candles[i].c - lowest) / (highest - lowest) - 0.5);
        values.push(rawValue);
      }
      
      if (i === period - 1) {
        fisher.push(0.5 * Math.log((1 + values[i]) / (1 - values[i])));
      } else {
        const prevValue = values[i - 1];
        const prevFisher = fisher[i - 1];
        const smoothedValue = 0.33 * values[i] + 0.67 * prevValue;
        fisher.push(0.5 * Math.log((1 + smoothedValue) / (1 - smoothedValue)) + 0.5 * prevFisher);
      }
    }
  }
  
  return fisher;
};

// Schaff Trend Cycle (STC)
export const calculateSTC = (candles: Candle[], fastPeriod: number = 23, slowPeriod: number = 50, cyclePeriod: number = 10): number[] => {
  const macd = calculateMACD(candles, fastPeriod, slowPeriod, 1);
  const stc: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(macd.macd[i])) {
      stc.push(NaN);
    } else {
      stc.push(macd.macd[i]);
    }
  }
  
  // Apply smoothing (simplified version)
  for (let smooth = 0; smooth < 2; smooth++) {
    for (let i = cyclePeriod - 1; i < stc.length; i++) {
      if (!isNaN(stc[i])) {
        const slice = stc.slice(i - cyclePeriod + 1, i + 1).filter(v => !isNaN(v));
        if (slice.length > 0) {
          const min = Math.min(...slice);
          const max = Math.max(...slice);
          if (max !== min) {
            stc[i] = 100 * ((stc[i] - min) / (max - min));
          }
        }
      }
    }
  }
  
  return stc;
};

// SMA (Simple Moving Average) - alias для MA
export const calculateSMA = calculateMA;

// VWAP (Volume Weighted Average Price) - упрощенная версия без объема
export const calculateVWAP = (candles: Candle[]): number[] => {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].h + candles[i].l + candles[i].c) / 3;
    const volume = 1; // Предполагаем объем = 1 если не доступен
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    vwap.push(cumulativeTPV / cumulativeVolume);
  }
  
  return vwap;
};

// ZigZag
export interface ZigZagResult {
  points: Array<{ x: number; y: number; index: number }>;
}

export const calculateZigZag = (candles: Candle[], deviation: number = 5): ZigZagResult => {
  const points: Array<{ x: number; y: number; index: number }> = [];
  
  if (candles.length < 2) {
    return { points: [] };
  }
  
  let lastExtreme = candles[0].c;
  let lastExtremeIndex = 0;
  let trend: 'up' | 'down' | null = null;
  
  points.push({ x: candles[0].x, y: lastExtreme, index: 0 });
  
  for (let i = 1; i < candles.length; i++) {
    const currentPrice = candles[i].c;
    const change = Math.abs((currentPrice - lastExtreme) / lastExtreme) * 100;
    
    if (trend === null) {
      if (currentPrice > lastExtreme) {
        trend = 'up';
      } else if (currentPrice < lastExtreme) {
        trend = 'down';
      }
    } else if (trend === 'up' && currentPrice < lastExtreme) {
      if (change >= deviation) {
        points.push({ x: candles[lastExtremeIndex].x, y: lastExtreme, index: lastExtremeIndex });
        lastExtreme = currentPrice;
        lastExtremeIndex = i;
        trend = 'down';
      }
    } else if (trend === 'down' && currentPrice > lastExtreme) {
      if (change >= deviation) {
        points.push({ x: candles[lastExtremeIndex].x, y: lastExtreme, index: lastExtremeIndex });
        lastExtreme = currentPrice;
        lastExtremeIndex = i;
        trend = 'up';
      }
    } else {
      if (trend === 'up' && currentPrice > lastExtreme) {
        lastExtreme = currentPrice;
        lastExtremeIndex = i;
      } else if (trend === 'down' && currentPrice < lastExtreme) {
        lastExtreme = currentPrice;
        lastExtremeIndex = i;
      }
    }
  }
  
  if (points.length === 0 || points[points.length - 1].index !== lastExtremeIndex) {
    points.push({ x: candles[lastExtremeIndex].x, y: lastExtreme, index: lastExtremeIndex });
  }
  
  return { points };
};

// Price Channels
export interface PriceChannelsResult {
  upper: number[];
  lower: number[];
}

export const calculatePriceChannels = (candles: Candle[], period: number = 20): PriceChannelsResult => {
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.h));
      const lowest = Math.min(...slice.map(c => c.l));
      upper.push(highest);
      lower.push(lowest);
    }
  }
  
  return { upper, lower };
};

// Standard Error Bands
export interface StandardErrorBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export const calculateStandardErrorBands = (candles: Candle[], period: number = 20, multiplier: number = 2): StandardErrorBandsResult => {
  const middle = calculateMA(candles, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const mean = middle[i];
      
      // Calculate standard error
      const errors = slice.map(c => c.c - mean);
      const sumSquaredErrors = errors.reduce((acc, err) => acc + err * err, 0);
      const standardError = Math.sqrt(sumSquaredErrors / (period - 1));
      
      upper.push(mean + multiplier * standardError);
      lower.push(mean - multiplier * standardError);
    }
  }
  
  return { upper, middle, lower };
};

// Elder Force Index
export const calculateElderForceIndex = (candles: Candle[], period: number = 13): number[] => {
  const fi: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      fi.push(NaN);
    } else {
      const volume = 1; // Предполагаем объем = 1
      const force = (candles[i].c - candles[i - 1].c) * volume;
      fi.push(force);
    }
  }
  
  // Smooth with EMA
  const smoothed: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < fi.length; i++) {
    if (isNaN(fi[i])) {
      smoothed.push(NaN);
    } else if (i === 0 || isNaN(smoothed[i - 1])) {
      smoothed.push(fi[i]);
    } else {
      smoothed.push((fi[i] - smoothed[i - 1]) * multiplier + smoothed[i - 1]);
    }
  }
  
  return smoothed;
};

// Mass Index
export const calculateMassIndex = (candles: Candle[], period: number = 25, emaPeriod: number = 9): number[] => {
  const ema = calculateEMA(candles, emaPeriod);
  const ema2 = calculateEMA(ema.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), emaPeriod);
  
  const ratio: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(ema[i]) || isNaN(ema2[i]) || ema2[i] === 0) {
      ratio.push(NaN);
    } else {
      ratio.push(ema[i] / ema2[i]);
    }
  }
  
  const massIndex: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      massIndex.push(NaN);
    } else {
      const sum = ratio.slice(i - period + 1, i + 1).reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0);
      massIndex.push(sum);
    }
  }
  
  return massIndex;
};

// Price Oscillator
export const calculatePriceOscillator = (candles: Candle[], fastPeriod: number = 12, slowPeriod: number = 26): number[] => {
  const fastMA = calculateMA(candles, fastPeriod);
  const slowMA = calculateMA(candles, slowPeriod);
  const oscillator: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(fastMA[i]) || isNaN(slowMA[i]) || slowMA[i] === 0) {
      oscillator.push(NaN);
    } else {
      oscillator.push(((fastMA[i] - slowMA[i]) / slowMA[i]) * 100);
    }
  }
  
  return oscillator;
};

// Detrended Price Oscillator (DPO)
export const calculateDPO = (candles: Candle[], period: number = 20): number[] => {
  const sma = calculateMA(candles, period);
  const dpo: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period || isNaN(sma[i])) {
      dpo.push(NaN);
    } else {
      const shiftedIndex = i - Math.floor(period / 2 + 1);
      if (shiftedIndex >= 0 && shiftedIndex < candles.length) {
        dpo.push(candles[i].c - sma[shiftedIndex]);
      } else {
        dpo.push(NaN);
      }
    }
  }
  
  return dpo;
};

// Bollinger Bandwidth
export const calculateBollingerBandwidth = (candles: Candle[], period: number = 20, stdDev: number = 2): number[] => {
  const bb = calculateBollingerBands(candles, period, stdDev);
  const bandwidth: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(bb.upper[i]) || isNaN(bb.lower[i]) || isNaN(bb.middle[i]) || bb.middle[i] === 0) {
      bandwidth.push(NaN);
    } else {
      bandwidth.push(((bb.upper[i] - bb.lower[i]) / bb.middle[i]) * 100);
    }
  }
  
  return bandwidth;
};

// Bears Power / Bulls Power
export interface BearsBullsPowerResult {
  bearsPower: number[];
  bullsPower: number[];
}

export const calculateBearsBullsPower = (candles: Candle[], period: number = 13): BearsBullsPowerResult => {
  const ema = calculateEMA(candles, period);
  const bearsPower: number[] = [];
  const bullsPower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(ema[i])) {
      bearsPower.push(NaN);
      bullsPower.push(NaN);
    } else {
      bearsPower.push(candles[i].l - ema[i]);
      bullsPower.push(candles[i].h - ema[i]);
    }
  }
  
  return { bearsPower, bullsPower };
};

// Chaikin Oscillator
export const calculateChaikinOscillator = (candles: Candle[], fastPeriod: number = 3, slowPeriod: number = 10): number[] => {
  // Упрощенная версия без объема
  const ad: number[] = [];
  let cumulativeAD = 0;
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      cumulativeAD = 0;
    } else {
      const clv = ((candles[i].c - candles[i].l) - (candles[i].h - candles[i].c)) / (candles[i].h - candles[i].l);
      const volume = 1;
      cumulativeAD += clv * volume;
    }
    ad.push(cumulativeAD);
  }
  
  const fastEMA = calculateEMA(ad.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), fastPeriod);
  const slowEMA = calculateEMA(ad.map((v, i) => ({ x: candles[i].x, o: v, h: v, l: v, c: v })), slowPeriod);
  
  const oscillator: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      oscillator.push(NaN);
    } else {
      oscillator.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  return oscillator;
};

// Volume Rate of Change (без объема, используем цену)
export const calculateVolumeROC = (candles: Candle[], period: number = 12): number[] => {
  const roc: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      roc.push(NaN);
    } else {
      const volume = 1;
      const prevVolume = 1;
      roc.push(((volume - prevVolume) / prevVolume) * 100);
    }
  }
  return roc;
};

// Pivot Points
export interface PivotPointsResult {
  pivot: number[];
  resistance1: number[];
  resistance2: number[];
  support1: number[];
  support2: number[];
}

export const calculatePivotPoints = (candles: Candle[], period: number = 1): PivotPointsResult => {
  const pivot: number[] = [];
  const resistance1: number[] = [];
  const resistance2: number[] = [];
  const support1: number[] = [];
  const support2: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      pivot.push(NaN);
      resistance1.push(NaN);
      resistance2.push(NaN);
      support1.push(NaN);
      support2.push(NaN);
    } else {
      const slice = candles.slice(i - period, i);
      const high = Math.max(...slice.map(c => c.h));
      const low = Math.min(...slice.map(c => c.l));
      const close = slice[slice.length - 1].c;
      
      const p = (high + low + close) / 3;
      pivot.push(p);
      resistance1.push(2 * p - low);
      resistance2.push(p + high - low);
      support1.push(2 * p - high);
      support2.push(p - (high - low));
    }
  }
  
  return { pivot, resistance1, resistance2, support1, support2 };
};

// Fibonacci Retracement (helper для расчета уровней)
export interface FibonacciLevels {
  level0: number; // 100%
  level236: number; // 23.6%
  level382: number; // 38.2%
  level500: number; // 50%
  level618: number; // 61.8%
  level786: number; // 78.6%
  level100: number; // 0%
}

export const calculateFibonacciLevels = (high: number, low: number): FibonacciLevels => {
  const diff = high - low;
  return {
    level0: high,
    level236: high - diff * 0.236,
    level382: high - diff * 0.382,
    level500: high - diff * 0.5,
    level618: high - diff * 0.618,
    level786: high - diff * 0.786,
    level100: low
  };
};

