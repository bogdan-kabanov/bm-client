export type IndicatorId = 
  | 'MA' | 'EMA' | 'WMA' | 'DEMA' | 'TEMA' | 'HMA' | 'KAMA'
  | 'Bollinger' | 'Donchian' | 'Keltner'
  | 'MACD' | 'MACD_Histogram' | 'RSI' | 'Stochastic' | 'CCI' | 'WilliamsR'
  | 'ADX' | 'ATR' | 'Ichimoku' | 'Ichimoku_Full' | 'ParabolicSAR'
  | 'TRIX' | 'Momentum' | 'ROC' | 'MFI' | 'Aroon' | 'AroonOsc'
  | 'UltimateOsc' | 'AwesomeOsc' | 'PPO' | 'StdDev' | 'LinearReg' | 'Fisher' | 'STC';

export type IndicatorBadgeTone = 'trend' | 'volatility' | 'oscillator' | 'momentum';

export const BADGE_TONE_STYLES: Record<IndicatorBadgeTone, { background: string; color: string; shadow: string; border: string }> = {
  trend: {
    background: 'linear-gradient(135deg, #0BA360 0%, #3CBA92 100%)',
    color: '#F8FFFB',
    shadow: '0 8px 16px rgba(11, 163, 96, 0.28)',
    border: '1px solid rgba(60, 186, 146, 0.35)',
  },
  volatility: {
    background: 'linear-gradient(135deg, #1D6FE6 0%, #3AA0FF 100%)',
    color: '#F6FBFF',
    shadow: '0 8px 16px rgba(58, 160, 255, 0.28)',
    border: '1px solid rgba(58, 160, 255, 0.35)',
  },
  oscillator: {
    background: 'linear-gradient(135deg, #7C3AED 0%, #C084FC 100%)',
    color: '#FBF7FF',
    shadow: '0 8px 16px rgba(124, 58, 237, 0.28)',
    border: '1px solid rgba(192, 132, 252, 0.4)',
  },
  momentum: {
    background: 'linear-gradient(135deg, #FF7A18 0%, #FFA64D 100%)',
    color: '#FFF9F2',
    shadow: '0 8px 16px rgba(255, 122, 24, 0.28)',
    border: '1px solid rgba(255, 166, 77, 0.4)',
  },
};

export const INDICATOR_BADGE_CONFIG: Partial<Record<IndicatorId, { label: string; tone: IndicatorBadgeTone }>> = {
  MA: { label: 'MA', tone: 'trend' },
  EMA: { label: 'EMA', tone: 'trend' },
  WMA: { label: 'WMA', tone: 'trend' },
  DEMA: { label: 'DEMA', tone: 'trend' },
  TEMA: { label: 'TEMA', tone: 'trend' },
  HMA: { label: 'HMA', tone: 'trend' },
  KAMA: { label: 'KAMA', tone: 'trend' },
  Bollinger: { label: 'BB', tone: 'volatility' },
  Donchian: { label: 'DC', tone: 'volatility' },
  Keltner: { label: 'KC', tone: 'volatility' },
  MACD: { label: 'MACD', tone: 'oscillator' },
  MACD_Histogram: { label: 'HIST', tone: 'oscillator' },
  RSI: { label: 'RSI', tone: 'oscillator' },
  Stochastic: { label: 'STO', tone: 'oscillator' },
  CCI: { label: 'CCI', tone: 'oscillator' },
  WilliamsR: { label: 'WR', tone: 'oscillator' },
  ADX: { label: 'ADX', tone: 'trend' },
  ATR: { label: 'ATR', tone: 'volatility' },
  Ichimoku: { label: 'ICH', tone: 'trend' },
  Ichimoku_Full: { label: 'ICH+', tone: 'trend' },
  ParabolicSAR: { label: 'SAR', tone: 'trend' },
  TRIX: { label: 'TRIX', tone: 'trend' },
  Momentum: { label: 'MOM', tone: 'momentum' },
  ROC: { label: 'ROC', tone: 'momentum' },
  MFI: { label: 'MFI', tone: 'momentum' },
  Aroon: { label: 'ARO', tone: 'trend' },
  AroonOsc: { label: 'AOSC', tone: 'oscillator' },
  UltimateOsc: { label: 'ULT', tone: 'oscillator' },
  AwesomeOsc: { label: 'AO', tone: 'oscillator' },
  PPO: { label: 'PPO', tone: 'oscillator' },
  StdDev: { label: 'SD', tone: 'volatility' },
  LinearReg: { label: 'LR', tone: 'trend' },
  Fisher: { label: 'FISH', tone: 'oscillator' },
  STC: { label: 'STC', tone: 'momentum' },
};

