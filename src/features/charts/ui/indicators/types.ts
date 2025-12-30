// Тип Candle теперь импортируется из chart/types
export interface Candle {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface ChartArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Scale {
  min: number;
  max: number;
}

export interface PixelScale {
  getPixelForValue(value: number): number;
}

/**
 * Контекст для отрисовки индикатора
 */
export interface IndicatorRenderContext {
  ctx: CanvasRenderingContext2D;
  chartArea: ChartArea;
  xScale: PixelScale & Scale;
  yScale: PixelScale & Scale;
  candles: Candle[];
  visibleCandles: Candle[];
}

/**
 * Интерфейс для рендерера индикатора
 */
export interface IndicatorRenderer {
  /**
   * Название индикатора
   */
  name: string;
  
  /**
   * Минимальное количество свечей для расчета
   */
  minCandles: number;
  
  /**
   * Отрисовать индикатор
   */
  render(context: IndicatorRenderContext): void;
}

