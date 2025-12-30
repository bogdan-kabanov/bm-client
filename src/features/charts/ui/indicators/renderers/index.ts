import { IndicatorRenderer } from '../types';
import { MARenderer } from './MA';
import { EMARenderer } from './EMA';
import { MACDRenderer } from './MACD';
import { MACDHistogramRenderer } from './MACD_Histogram';
import { BollingerRenderer } from './Bollinger';
import { IchimokuRenderer } from './Ichimoku';
import { IchimokuFullRenderer } from './Ichimoku_Full';
import { RSIRenderer } from './RSI';
import { StochasticRenderer } from './Stochastic';
import { CCIRenderer } from './CCI';
import { WilliamsRRenderer } from './WilliamsR';
import { ADXRenderer } from './ADX';
import { ATRRenderer } from './ATR';
import { WMARenderer } from './WMA';
import { ParabolicSARRenderer } from './ParabolicSAR';
import { TRIXRenderer } from './TRIX';
import { DEMARenderer } from './DEMA';
import { TEMARenderer } from './TEMA';
import { DonchianRenderer } from './Donchian';
import { KeltnerRenderer } from './Keltner';
import { MomentumRenderer } from './Momentum';
import { ROCRenderer } from './ROC';
import { MFIRenderer } from './MFI';
import { AroonRenderer } from './Aroon';
import { AroonOscRenderer } from './AroonOsc';
import { UltimateOscRenderer } from './UltimateOsc';
import { AwesomeOscRenderer } from './AwesomeOsc';
import { PPORenderer } from './PPO';
import { HMARenderer } from './HMA';
import { KAMARenderer } from './KAMA';
import { StdDevRenderer } from './StdDev';
import { LinearRegRenderer } from './LinearReg';
import { FisherRenderer } from './Fisher';
import { STCRenderer } from './STC';

/**
 * Реестр всех рендереров индикаторов
 */
export const indicatorRenderers: Map<string, IndicatorRenderer> = new Map([
  ['MA', MARenderer],
  ['EMA', EMARenderer],
  ['MACD', MACDRenderer],
  ['MACD_Histogram', MACDHistogramRenderer],
  ['Bollinger', BollingerRenderer],
  ['Ichimoku', IchimokuRenderer],
  ['Ichimoku_Full', IchimokuFullRenderer],
  ['RSI', RSIRenderer],
  ['Stochastic', StochasticRenderer],
  ['CCI', CCIRenderer],
  ['WilliamsR', WilliamsRRenderer],
  ['ADX', ADXRenderer],
  ['ATR', ATRRenderer],
  ['WMA', WMARenderer],
  ['ParabolicSAR', ParabolicSARRenderer],
  ['TRIX', TRIXRenderer],
  ['DEMA', DEMARenderer],
  ['TEMA', TEMARenderer],
  ['Donchian', DonchianRenderer],
  ['Keltner', KeltnerRenderer],
  ['Momentum', MomentumRenderer],
  ['ROC', ROCRenderer],
  ['MFI', MFIRenderer],
  ['Aroon', AroonRenderer],
  ['AroonOsc', AroonOscRenderer],
  ['UltimateOsc', UltimateOscRenderer],
  ['AwesomeOsc', AwesomeOscRenderer],
  ['PPO', PPORenderer],
  ['HMA', HMARenderer],
  ['KAMA', KAMARenderer],
  ['StdDev', StdDevRenderer],
  ['LinearReg', LinearRegRenderer],
  ['Fisher', FisherRenderer],
  ['STC', STCRenderer],
]);

/**
 * Получить рендерер индикатора по имени
 */
export function getIndicatorRenderer(name: string): IndicatorRenderer | undefined {
  return indicatorRenderers.get(name);
}