export const getIndicatorsLibrary = (t: (key: string) => string) => [
  { id: 'MA', name: 'Moving Average', desc: t('trading.indicators.MA') },
  { id: 'EMA', name: 'EMA', desc: t('trading.indicators.EMA') },
  { id: 'WMA', name: 'WMA', desc: t('trading.indicators.WMA') },
  { id: 'DEMA', name: 'DEMA', desc: t('trading.indicators.DEMA') },
  { id: 'TEMA', name: 'TEMA', desc: t('trading.indicators.TEMA') },
  { id: 'HMA', name: 'HMA', desc: 'Hull Moving Average' },
  { id: 'KAMA', name: 'KAMA', desc: t('trading.indicators.KAMA') },
  { id: 'Bollinger', name: 'Bollinger Bands', desc: t('trading.indicators.Bollinger') },
  { id: 'Donchian', name: 'Donchian Channels', desc: t('trading.indicators.Donchian') },
  { id: 'Keltner', name: 'Keltner Channels', desc: t('trading.indicators.Keltner') },
  { id: 'MACD', name: 'MACD', desc: 'Moving Average Convergence Divergence' },
  { id: 'MACD_Histogram', name: 'MACD Histogram', desc: t('trading.indicators.MACD_Histogram') },
  { id: 'RSI', name: 'RSI', desc: t('trading.indicators.RSI') },
  { id: 'Stochastic', name: 'Stochastic', desc: t('trading.indicators.Stochastic') },
  { id: 'CCI', name: 'CCI', desc: t('trading.indicators.CCI') },
  { id: 'WilliamsR', name: 'Williams %R', desc: t('trading.indicators.WilliamsR') },
  { id: 'ADX', name: 'ADX', desc: t('trading.indicators.ADX') },
  { id: 'ATR', name: 'ATR', desc: t('trading.indicators.ATR') },
  { id: 'Ichimoku', name: 'Ichimoku', desc: t('trading.indicators.Ichimoku') },
  { id: 'Ichimoku_Full', name: 'Ichimoku Full', desc: t('trading.indicators.Ichimoku_Full') },
  { id: 'ParabolicSAR', name: 'Parabolic SAR', desc: t('trading.indicators.ParabolicSAR') },
  { id: 'TRIX', name: 'TRIX', desc: t('trading.indicators.TRIX') },
  { id: 'Momentum', name: 'Momentum', desc: t('trading.indicators.Momentum') },
  { id: 'ROC', name: 'ROC', desc: t('trading.indicators.ROC') },
  { id: 'MFI', name: 'MFI', desc: t('trading.indicators.MFI') },
  { id: 'Aroon', name: 'Aroon', desc: t('trading.indicators.Aroon') },
  { id: 'AroonOsc', name: 'Aroon Oscillator', desc: t('trading.indicators.AroonOsc') },
  { id: 'UltimateOsc', name: 'Ultimate Oscillator', desc: t('trading.indicators.UltimateOsc') },
  { id: 'AwesomeOsc', name: 'Awesome Oscillator', desc: t('trading.indicators.AwesomeOsc') },
  { id: 'PPO', name: 'PPO', desc: t('trading.indicators.PPO') },
  { id: 'StdDev', name: 'Standard Deviation', desc: t('trading.indicators.StdDev') },
  { id: 'LinearReg', name: 'Linear Regression', desc: t('trading.indicators.LinearReg') },
  { id: 'Fisher', name: 'Fisher Transform', desc: t('trading.indicators.Fisher') },
  { id: 'STC', name: 'STC', desc: 'Schaff Trend Cycle' },
] as const;

export const formatBadgeLabel = (indicatorId: IndicatorId): string => {
  const cleaned = indicatorId.replace(/_/g, ' ').trim();
  if (!cleaned) {
    return 'IND';
  }

  const words = cleaned.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 4)
      .toUpperCase();
  }

  return cleaned.slice(0, 4).toUpperCase();
};

export const getIndicatorBadge = (indicatorId: IndicatorId) => {
  const config = INDICATOR_BADGE_CONFIG[indicatorId];
  const tone = config?.tone ?? 'trend';
  const toneStyle = BADGE_TONE_STYLES[tone];

  return {
    label: config?.label ?? formatBadgeLabel(indicatorId),
    style: {
      '--indicator-icon-bg': toneStyle.background,
      '--indicator-icon-color': toneStyle.color,
      '--indicator-icon-shadow': toneStyle.shadow,
      '--indicator-icon-border': toneStyle.border,
    } as React.CSSProperties,
  };
};

