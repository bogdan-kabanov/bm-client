import { useRef } from 'react';
import { Candle } from '../types';
import { getServerTime } from '@src/shared/lib/serverTime';

export interface ChartRefs {
  // Mouse and interaction
  mousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  lastMouseEventRef: React.MutableRefObject<MouseEvent | null>;
  
  // Chart instance
  chartRef: React.MutableRefObject<any>;
  
  // Candles
  tempCandles: React.MutableRefObject<Candle[]>;
  lastCandleRef: React.MutableRefObject<Candle | null>;
  customCandlesTimestamps: React.MutableRefObject<Set<number>>;
  
  // WebSocket
  socketRef: React.MutableRefObject<WebSocket | null>;
  tradeSocketRef: React.MutableRefObject<WebSocket | null>;
  reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  
  // State flags
  autoFollowRef: React.MutableRefObject<boolean>;
  initialZoomApplied: React.MutableRefObject<boolean>;
  hasAppliedInitialZoom: React.MutableRefObject<boolean>;
  isUnmountedRef: React.MutableRefObject<boolean>;
  isPanningRef: React.MutableRefObject<boolean>;
  userInteractedRef: React.MutableRefObject<boolean>;
  candlesStateSyncedRef: React.MutableRefObject<boolean>;
  
  
  // Price tracking
  currentPriceRef: React.MutableRefObject<number | null>;
  lastTradeLogPriceRef: React.MutableRefObject<number | null>;
  lastTradeLogTimeRef: React.MutableRefObject<number>;
  lastCustomPriceRef: React.MutableRefObject<number | null>;
  
  // UI state
  hoveredButtonRef: React.MutableRefObject<'buy' | 'sell' | null>;
  tradingModeRef: React.MutableRefObject<'manual' | 'demo' | 'automatic' | undefined>;
  chartViewRef: React.MutableRefObject<'candles' | 'line' | 'area'>;
  activeIndicatorsRef: React.MutableRefObject<string[]>;
  
  // Zoom and pan
  previousZoomRangeRef: React.MutableRefObject<number | null>;
  isZoomLimitApplyingRef: React.MutableRefObject<boolean>;
  yScaleSmoothingRef: React.MutableRefObject<{ min: number; max: number } | null>;
  
  // History loading
  isLoadingHistoryRef: React.MutableRefObject<boolean>;
  lastHistoryCheckRef: React.MutableRefObject<number>;
  oldestLoadedCandleRef: React.MutableRefObject<number | null>;
  savedVisibleRangeRef: React.MutableRefObject<{ min: number; max: number } | null>;
  savedZoomBeforeHistoryLoadRef: React.MutableRefObject<{ min: number; max: number } | null>;
  lastLoadAttemptRef: React.MutableRefObject<number | null>;
  lastLoadedCandleCountRef: React.MutableRefObject<number>;
  limitsMinSetRef: React.MutableRefObject<number | null>;
  limitsMaxSetRef: React.MutableRefObject<number | null>;
  
  // Animation frames
  updateAnimationFrameRef: React.MutableRefObject<number | null>;
  pendingCandlesUpdateRef: React.MutableRefObject<boolean>;
  lastChartUpdateRef: React.MutableRefObject<number>;
  priceLineUpdateFrameRef: React.MutableRefObject<number | null>;
  lastPriceLineUpdateRef: React.MutableRefObject<number>;
  
  // Time tracking
  currentTimeRef: React.MutableRefObject<number>;
  lastActivityRef: React.MutableRefObject<number>;
  lastPanCheckRef: React.MutableRefObject<number>;
  
  // Page visibility
  isPageHiddenRef: React.MutableRefObject<boolean>;
  idleTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isRestoringRangeRef: React.MutableRefObject<boolean>;
  
  // Reconnect handlers
  pendingMainReconnectRef: React.MutableRefObject<(() => void) | null>;
  pendingTradeReconnectRef: React.MutableRefObject<(() => void) | null>;
  connectWebSocketLatestRef: React.MutableRefObject<(() => Promise<void>) | null>;
  connectTradeWebSocketLatestRef: React.MutableRefObject<(() => void) | null>;
  tradeReconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  
  // Other
  lastWheelBlockTimeRef: React.MutableRefObject<number>;
  defaultCandleColorsRef: React.MutableRefObject<{
    backgroundColor: { up: string; down: string; unchanged: string };
    borderColor: { up: string; down: string; unchanged: string };
  }>;
}

