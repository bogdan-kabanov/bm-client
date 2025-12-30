export type Timeframe =
  | '15s'
  | '30s'
  | '1m'
  | '2m'
  | '5m'
  | '15m'
  | '30m'
  | '1h';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  anomaly?: boolean; // Флаг для аномальных свечей
}

export interface KlineServerMessage {
  topic: string;
  data: Array<{
    start: number;
    open: string;
    high: string;
    low: string;
    close: string;
  }>;
}

export interface DrawingLine {
  id: string;
  type: 'straight' | 'freehand' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone';
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
  points?: Array<{ time: number; price: number }>;
  color: string;
  timestamp: number;
  fillColor?: string;
  filled?: boolean;
  text?: string;
  fibonacciLevels?: number[];
}

export interface DrawingState {
  isDrawing: boolean;
  mode: 'line' | 'freehand' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone' | null;
  color: string;
  lines: DrawingLine[];
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  currentPath: Array<{ x: number; y: number }>;
  eraserRadius?: number;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export type ChartView = 'line' | 'area';

export interface CanvasChartOptions {
  canvas: HTMLCanvasElement;
  timeframe: Timeframe;
  followPrice?: boolean;
  getServerTime?: () => number;
  getCurrentTime?: () => number; // Функция для получения времени из Redux
  activeIndicators?: string[];
  drawingState?: DrawingState;
  onDrawingStateChange?: (state: DrawingState) => void;
  chartView?: ChartView;
  onUserInteraction?: () => void;
  bottomPadding?: number;
}

export interface ViewportState {
  centerIndex: number;
  candlesPerScreen: number;
  fromIndex: number;
  toIndex: number;
  minPrice: number;
  maxPrice: number;
}

export interface CanvasChartHandle {
  canvas: HTMLCanvasElement;
  setTimeframe(tf: Timeframe): void;
  setFollowPrice(enabled: boolean): void;
  stickToRight(): void;
  redraw(): void;
  destroy(): void;
  userHasInteracted: boolean;
  followPrice: boolean;
  getViewport?(): ViewportState | null;
  timestampToPixel?(timestamp: number): number | null;
  priceToPixel?(price: number): number | null;
  onReachLeftBoundary?: () => void;
  resetLeftBoundaryCheck?(): void;
  setActiveIndicators?(indicators: string[]): void;
  pixelToTimePrice?(x: number, y: number): { time: number; price: number } | null;
  updateDrawingState?(state: DrawingState): void;
  setChartView?(view: ChartView): void;
  setHoveredButton?(button: 'buy' | 'sell' | null): void;
  getPriceAtMousePosition?(): number | null;
  getTimeAtMousePosition?(): number | null;
  getAnimatedPrice?(): number | null;
  resetUserInteractionAndFollow?(): void;
  setBottomPadding?(padding: number): void;
}