export const useChartRefs = (
  initialTradingMode?: 'manual' | 'demo' | 'automatic',
  initialChartView: 'candles' | 'line' | 'area' = 'candles'
): ChartRefs => {
  return {
    // Mouse and interaction
    mousePositionRef: useRef<{ x: number; y: number } | null>(null),
    lastMouseEventRef: useRef<MouseEvent | null>(null),
    
    // Chart instance
    chartRef: useRef<any>(null),
    
    // Candles
    tempCandles: useRef<Candle[]>([]),
    lastCandleRef: useRef<Candle | null>(null),
    customCandlesTimestamps: useRef<Set<number>>(new Set()),
    
    // WebSocket
    socketRef: useRef<WebSocket | null>(null),
    tradeSocketRef: useRef<WebSocket | null>(null),
    reconnectTimeoutRef: useRef<NodeJS.Timeout | null>(null),
    
    // State flags
    autoFollowRef: useRef<boolean>(true),
    initialZoomApplied: useRef<boolean>(false),
    hasAppliedInitialZoom: useRef<boolean>(false),
    isUnmountedRef: useRef<boolean>(false),
    isPanningRef: useRef<boolean>(false),
    userInteractedRef: useRef<boolean>(false),
    candlesStateSyncedRef: useRef<boolean>(false),
    
    
    // Price tracking
    currentPriceRef: useRef<number | null>(null),
    lastTradeLogPriceRef: useRef<number | null>(null),
    lastTradeLogTimeRef: useRef<number>(0),
    lastCustomPriceRef: useRef<number | null>(null),
    
    // UI state
    hoveredButtonRef: useRef<'buy' | 'sell' | null>(null),
    tradingModeRef: useRef<'manual' | 'demo' | 'automatic' | undefined>(initialTradingMode),
    chartViewRef: useRef<'candles' | 'line' | 'area'>(initialChartView),
    activeIndicatorsRef: useRef<string[]>([]),
    
    // Zoom and pan
    previousZoomRangeRef: useRef<number | null>(null),
    isZoomLimitApplyingRef: useRef<boolean>(false),
    yScaleSmoothingRef: useRef<{ min: number; max: number } | null>(null),
    
    // History loading
    isLoadingHistoryRef: useRef<boolean>(false),
    lastHistoryCheckRef: useRef<number>(0),
    oldestLoadedCandleRef: useRef<number | null>(null),
    savedVisibleRangeRef: useRef<{ min: number; max: number } | null>(null),
    savedZoomBeforeHistoryLoadRef: useRef<{ min: number; max: number } | null>(null),
    lastLoadAttemptRef: useRef<number | null>(null),
    lastLoadedCandleCountRef: useRef<number>(0),
    limitsMinSetRef: useRef<number | null>(null),
    limitsMaxSetRef: useRef<number | null>(null),
    
    // Animation frames
    updateAnimationFrameRef: useRef<number | null>(null),
    pendingCandlesUpdateRef: useRef<boolean>(false),
    lastChartUpdateRef: useRef<number>(0),
    priceLineUpdateFrameRef: useRef<number | null>(null),
    lastPriceLineUpdateRef: useRef<number>(0),
    
    // Time tracking
    currentTimeRef: useRef<number>(getServerTime()),
    lastActivityRef: useRef<number>(getServerTime()),
    lastPanCheckRef: useRef<number>(0),
    
    // Page visibility
    isPageHiddenRef: useRef<boolean>(false),
    idleTimeoutRef: useRef<NodeJS.Timeout | null>(null),
    isRestoringRangeRef: useRef<boolean>(false),
    
    // Reconnect handlers
    pendingMainReconnectRef: useRef<(() => void) | null>(null),
    pendingTradeReconnectRef: useRef<(() => void) | null>(null),
    connectWebSocketLatestRef: useRef<(() => Promise<void>) | null>(null),
    connectTradeWebSocketLatestRef: useRef<(() => void) | null>(null),
    tradeReconnectTimeoutRef: useRef<NodeJS.Timeout | null>(null),
    
    // Other
    lastWheelBlockTimeRef: useRef<number>(0),
    defaultCandleColorsRef: useRef({
      backgroundColor: {
        up: '#2ECC71',
        down: '#E74C3C',
        unchanged: '#8FA2C2',
      },
      borderColor: {
        up: '#2ECC71',
        down: '#E74C3C',
        unchanged: '#8FA2C2',
      },
    }),
  };
};

