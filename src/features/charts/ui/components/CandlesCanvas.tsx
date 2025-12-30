import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { 
  drawCandles as drawCandlesChart, 
  drawLineChart,
  drawAreaChart,
  xIndexToPixel, 
  priceToPixel,
  drawCrosshair,
  drawTimeLine,
  drawPriceTimeIntersectionMarker,
  drawActiveCandlePriceLine,
  drawGridX,
  drawGridY,
  drawHoveredButtonGradient,
  drawHoveredButtonArrow,
  drawIndicators,
} from '../../chart/rendering';
import type { Candle as ChartCandle, ViewportState, Timeframe } from '../../chart/types';
import type { ChartTimeframe } from '../types';
import { getServerTime } from '@src/shared/lib/serverTime';
import { panViewport, zoomViewport, clampViewport, type PanZoomConfig } from '../../chart/panZoom';
import { formatPrice, formatTimeForTicks } from '../../chart/timeframes';
import { storage } from '@src/shared/lib/storage';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectTradingMode, selectActiveTradesByMode } from '@src/entities/trading/model/selectors';
import { useLanguage } from '@src/app/providers/useLanguage';

interface Candle {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface CandlesCanvasProps {
  candles: Candle[];
  timeframe: ChartTimeframe;
  onCandleUpdate?: (candle: Candle) => void;
  onLoadMore?: (currentCandlesCount: number) => Promise<number>; // Callback для загрузки дополнительных свечей (возвращает количество добавленных свечей)
  hoveredButton?: 'buy' | 'sell' | null;
  drawingMode?: 'line' | 'freehand' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone' | null;
  selectionMode?: boolean; // Режим выделения рисунков
  currencyPair?: string; // Валютная пара для сохранения рисунков
  activeIndicators?: string[]; // Активные индикаторы для отображения
  eraserRadius?: number; // Радиус ластика
  chartView?: 'candles' | 'line' | 'area'; // Тип отображения графика
}

export interface CandlesCanvasHandle {
  getAnimatedPrice: () => number | null;
  addBetMarker: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => void;
  removeBetMarkerByTradeId: (tradeId: string) => void;
  openMarkerByTradeId: (tradeId: string) => void;
}

interface AnimationState {
  candleIndex: number;
  startClose: number;
  targetClose: number;
  currentClose: number;
  startHigh: number;
  targetHigh: number;
  currentHigh: number;
  startLow: number;
  targetLow: number;
  currentLow: number;
  startTime: number;
  duration: number; // Длительность анимации в миллисекундах
}

const CandlesCanvas = forwardRef<CandlesCanvasHandle, CandlesCanvasProps>(({ candles, timeframe, onCandleUpdate, onLoadMore, hoveredButton = null, drawingMode = null, selectionMode = false, currencyPair = 'default', activeIndicators = [], eraserRadius = 10, chartView = 'candles' }, ref) => {
  // Получаем режим торговли из Redux
  const tradingMode = useAppSelector(selectTradingMode);
  const { t } = useLanguage();
  // Вспомогательная функция для проверки, активен ли режим рисования
  const checkDrawingModeActive = useCallback(() => {
    // Проверяем несколько вариантов:
    // 1. Активная кнопка инструментов рисования
    // 2. Активный инструмент в меню
    // 3. Открытое меню инструментов рисования
    const drawingBtn = document.querySelector('.drawing-btn.active');
    const drawingToolOption = document.querySelector('.drawing-tool-option.active:not(.eraser-option)');
    const drawingToolsMenu = document.querySelector('.drawing-tools-menu');
    
    // Пытаемся определить активный инструмент из DOM
    let activeModeFromDOM: DrawingToolType = null;
    if (drawingToolOption) {
      // Пытаемся получить тип инструмента из data-атрибута или класса
      const toolId = drawingToolOption.getAttribute('data-tool') || 
                     drawingToolOption.getAttribute('data-drawing-tool') ||
                     drawingToolOption.className.match(/tool-(line|freehand|rectangle|circle|arrow|horizontal|vertical|text|parallel|fibonacci|channel|trendline|zone)/)?.[1];
      if (toolId && ['line', 'freehand', 'rectangle', 'circle', 'arrow', 'horizontal', 'vertical', 'text', 'parallel', 'fibonacci', 'channel', 'trendline', 'zone'].includes(toolId)) {
        activeModeFromDOM = toolId as DrawingToolType;
      }
    }
    
    // Проверяем активную кнопку в toolbar
    const activeToolbarButton = document.querySelector('.chart-toolbar-button.active, .chart-tools-button.active');
    if (activeToolbarButton && !activeModeFromDOM) {
      const toolId = activeToolbarButton.getAttribute('data-tool') || 
                     activeToolbarButton.getAttribute('data-drawing-tool') ||
                     activeToolbarButton.className.match(/tool-(line|freehand|rectangle|circle|arrow|horizontal|vertical|text|parallel|fibonacci|channel|trendline|zone)/)?.[1];
      if (toolId && ['line', 'freehand', 'rectangle', 'circle', 'arrow', 'horizontal', 'vertical', 'text', 'parallel', 'fibonacci', 'channel', 'trendline', 'zone'].includes(toolId)) {
        activeModeFromDOM = toolId as DrawingToolType;
      }
    }
    
    // Проверяем, открыто ли меню - учитываем разные способы скрытия
    let isDrawingToolsMenuOpen = false;
    if (drawingToolsMenu) {
      const style = window.getComputedStyle(drawingToolsMenu);
      const display = style.display;
      const visibility = style.visibility;
      const opacity = parseFloat(style.opacity);
      const transform = style.transform;
      
      // Меню считается открытым, если оно видимо
      isDrawingToolsMenuOpen = display !== 'none' && 
                               visibility !== 'hidden' && 
                               opacity > 0 &&
                               !transform.includes('translateX(-100%)') &&
                               !transform.includes('scale(0)');
    }
    
    // Используем drawingMode из пропсов, если он есть, иначе используем режим из DOM
    const effectiveMode = drawingMode || activeModeFromDOM;
    const isActive = (effectiveMode && effectiveMode !== 'eraser') || drawingBtn || drawingToolOption || isDrawingToolsMenuOpen;
    
    return {
      isActive,
      hasDrawingBtn: !!drawingBtn,
      hasDrawingToolOption: !!drawingToolOption,
      isDrawingToolsMenuOpen,
      drawingMode: effectiveMode
    };
  }, [drawingMode]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ВАЖНО: инициализируем состояние и refs с пустыми массивами для гарантированного полного сброса
  // при перемонтировании компонента (через key prop). Props candles будут обработаны в useEffect.
  const [animatedCandles, setAnimatedCandles] = useState<Candle[]>([]);
  const animatedCandlesRef = useRef<Candle[]>([]);
  const animationStateRef = useRef<AnimationState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const prevCandlesRef = useRef<Candle[]>([]);
  const renderCandlesRef = useRef<(() => void) | null>(null);
  const lastOnCandleUpdateTimeRef = useRef<number>(0);
  const ON_CANDLE_UPDATE_THROTTLE_MS = 50; // Ограничиваем частоту вызовов onCandleUpdate
  const timeLineAnimationRafId = useRef<number | null>(null); // Анимация линии времени для плавного движения
  const animatedPriceRef = useRef<number | null>(null); // Ref для хранения текущей анимированной цены
  
  // Hover state for crosshair
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverCandle, setHoverCandle] = useState<ChartCandle | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  
  // Viewport state for pan and zoom
  const viewportRef = useRef<ViewportState | null>(null);
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  
  // Pan state
  const isDraggingRef = useRef<boolean>(false);
  const lastDragXRef = useRef<number>(0);
  const userInteractedRef = useRef<boolean>(false);
  const mouseDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  const clickedMarkerRef = useRef<BetMarker | null>(null);
  const isEraserMouseDownRef = useRef<boolean>(false); // Отслеживаем нажатие ЛКМ для ластика
  const previousHoveredMarkerIdRef = useRef<string | null>(null); // Отслеживаем предыдущий наведенный маркер
  const isLoadingMoreRef = useRef<boolean>(false); // Отслеживаем загрузку дополнительных свечей
  const lastLoadMoreCheckRef = useRef<number>(0); // Время последней проверки загрузки
  const lastRequestedFirstCandleTimeRef = useRef<number | null>(null); // Время первой (самой старой) свечи при последнем запросе для предотвращения дублирующих запросов
  const pendingViewportAdjustmentRef = useRef<number | null>(null); // Ожидаемое количество свечей для корректировки viewport
  
  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const drawingStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingCurrentPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingPathRef = useRef<Array<{ x: number; y: number }>>([]);
  const currentDrawingModeRef = useRef<DrawingToolType>(null); // Сохраняем режим рисования при начале
  
  // Saved drawings
  type DrawingToolType = 'line' | 'freehand' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone' | null;
  
  interface SavedDrawing {
    id: string;
    type: DrawingToolType;
    // Храним координаты времени и цены, а не пиксели
    startPoint: { time: number; price: number };
    endPoint: { time: number; price: number };
    path: Array<{ time: number; price: number }>;
    color: string;
  }
  
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<string>>(new Set());
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const isMovingDrawingRef = useRef<boolean>(false);
  const renderLogRef = useRef<string | null>(null);
  const moveOffsetRef = useRef<{ x: number; y: number } | null>(null);
  
  // Состояние для области выделения (selection box)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isSelectingRef = useRef<boolean>(false);
  
  // Маркеры ставок (bet markers)
  interface BetMarker {
    id: string;
    time: number;
    price: number;
    direction: 'buy' | 'sell';
    createdAt: number;
    expirationTime?: number; // Время окончания ставки в миллисекундах
    tradeId?: string; // ID сделки для связи с активной сделкой
    isDemo?: boolean; // Режим торговли: true для демо, false для реального
  }
  
  const [betMarkers, setBetMarkers] = useState<BetMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<BetMarker | null>(null);
  const [isMarkerSidebarOpen, setIsMarkerSidebarOpen] = useState(false);
  
  // Получаем активные сделки из Redux для отображения информации о сделке в меню
  const activeTrades = useAppSelector(selectActiveTradesByMode);
  
  const topPadding = 50; // Константа для верхнего отступа
  const ochlBottomPadding = 90; // Константа для нижнего отступа (для OCHL панели)
  
  // Состояние для обновления времени маркеров
  const [markerUpdateTrigger, setMarkerUpdateTrigger] = useState(0);
  
  // Функция для форматирования оставшегося времени (MM:SS)
  const formatRemainingTime = useCallback((expirationTime: number, currentTime: number): string => {
    const remaining = Math.max(0, expirationTime - currentTime);
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  // Функция для форматирования времени в UTC (не зависит от часового пояса пользователя)
  const formatDateTimeUTC = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
  }, []);
  
  const formatPercent = useCallback((value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }, []);
  
  // Функция для получения ключа localStorage для рисунков
  const getDrawingsStorageKey = useCallback(() => {
    return `chart-drawings-${currencyPair}-${timeframe}`;
  }, [currencyPair, timeframe]);
  
  // Загружаем сохраненные рисунки при монтировании или изменении валютной пары/таймфрейма
  useEffect(() => {
    const storageKey = getDrawingsStorageKey();
    const saved = storage.getJson<SavedDrawing[]>(storageKey);
    if (saved && Array.isArray(saved)) {
      setSavedDrawings(saved);
    } else {
      setSavedDrawings([]);
    }
  }, [getDrawingsStorageKey]);
  
  // Сохраняем рисунки в localStorage при каждом изменении
  useEffect(() => {
    const storageKey = getDrawingsStorageKey();
    storage.setJson(storageKey, savedDrawings);
  }, [savedDrawings, getDrawingsStorageKey]);
  
  // Преобразуем активные сделки в маркеры ставок на основе текущей валютной пары
  useEffect(() => {
    if (!currencyPair) {
      setBetMarkers([]);
      return;
    }
    
    // Фильтруем активные сделки по текущей валютной паре
    const relevantTrades = activeTrades.filter(trade => {
      // Проверяем по baseCurrency (например, "BTC")
      const matchesBase = trade.baseCurrency?.toUpperCase() === currencyPair.toUpperCase();
      // Проверяем по symbol (например, "BTC_USDT")
      const matchesSymbol = trade.symbol?.toUpperCase().startsWith(currencyPair.toUpperCase() + '_');
      
      return matchesBase || matchesSymbol;
    });
    
    // Преобразуем сделки в маркеры
    const markers: BetMarker[] = relevantTrades.map(trade => ({
      id: `bet-marker-${trade.id}`,
      time: trade.createdAt,
      price: trade.entryPrice || trade.price, // Используем entryPrice для позиционирования
      direction: trade.direction,
      createdAt: trade.createdAt,
      expirationTime: trade.expirationTime,
      tradeId: trade.id,
      amount: trade.amount,
      isDemo: trade.isDemo || trade.is_demo || false,
    }));
    
    setBetMarkers(markers);
    
    // Вызываем перерисовку после обновления маркеров
    if (renderCandlesRef.current) {
      requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
      });
    }
  }, [activeTrades, currencyPair, tradingMode]);
  
  // Функция сглаживания пути с использованием алгоритма Chaikin для создания плавных дуг
  const smoothPath = useCallback((path: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    if (path.length <= 2) return path;
    
    // Используем алгоритм Chaikin для создания плавных кривых
    // Он создает новые точки между существующими, что дает более плавные переходы
    let smoothed: Array<{ x: number; y: number }> = [...path];
    
    // Применяем алгоритм сглаживания несколько раз для более плавного результата
    for (let iteration = 0; iteration < 2; iteration++) {
      const newPoints: Array<{ x: number; y: number }> = [smoothed[0]]; // Первая точка остается
      
      for (let i = 0; i < smoothed.length - 1; i++) {
        const curr = smoothed[i];
        const next = smoothed[i + 1];
        
        // Создаем две новые точки между текущей и следующей
        // Первая точка на 1/4 пути от curr к next
        const q1 = {
          x: curr.x + (next.x - curr.x) * 0.25,
          y: curr.y + (next.y - curr.y) * 0.25,
        };
        
        // Вторая точка на 3/4 пути от curr к next
        const q2 = {
          x: curr.x + (next.x - curr.x) * 0.75,
          y: curr.y + (next.y - curr.y) * 0.75,
        };
        
        newPoints.push(q1);
        newPoints.push(q2);
      }
      
      // Последняя точка остается
      newPoints.push(smoothed[smoothed.length - 1]);
      smoothed = newPoints;
    }
    
    return smoothed;
  }, []);
  
  // Pan/Zoom config
  const panZoomConfig: PanZoomConfig = {
    minCandlesPerScreen: 10,
    maxCandlesPerScreen: 500,
    overshootCandles: 0.5,
  };

  const convertCandles = useCallback((candles: Candle[]): ChartCandle[] => {
    return candles.map(c => ({
      openTime: c.x,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));
  }, []);

  const renderCandles = useCallback(() => {
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      console.warn('[CandlesCanvas] ⚠️ renderCandles: canvas или container недоступны', {
        hasCanvas: !!canvas,
        hasContainer: !!container,
      });
      return;
    }

    // Используем актуальные данные из ref для синхронного доступа
    const candlesToRender = animatedCandlesRef.current;
    if (candlesToRender.length === 0) {
      console.warn('[CandlesCanvas] ⚠️ renderCandles: нет свечей для отрисовки');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match container
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const chartCandles = convertCandles(candlesToRender);
    
    // Ensure we have a valid viewport before proceeding
    if (chartCandles.length === 0) return;
    
    // Initialize or update viewport
    let currentViewport = viewportRef.current;
    if (!currentViewport) {
      // Initialize viewport - center on last candle
      const candlesPerScreen = 50;
      const centerIndex = chartCandles.length - 1;
      const fromIndex = Math.max(0, centerIndex - candlesPerScreen / 2);
      const toIndex = Math.min(chartCandles.length - 1, centerIndex + candlesPerScreen / 2);
      
      currentViewport = {
        centerIndex,
        candlesPerScreen,
        fromIndex,
        toIndex,
        minPrice: 0,
        maxPrice: 0,
      };
      viewportRef.current = currentViewport;
      setViewport(currentViewport);
    } else {
      // Use the viewport from ref (which may have been updated by zoom/pan)
      // Only auto-follow if user hasn't interacted
      if (!userInteractedRef.current) {
        // Auto-follow: update viewport to follow last candle if user hasn't interacted
        const lastIndex = chartCandles.length - 1;
        const currentCenter = currentViewport.centerIndex;
        const candlesPerScreen = currentViewport.candlesPerScreen;
        
        // Only auto-follow if we're near the end (within 5 candles)
        if (lastIndex - currentCenter < 5) {
          const newCenterIndex = lastIndex;
          const newFromIndex = Math.max(0, newCenterIndex - candlesPerScreen / 2);
          const newToIndex = Math.min(chartCandles.length - 1, newCenterIndex + candlesPerScreen / 2);
          
          currentViewport = {
            ...currentViewport,
            centerIndex: newCenterIndex,
            fromIndex: newFromIndex,
            toIndex: newToIndex,
          };
          viewportRef.current = currentViewport;
          setViewport(currentViewport);
        }
      }
    }
    
    // Always clamp viewport to valid range (important for zoom/pan)
    currentViewport = clampViewport(currentViewport, chartCandles.length, panZoomConfig);
    viewportRef.current = currentViewport;
    
    // Calculate price range for visible candles
    const fromIdx = Math.max(0, Math.floor(currentViewport.fromIndex));
    const toIdx = Math.min(chartCandles.length - 1, Math.ceil(currentViewport.toIndex));
    const visibleCandles = chartCandles.slice(fromIdx, toIdx + 1);
    if (visibleCandles.length === 0) return;
    
    // Собираем цены ТОЛЬКО из видимых свечей
    // Это гарантирует, что диапазон цен адаптируется к видимой области при панорамировании
    const prices = visibleCandles.flatMap(c => [c.high, c.low]);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    // Убираем padding, чтобы свечи растягивались на всю доступную высоту
    // Используем минимальный padding только для предотвращения деления на ноль
    const padding = priceRange > 0 ? 0 : Math.max(minPrice * 0.0001, 0.0001);
    
    // ВАЖНО: Включаем цены маркеров ставок в диапазон, чтобы они всегда были видны
    let finalMinPrice = minPrice - padding;
    let finalMaxPrice = maxPrice + padding;
    
    if (betMarkers.length > 0) {
      const markerPrices = betMarkers.map(m => m.price);
      const markerMinPrice = Math.min(...markerPrices);
      const markerMaxPrice = Math.max(...markerPrices);
      
      // Расширяем диапазон только если маркеры выходят за пределы диапазона свечей
      // Не добавляем лишний padding, чтобы свечи занимали всю доступную высоту
      if (markerMinPrice < finalMinPrice) {
        finalMinPrice = markerMinPrice;
      }
      if (markerMaxPrice > finalMaxPrice) {
        finalMaxPrice = markerMaxPrice;
      }
    }
    
    const viewportWithPrices: ViewportState = {
      ...currentViewport,
      minPrice: finalMinPrice,
      maxPrice: finalMaxPrice,
    };

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Toolbar на bottom: 25px, высотой 40px (toolbar от height - 65 до height - 25)
    // OCHL начинается на height - ~143px
    // Область свечей должна заканчиваться выше OCHL, примерно на height - 145px
    // Используем константы, определенные на уровне компонента
    const chartAreaHeightForCandles = rect.height - ochlBottomPadding - topPadding;
    
    // Draw grid (horizontal and vertical lines) - ПЕРЕД свечами, чтобы быть под ними
    // Сетка должна идти до самого низа (полная высота)
    const chartAreaHeight = rect.height - ochlBottomPadding;
    const timeAxisY = rect.height - 20;
    
    // Draw horizontal grid lines (price levels) - на полную высоту
    // Это также рисует цены справа
    drawGridY(
      ctx,
      viewportWithPrices,
      rect.width,
      rect.height
    );
    
    // Draw vertical grid lines (time axis) - на полную высоту
    drawGridX(
      ctx,
      chartCandles,
      viewportWithPrices,
      timeframe as Timeframe,
      rect.width,
      rect.height,
      rect.height,
      timeAxisY
    );
    
    // Теперь рисуем свечи и маркеры ПОВЕРХ сетки
    ctx.save();
    ctx.translate(0, topPadding);
    
    // Выбираем функцию рендеринга в зависимости от типа графика
    if (chartView === 'line') {
      drawLineChart(
        ctx,
        chartCandles,
        viewportWithPrices,
        rect.width,
        chartAreaHeightForCandles,
        hoverIndex
      );
    } else if (chartView === 'area') {
      drawAreaChart(
        ctx,
        chartCandles,
        viewportWithPrices,
        rect.width,
        chartAreaHeightForCandles,
        hoverIndex
      );
    } else {
      drawCandlesChart(
        ctx,
        chartCandles,
        viewportWithPrices,
        rect.width,
        chartAreaHeightForCandles,
        hoverIndex
      );
    }
    
    // Draw indicators (индикаторы рисуются внутри области с topPadding)
    if (activeIndicators && activeIndicators.length > 0) {
      drawIndicators(
        ctx,
        chartCandles,
        viewportWithPrices,
        rect.width,
        chartAreaHeightForCandles,
        activeIndicators
      );
    }
    
    ctx.restore();
    
    // Draw time line на полную высоту canvas (после restore, чтобы не учитывать translate)
    // Передаем undefined, чтобы функция использовала getServerTime() с интерполяцией для плавного движения
    const currentTime = getServerTime(); // Получаем серверное время для других функций
    drawTimeLine(
      ctx,
      undefined, // Функция сама использует getServerTime() с интерполяцией для плавного движения
      chartCandles,
      viewportWithPrices,
      rect.width,
      rect.height, // Полная высота canvas
      timeframe as Timeframe
    );
    
    // Get animated price from last candle
    const lastAnimatedCandle = animatedCandlesRef.current[animatedCandlesRef.current.length - 1];
    const animatedPrice = lastAnimatedCandle ? lastAnimatedCandle.c : null;
    
    // Сохраняем animatedPrice в ref для доступа извне
    animatedPriceRef.current = animatedPrice;
    
    // Draw hovered button arrow (внутри области с topPadding)
    ctx.save();
    ctx.translate(0, topPadding);
    
    drawHoveredButtonArrow(
      ctx,
      chartCandles,
      viewportWithPrices,
      rect.width,
      chartAreaHeightForCandles,
      hoveredButton || null,
      chartCandles, // realCandles
      animatedPrice, // animatedPrice
      currentTime, // currentTime
      timeframe as Timeframe
    );
    
    ctx.restore();
    
    // Draw active candle price line и crosshair на полную высоту canvas (после restore, чтобы не учитывать translate)
    drawActiveCandlePriceLine(
      ctx,
      chartCandles,
      viewportWithPrices,
      rect.width,
      chartAreaHeightForCandles,
      rect.height, // fullHeight
      topPadding,
      chartCandles, // realCandles
      animatedPrice // animatedPrice
    );
    
    // Draw crosshair на полную высоту
    // hoverY уже в абсолютных координатах canvas, поэтому используем его напрямую
    drawCrosshair(
      ctx,
      hoverIndex,
      hoverCandle,
      hoverX,
      hoverY, // Используем абсолютные координаты
      viewportWithPrices,
      rect.width,
      rect.height, // fullHeight
      topPadding,
      chartAreaHeightForCandles,
      timeframe as Timeframe
    );
    
    // Draw drawing (если активно рисование)
    // Определяем активный режим рисования
    const drawingCheck = checkDrawingModeActive();
    const currentDrawingMode = drawingMode || drawingCheck.drawingMode;
    
    if (isDrawingRef.current && drawingStartPointRef.current && drawingCurrentPointRef.current && currentDrawingMode) {
      ctx.save();
      ctx.translate(0, topPadding);
      
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const start = drawingStartPointRef.current;
      const current = drawingCurrentPointRef.current;
      
      if (currentDrawingMode === 'freehand') {
        // Рисуем свободную линию
        if (drawingPathRef.current.length > 1) {
          ctx.beginPath();
          ctx.moveTo(drawingPathRef.current[0].x, drawingPathRef.current[0].y);
          for (let i = 1; i < drawingPathRef.current.length; i++) {
            ctx.lineTo(drawingPathRef.current[i].x, drawingPathRef.current[i].y);
          }
          ctx.stroke();
        } else if (drawingPathRef.current.length === 1) {
          // Если только одна точка, рисуем маленький круг
          const point = drawingPathRef.current[0];
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      } else if (currentDrawingMode === 'line' || currentDrawingMode === 'arrow' || currentDrawingMode === 'trendline') {
        // Рисуем линию
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
        
        // Если стрелка, рисуем наконечник
        if (currentDrawingMode === 'arrow') {
          const angle = Math.atan2(current.y - start.y, current.x - start.x);
          const arrowLength = 10;
          const arrowAngle = Math.PI / 6;
          
          ctx.beginPath();
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(
            current.x - arrowLength * Math.cos(angle - arrowAngle),
            current.y - arrowLength * Math.sin(angle - arrowAngle)
          );
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(
            current.x - arrowLength * Math.cos(angle + arrowAngle),
            current.y - arrowLength * Math.sin(angle + arrowAngle)
          );
          ctx.stroke();
        }
      } else if (currentDrawingMode === 'rectangle') {
        // Рисуем прямоугольник
        const width = current.x - start.x;
        const height = current.y - start.y;
        ctx.strokeRect(start.x, start.y, width, height);
      } else if (currentDrawingMode === 'circle') {
        // Рисуем круг
        const radius = Math.sqrt(
          Math.pow(current.x - start.x, 2) + Math.pow(current.y - start.y, 2)
        );
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (currentDrawingMode === 'horizontal') {
        // Рисуем горизонтальную линию
        ctx.beginPath();
        ctx.moveTo(0, start.y);
        ctx.lineTo(rect.width, start.y);
        ctx.stroke();
      } else if (currentDrawingMode === 'vertical') {
        // Рисуем вертикальную линию
        ctx.beginPath();
        ctx.moveTo(start.x, 0);
        ctx.lineTo(start.x, chartAreaHeightForCandles);
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    // Draw saved drawings
    if (savedDrawings.length > 0) {
      ctx.save();
      ctx.translate(0, topPadding);
      
      savedDrawings.forEach((drawing, index) => {
        const isSelected = selectedDrawingIds.has(drawing.id);
        
        // Преобразуем координаты времени/цены в пиксели
        // Логируем только для последнего рисунка (самого свежего)
        const isLastDrawing = index === savedDrawings.length - 1;
        
        // Логируем viewport при отрисовке для последнего рисунка
        if (isLastDrawing) {
          console.log('[CandlesCanvas] renderDrawings: viewport при отрисовке', {
            drawingId: drawing.id,
            viewport: {
              minPrice: viewportWithPrices.minPrice,
              maxPrice: viewportWithPrices.maxPrice,
              fromIndex: viewportWithPrices.fromIndex,
              toIndex: viewportWithPrices.toIndex,
              candlesPerScreen: viewportWithPrices.candlesPerScreen,
              chartAreaHeight: rect.height - ochlBottomPadding - topPadding
            },
            savedStartPoint: drawing.startPoint,
            savedEndPoint: drawing.endPoint
          });
        }
        
        const startPixel = timePriceToPixel(drawing.startPoint.time, drawing.startPoint.price, viewportWithPrices, chartCandles, rect, isLastDrawing ? `start-${drawing.id}` : undefined);
        const endPixel = timePriceToPixel(drawing.endPoint.time, drawing.endPoint.price, viewportWithPrices, chartCandles, rect, isLastDrawing ? `end-${drawing.id}` : undefined);
        
        if (!startPixel || !endPixel) {
          return; // Пропускаем если координаты вне видимой области
        }
        
        // Увеличиваем толщину и меняем цвет для выделенного рисунка
        ctx.strokeStyle = isSelected ? '#ffa500' : drawing.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (drawing.type === 'freehand' && drawing.path.length > 1) {
          // Рисуем свободную линию
          ctx.beginPath();
          let hasValidPoints = false;
          const firstPixel = timePriceToPixel(drawing.path[0].time, drawing.path[0].price, viewportWithPrices, chartCandles, rect);
          if (firstPixel) {
            ctx.moveTo(firstPixel.x, firstPixel.y);
            hasValidPoints = true;
            for (let i = 1; i < drawing.path.length; i++) {
              const pixel = timePriceToPixel(drawing.path[i].time, drawing.path[i].price, viewportWithPrices, chartCandles, rect);
              if (pixel) {
                ctx.lineTo(pixel.x, pixel.y);
              }
            }
            if (hasValidPoints) {
              ctx.stroke();
            }
          }
        } else if (drawing.type === 'line' || drawing.type === 'arrow' || drawing.type === 'trendline') {
          // Рисуем линию
          ctx.beginPath();
          ctx.moveTo(startPixel.x, startPixel.y);
          ctx.lineTo(endPixel.x, endPixel.y);
          ctx.stroke();
          
          // Если стрелка, рисуем наконечник
          if (drawing.type === 'arrow') {
            const angle = Math.atan2(
              endPixel.y - startPixel.y,
              endPixel.x - startPixel.x
            );
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            
            ctx.beginPath();
            ctx.moveTo(endPixel.x, endPixel.y);
            ctx.lineTo(
              endPixel.x - arrowLength * Math.cos(angle - arrowAngle),
              endPixel.y - arrowLength * Math.sin(angle - arrowAngle)
            );
            ctx.moveTo(endPixel.x, endPixel.y);
            ctx.lineTo(
              endPixel.x - arrowLength * Math.cos(angle + arrowAngle),
              endPixel.y - arrowLength * Math.sin(angle + arrowAngle)
            );
            ctx.stroke();
          }
        } else if (drawing.type === 'rectangle') {
          // Рисуем прямоугольник
          const width = endPixel.x - startPixel.x;
          const height = endPixel.y - startPixel.y;
          ctx.strokeRect(startPixel.x, startPixel.y, width, height);
        } else if (drawing.type === 'circle') {
          // Рисуем круг
          const radius = Math.sqrt(
            Math.pow(endPixel.x - startPixel.x, 2) +
            Math.pow(endPixel.y - startPixel.y, 2)
          );
          ctx.beginPath();
          ctx.arc(startPixel.x, startPixel.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (drawing.type === 'horizontal') {
          // Рисуем горизонтальную линию
          const y = startPixel.y;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rect.width, y);
          ctx.stroke();
        } else if (drawing.type === 'vertical') {
          // Рисуем вертикальную линию
          const x = startPixel.x;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, chartAreaHeightForCandles);
          ctx.stroke();
        }
        
        // Рисуем маркеры выделения для выбранного рисунка
        if (isSelected) {
          ctx.fillStyle = '#ffa500';
          ctx.beginPath();
          if (drawing.type === 'freehand' && drawing.path.length > 0) {
            // Маркеры на первой и последней точке
            const firstPixel = timePriceToPixel(drawing.path[0].time, drawing.path[0].price, viewportWithPrices, chartCandles, rect);
            const lastPixel = timePriceToPixel(drawing.path[drawing.path.length - 1].time, drawing.path[drawing.path.length - 1].price, viewportWithPrices, chartCandles, rect);
            if (firstPixel) {
              ctx.arc(firstPixel.x, firstPixel.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
            if (lastPixel) {
              ctx.beginPath();
              ctx.arc(lastPixel.x, lastPixel.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
          } else {
            // Маркеры на начальной и конечной точке
            ctx.arc(startPixel.x, startPixel.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(endPixel.x, endPixel.y, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      });
      
      ctx.restore();
    }
    
    // Draw selection box (область выделения)
    if (selectionBox) {
      ctx.save();
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);
      
      // Рисуем полупрозрачный прямоугольник
      ctx.fillStyle = 'rgba(255, 165, 0, 0.1)';
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      
      // Рисуем границу
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      
      ctx.restore();
    }
    
    // Draw hovered button gradient (на всю высоту canvas, после restore)
    drawHoveredButtonGradient(
      ctx,
      chartCandles,
      viewportWithPrices,
      rect.width,
      rect.height,
      topPadding,
      chartAreaHeightForCandles,
      hoveredButton || null,
      chartCandles, // realCandles
      animatedPrice // animatedPrice (уже объявлена выше)
    );
    
    // Draw OHLC values (bottom left) - только при наведении мыши
    if (hoverCandle) {
      const padding = 10;
      const lineHeight = 18;
      // Position OHLC выше toolbar (toolbar на bottom: 25px, высотой 40px)
      const toolbarHeight = 40;
      const toolbarBottom = 25; // Toolbar находится на bottom: 25px
      const ochlToolbarGap = 10; // Отступ между OCHL и toolbar
      // Toolbar находится от height - 65 до height - 25
      // OCHL должен заканчиваться выше toolbar, на height - 75px
      // OCHL начинается на height - 75 - (lineHeight * 4) - padding = height - 157px
      const startY = rect.height - toolbarBottom - toolbarHeight - ochlToolbarGap - (lineHeight * 4) - padding;
      
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      ctx.fillText(`O: ${formatPrice(hoverCandle.open)}`, padding, startY);
      ctx.fillText(`H: ${formatPrice(hoverCandle.high)}`, padding, startY + lineHeight);
      ctx.fillText(`L: ${formatPrice(hoverCandle.low)}`, padding, startY + lineHeight * 2);
      ctx.fillText(`C: ${formatPrice(hoverCandle.close)}`, padding, startY + lineHeight * 3);
      
      ctx.restore();
    }
    
    // Draw price-time intersection marker (в самом конце, чтобы быть поверх всех элементов)
    // Используем ту же высоту, что и drawActiveCandlePriceLine, чтобы маркер был точно на линии цены
    drawPriceTimeIntersectionMarker(
      ctx,
      chartCandles,
      viewportWithPrices,
      currentTime,
      rect.width,
      chartAreaHeightForCandles + topPadding, // chartAreaHeightForCandles + topPadding = rect.height - ochlBottomPadding
      timeframe as Timeframe,
      chartCandles, // realCandles
      animatedPrice, // animatedPrice
      topPadding // topPadding для корректного позиционирования
    );
    
    // Draw bet markers (маркеры ставок)
    if (betMarkers.length > 0) {
      
      ctx.save();
      ctx.translate(0, topPadding);
      
      // Вычисляем высоту области графика для проверки видимости
      const chartAreaHeight = rect.height - topPadding;
      
      let renderedMarkersCount = 0;
      let skippedMarkersCount = 0;
      
      betMarkers.forEach((marker, index) => {
        // Используем timePriceToPixel для точного вычисления координат маркера
        const markerPixel = timePriceToPixel(marker.time, marker.price, viewportWithPrices, chartCandles, rect);
        if (!markerPixel) {
          skippedMarkersCount++;
          return;
        }
        
        // Вычисляем ширину свечи для определения отступа
        const distanceBetweenCenters = rect.width / viewportWithPrices.candlesPerScreen;
        const candleWidthPx = Math.max(1.2, distanceBetweenCenters - 5);
        
        // Позиционируем маркер слева от точной позиции времени с небольшим отступом
        const offsetFromCandle = 8; // Отступ от позиции времени
        const markerX = markerPixel.x - offsetFromCandle;
        
        // Y координата уже вычислена правильно в timePriceToPixel
        const markerY = markerPixel.y;
        
        // Форматируем сумму ставки и оставшееся время для подписи
        // ВАЖНО: Отображаем сумму ставки (amount), а не цену входа (price)
        const hasAmount = marker.amount !== undefined && marker.amount !== null && marker.amount > 0;
        const amountStr = hasAmount
          ? `$${marker.amount.toFixed(2)}` 
          : formatPrice(marker.price); // Fallback на цену, если amount не указан или равен 0
        
        const currentTime = getServerTime();
        let timeStr = '';
        if (marker.expirationTime && marker.expirationTime > currentTime) {
          // Показываем оставшееся время до окончания ставки
          timeStr = formatRemainingTime(marker.expirationTime, currentTime);
        } else if (marker.expirationTime && marker.expirationTime <= currentTime) {
          // Время истекло
          timeStr = '00:00';
        } else {
          // Если нет expirationTime, показываем время ставки
          timeStr = formatTimeForTicks(marker.time, timeframe as Timeframe);
        }
        
        // Настройки шрифта
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // Формируем текст метки: "сумма_ставки оставшееся_время" (например "$1.00 05:30")
        const labelText = `${amountStr} ${timeStr}`;
        const labelMetrics = ctx.measureText(labelText);
        
        // Размеры метки
        const labelPaddingX = 10;
        const labelPaddingY = 6;
        const labelHeight = 24;
        const labelWidth = labelMetrics.width + labelPaddingX * 2;
        const borderRadius = 12;
        const handleSize = 6; // Уменьшаем размер кружка в 2 раза
        const offsetFromLabel = 8; // Отступ от метки до начала линии
        
        // Позиция метки: слева от маркера, отцентрирована по Y
        const labelX = markerX - labelWidth - offsetFromLabel;
        const labelY = markerY;
        
        // Проверяем, что маркер и метка находятся в видимой области (с запасом для метки слева)
        if (labelX + labelWidth < -100 || markerX > rect.width + 50 || markerY < -50 || markerY > chartAreaHeight + 50) {
          skippedMarkersCount++;
          return; // Пропускаем если координаты вне видимой области
        }
        
        renderedMarkersCount++;
        
        // Цвета в зависимости от направления
        const markerColor = marker.direction === 'buy' ? '#32AC41' : '#F7525F';
        const markerColorLight = marker.direction === 'buy' ? 'rgba(50, 172, 65, 0.95)' : 'rgba(247, 82, 95, 0.95)';
        
        // Рисуем округлую прямоугольную метку
        const labelRectY = labelY - labelHeight / 2;
        ctx.fillStyle = markerColorLight;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(labelX, labelRectY, labelWidth, labelHeight, borderRadius);
          ctx.fill();
          // Обводка метки
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Fallback для браузеров без поддержки roundRect
          ctx.beginPath();
          ctx.moveTo(labelX + borderRadius, labelRectY);
          ctx.lineTo(labelX + labelWidth - borderRadius, labelRectY);
          ctx.quadraticCurveTo(labelX + labelWidth, labelRectY, labelX + labelWidth, labelRectY + borderRadius);
          ctx.lineTo(labelX + labelWidth, labelRectY + labelHeight - borderRadius);
          ctx.quadraticCurveTo(labelX + labelWidth, labelRectY + labelHeight, labelX + labelWidth - borderRadius, labelRectY + labelHeight);
          ctx.lineTo(labelX + borderRadius, labelRectY + labelHeight);
          ctx.quadraticCurveTo(labelX, labelRectY + labelHeight, labelX, labelRectY + labelHeight - borderRadius);
          ctx.lineTo(labelX, labelRectY + borderRadius);
          ctx.quadraticCurveTo(labelX, labelRectY, labelX + borderRadius, labelRectY);
          ctx.closePath();
          ctx.fill();
          // Обводка метки
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        
        // Рисуем текст в метке
        ctx.fillStyle = '#fff';
        ctx.fillText(labelText, labelX + labelPaddingX, labelY);
        
        // Вычисляем X координату времени окончания ставки (где будет кружок)
        let lineEndX = rect.width; // По умолчанию до конца графика
        if (marker.expirationTime) {
          // Находим индекс свечи для времени окончания
          let expirationExactIndex: number;
          if (marker.expirationTime <= chartCandles[0].openTime) {
            expirationExactIndex = 0;
          } else if (marker.expirationTime >= chartCandles[chartCandles.length - 1].openTime) {
            const lastCandle = chartCandles[chartCandles.length - 1];
            let timeInterval = 60_000;
            if (chartCandles.length > 1) {
              const prevCandle = chartCandles[chartCandles.length - 2];
              timeInterval = lastCandle.openTime - prevCandle.openTime;
            }
            if (timeInterval > 0) {
              const timeSinceLastCandle = marker.expirationTime - lastCandle.openTime;
              expirationExactIndex = chartCandles.length - 1 + (timeSinceLastCandle / timeInterval);
            } else {
              expirationExactIndex = chartCandles.length - 1;
            }
          } else {
            let foundIndex = -1;
            for (let i = 0; i < chartCandles.length - 1; i++) {
              if (marker.expirationTime >= chartCandles[i].openTime && marker.expirationTime <= chartCandles[i + 1].openTime) {
                foundIndex = i;
                break;
              }
            }
            if (foundIndex >= 0) {
              const currCandle = chartCandles[foundIndex];
              const nextCandle = chartCandles[foundIndex + 1];
              const timeInterval = nextCandle.openTime - currCandle.openTime;
              if (timeInterval > 0) {
                const fraction = (marker.expirationTime - currCandle.openTime) / timeInterval;
                expirationExactIndex = foundIndex + fraction;
              } else {
                expirationExactIndex = foundIndex;
              }
            } else {
              foundIndex = chartCandles.reduce((closest, c, i) => {
                const currentDiff = Math.abs(c.openTime - marker.expirationTime);
                const closestDiff = Math.abs(chartCandles[closest].openTime - marker.expirationTime);
                return currentDiff < closestDiff ? i : closest;
              }, 0);
              expirationExactIndex = foundIndex;
            }
          }
          
          // Преобразуем индекс в X координату
          const expirationRelative = (expirationExactIndex - viewportWithPrices.fromIndex) / viewportWithPrices.candlesPerScreen;
          lineEndX = expirationRelative * rect.width;
          // Ограничиваем линию границами графика
          lineEndX = Math.max(labelX + labelWidth + offsetFromLabel, Math.min(rect.width, lineEndX));
        }
        
        // Позиция начала линии (справа от метки)
        const lineStartX = labelX + labelWidth + offsetFromLabel;
        
        // Рисуем горизонтальную линию от метки до времени окончания ставки
        ctx.strokeStyle = markerColorLight;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(lineStartX, labelY);
        ctx.lineTo(lineEndX, labelY);
        ctx.stroke();
        
        // Вычисляем прогресс для крутилки (оставшееся время до окончания ставки)
        let progress = 1; // По умолчанию 100%
        if (marker.expirationTime && marker.expirationTime > currentTime) {
          const totalTime = marker.expirationTime - marker.time;
          const elapsedTime = currentTime - marker.time;
          progress = Math.max(0, Math.min(1, 1 - (elapsedTime / totalTime)));
        } else if (marker.expirationTime && marker.expirationTime <= currentTime) {
          progress = 0; // Время истекло
        }
        
        // Позиция круглого handle в конце линии (в месте времени окончания)
        const handleX = lineEndX;
        const handleY = labelY;
        
        // Рисуем круглый handle в конце линии
        ctx.fillStyle = markerColorLight;
        ctx.beginPath();
        ctx.arc(handleX, handleY, handleSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Рисуем прогресс-бар (крутилку) по краю кружка
        if (marker.expirationTime) {
          const progressBarWidth = 2; // Толщина прогресс-бара (уменьшена для маленького кружка)
          const progressAngle = progress * Math.PI * 2; // Угол прогресса
          
          // Рисуем фоновую дугу (серая, показывает полный круг)
          ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)'; // Светло-серый цвет для фона
          ctx.lineWidth = progressBarWidth;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(handleX, handleY, handleSize - progressBarWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
          
          // Рисуем прогресс-бар (белый, показывает оставшееся время)
          ctx.strokeStyle = '#ffffff'; // Белый цвет для прогресс-бара
          ctx.lineWidth = progressBarWidth;
          ctx.lineCap = 'round';
          ctx.beginPath();
          // Рисуем дугу от 0 до progressAngle (начинаем сверху, идем по часовой стрелке)
          ctx.arc(handleX, handleY, handleSize - progressBarWidth / 2, -Math.PI / 2, -Math.PI / 2 + progressAngle);
          ctx.stroke();
        }
        
        // Обводка handle
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(handleX, handleY, handleSize, 0, Math.PI * 2);
        ctx.stroke();
        
        // Рисуем подпись времени на оси (внизу) - показываем оставшееся время или время ставки
        const axisY = chartAreaHeight + 5;
        const axisTimeStr = timeStr; // Используем то же время, что и в метке
        ctx.fillStyle = marker.direction === 'buy' ? 'rgba(50, 172, 65, 0.8)' : 'rgba(247, 82, 95, 0.8)';
        ctx.font = '8px monospace';
        ctx.textBaseline = 'top';
        const axisTimeMetrics = ctx.measureText(axisTimeStr);
        const axisBgX = markerX - axisTimeMetrics.width / 2 - 4;
        const axisBgY = axisY;
        const axisBgWidth = axisTimeMetrics.width + 8;
        const axisBgHeight = 14;
        
        ctx.fillRect(axisBgX, axisBgY, axisBgWidth, axisBgHeight);
        ctx.fillStyle = '#fff';
        ctx.fillText(axisTimeStr, markerX, axisY + 2);
        
        // Визуализация области наведения (для отладки)
        const labelClickPadding = 5;
        const handleClickRadius = handleSize + 10;
        
        // Рисуем область наведения для метки (Label)
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'; // Желтый полупрозрачный
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          labelX - labelClickPadding,
          labelRectY - labelClickPadding,
          labelWidth + labelClickPadding * 2,
          labelHeight + labelClickPadding * 2
        );
        
        // Рисуем область наведения для handle (кружка)
        ctx.beginPath();
        ctx.arc(handleX, handleY, handleClickRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Логируем область наведения для маркера
        console.log(`[CandlesCanvas] 🎯 Marker ${marker.id} hover area:`, {
          markerId: marker.id,
          '📍 Marker position': { x: markerX, y: markerY },
          '📦 Label hover area': {
            x: labelX - labelClickPadding,
            y: labelRectY - labelClickPadding,
            width: labelWidth + labelClickPadding * 2,
            height: labelHeight + labelClickPadding * 2,
            bounds: {
              minX: labelX - labelClickPadding,
              maxX: labelX + labelWidth + labelClickPadding,
              minY: labelRectY - labelClickPadding,
              maxY: labelRectY + labelHeight + labelClickPadding
            }
          },
          '🎯 Handle hover area': {
            x: handleX,
            y: handleY,
            radius: handleClickRadius,
            bounds: {
              minX: handleX - handleClickRadius,
              maxX: handleX + handleClickRadius,
              minY: handleY - handleClickRadius,
              maxY: handleY + handleClickRadius
            }
          },
          '📏 Line hover area': {
            startX: lineStartX,
            endX: lineEndX,
            y: labelY,
            tolerance: 8
          }
        });
      });
      
      ctx.restore();
    }
  }, [timeframe, convertCandles, hoverIndex, hoverCandle, hoverX, hoverY, hoveredButton, savedDrawings, selectedDrawingIds, checkDrawingModeActive, drawingMode, betMarkers, formatRemainingTime, markerUpdateTrigger, selectionBox, activeIndicators, chartView]);
  
  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current === null && renderCandlesRef.current) {
      renderFrameRef.current = requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
        renderFrameRef.current = null;
      });
    }
  }, []);
  
  // Вызываем перерисовку при изменении betMarkers
  useEffect(() => {
    if (renderCandlesRef.current && animatedCandlesRef.current.length > 0) {
      requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
      });
    }
  }, [betMarkers, currencyPair, timeframe, tradingMode]);
  
  // ВАЖНО: Перерисовка при изменении валютной пары, таймфрейма или режима торговли
  // Это гарантирует, что маркеры будут отрисованы даже если свечи не изменились
  useEffect(() => {
    // Вызываем перерисовку, если есть свечи для отрисовки
    if (animatedCandlesRef.current.length > 0 && renderCandlesRef.current) {
      requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
      });
    }
  }, [currencyPair, timeframe, tradingMode]);

  // Перерисовка при изменении активных индикаторов
  useEffect(() => {
    if (animatedCandlesRef.current.length > 0 && renderCandlesRef.current) {
      requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
      });
    }
  }, [activeIndicators]);

  // Перерисовка при изменении типа графика (chartView)
  useEffect(() => {
    // Используем scheduleRender для немедленной перерисовки
    scheduleRender();
  }, [chartView, scheduleRender]);

  // Сохраняем ссылку на renderCandles
  useEffect(() => {
    renderCandlesRef.current = renderCandles;
    
    // ВАЖНО: Если есть свечи для отображения, вызываем рендеринг сразу после установки renderCandlesRef
    // Это гарантирует, что график отобразится даже если useEffect для candles еще не сработал
    if (animatedCandlesRef.current.length > 0 && renderCandlesRef.current) {
      requestAnimationFrame(() => {
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
      });
    }
  }, [renderCandles]);

  // Обновляем маркеры каждую секунду для отображения оставшегося времени
  useEffect(() => {
    // Проверяем, есть ли маркеры с expirationTime
    const hasActiveMarkers = betMarkers.some(m => m.expirationTime && m.expirationTime > getServerTime());
    
    if (!hasActiveMarkers) {
      return; // Нет активных маркеров, не запускаем таймер
    }
    
    const intervalId = setInterval(() => {
      setMarkerUpdateTrigger(prev => prev + 1);
      // Вызываем перерисовку
      if (renderCandlesRef.current) {
        requestAnimationFrame(() => {
          if (renderCandlesRef.current) {
            renderCandlesRef.current();
          }
        });
      }
    }, 1000); // Обновляем каждую секунду
    
    return () => clearInterval(intervalId);
  }, [betMarkers]);

  // Анимация индикатора загрузки на маркерах (обновляется чаще для плавности)
  useEffect(() => {
    // Проверяем, есть ли маркеры с expirationTime
    const hasActiveMarkers = betMarkers.some(m => m.expirationTime && m.expirationTime > getServerTime());
    
    if (!hasActiveMarkers) {
      return; // Нет активных маркеров, не запускаем анимацию
    }
    
    let animationFrameId: number;
    
    const animate = () => {
      // Вызываем перерисовку для обновления анимации индикатора загрузки
      if (renderCandlesRef.current) {
        renderCandlesRef.current();
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [betMarkers]);

  // Easing функция для очень плавной анимации (ease-out exponential)
  const easeOutExpo = useCallback((t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }, []);

  const animateCandle = useCallback(() => {
    if (!animationStateRef.current) {
      animationFrameRef.current = null;
      return;
    }

    const state = animationStateRef.current;
    
    // Проверяем, что свеча все еще существует
    if (state.candleIndex < 0 || state.candleIndex >= animatedCandlesRef.current.length) {
      animationStateRef.current = null;
      animationFrameRef.current = null;
      return;
    }

    const currentTime = performance.now();
    const elapsed = currentTime - state.startTime;
    const progress = Math.min(elapsed / state.duration, 1);

    // Используем очень плавную easing функцию
    const easedProgress = easeOutExpo(progress);

    // Интерполируем значения с использованием easing
    const closeDiff = state.targetClose - state.startClose;
    const highDiff = state.targetHigh - state.startHigh;
    const lowDiff = state.targetLow - state.startLow;

    state.currentClose = state.startClose + closeDiff * easedProgress;
    state.currentHigh = state.startHigh + highDiff * easedProgress;
    state.currentLow = state.startLow + lowDiff * easedProgress;

    // Проверяем завершение анимации
    if (progress >= 1) {
      // Анимация завершена - обновляем все значения включая high и low
      const updated = [...animatedCandlesRef.current];
      if (state.candleIndex >= 0 && state.candleIndex < updated.length) {
        updated[state.candleIndex] = {
          ...updated[state.candleIndex],
          c: state.targetClose,
          h: state.targetHigh,
          l: state.targetLow,
        };
      }
      // Обновляем refs синхронно
      animatedCandlesRef.current = updated;
      prevCandlesRef.current = updated;
      setAnimatedCandles(updated);
      
      // ВАЖНО: Вызываем renderCandles для финальной перерисовки с целевыми значениями
      if (renderCandlesRef.current) {
        renderCandlesRef.current();
      }
      
      // Вызываем onCandleUpdate при завершении анимации
      if (onCandleUpdate && updated[state.candleIndex]) {
        onCandleUpdate(updated[state.candleIndex]);
      }
      animationStateRef.current = null;
      animationFrameRef.current = null;
      return;
    }

    // Обновляем свечу и состояние для перерисовки
    const updated = [...animatedCandlesRef.current];
    if (state.candleIndex >= 0 && state.candleIndex < updated.length) {
      // Обновляем high и low динамически во время анимации для плавности
      const currentCandle = updated[state.candleIndex];
      const newHigh = Math.max(currentCandle.h, state.currentHigh);
      const newLow = Math.min(currentCandle.l, state.currentLow);
      
      updated[state.candleIndex] = {
        ...updated[state.candleIndex],
        c: state.currentClose,
        h: newHigh,
        l: newLow,
      };
      animatedCandlesRef.current = updated;
      
      // ВАЖНО: Обновляем состояние для перерисовки React компонента
      // Это гарантирует, что свеча будет перерисована с новыми значениями
      setAnimatedCandles(updated);
      
      // ВАЖНО: Вызываем renderCandles напрямую для немедленной перерисовки каждого кадра
      // Это гарантирует плавную анимацию линии цены вместе со свечой
      if (renderCandlesRef.current) {
        renderCandlesRef.current();
      }
      
      // Вызываем onCandleUpdate с ограничением частоты
      const now = Date.now();
      if (onCandleUpdate && updated[state.candleIndex] && 
          (now - lastOnCandleUpdateTimeRef.current) >= ON_CANDLE_UPDATE_THROTTLE_MS) {
        onCandleUpdate(updated[state.candleIndex]);
        lastOnCandleUpdateTimeRef.current = now;
      }
    }

    animationFrameRef.current = requestAnimationFrame(animateCandle);
  }, [easeOutExpo, onCandleUpdate]);

  // Обновляем анимированные свечи при изменении исходных свечей
  useEffect(() => {
    // Если свечей нет - полностью очищаем состояние
    if (candles.length === 0) {
      // Очищаем все состояние при пустом массиве свечей
      setAnimatedCandles([]);
      animatedCandlesRef.current = [];
      prevCandlesRef.current = [];
      // Останавливаем анимацию
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStateRef.current = null;
      // Сбрасываем viewport
      viewportRef.current = null;
      setViewport(null);
      // Сбрасываем hover состояние
      setHoverIndex(null);
      setHoverCandle(null);
      setHoverX(null);
      setHoverY(null);
      return;
    }

    // Проверяем, это первая загрузка (после монтирования или после очистки)
    const isFirstLoad = prevCandlesRef.current.length === 0;
    
    // Проверяем, изменилась ли валюта
    // Смена валюты определяется как ситуация, когда:
    // 1. Количество свечей уменьшилось или незначительно изменилось (не добавление старых свечей)
    // 2. И последняя (самая новая) свеча изменилась на значительную величину (больше чем один интервал свечи)
    const prevLastCandleTime = prevCandlesRef.current[prevCandlesRef.current.length - 1]?.x;
    const currentLastCandleTime = candles[candles.length - 1]?.x;
    const prevCount = prevCandlesRef.current.length;
    const currentCount = candles.length;
    
    // Вычисляем интервал свечей (разница между последними двумя свечами)
    const getCandleInterval = (candlesArray: typeof candles) => {
      if (candlesArray.length < 2) return 0;
      return candlesArray[candlesArray.length - 1].x - candlesArray[candlesArray.length - 2].x;
    };
    const candleInterval = getCandleInterval(candles);
    const timeDiff = prevLastCandleTime && currentLastCandleTime 
      ? Math.abs(currentLastCandleTime - prevLastCandleTime) 
      : 0;
    
    // Если количество свечей значительно увеличилось (больше чем на 50), это добавление старых свечей, а не смена валюты
    const isAddingOldCandles = currentCount > prevCount && (currentCount - prevCount) > 50;
    
    // Смена валюты происходит, если последняя свеча изменилась значительно (больше чем один интервал),
    // И это не добавление старых свечей
    const isCurrencyChanged = !isFirstLoad && 
                              candles.length > 0 && 
                              prevCandlesRef.current.length > 0 &&
                              !isAddingOldCandles &&
                              prevLastCandleTime !== undefined &&
                              currentLastCandleTime !== undefined &&
                              timeDiff > (candleInterval * 1.5); // Изменение больше чем на 1.5 интервала


    // Если это первая загрузка или сменилась валюта - полный сброс и установка новых данных
    if (isFirstLoad || isCurrencyChanged) {
      console.log('[CandlesCanvas] 🔄 Полный сброс и установка новых данных', {
        isFirstLoad,
        isCurrencyChanged,
      });
      // Останавливаем текущую анимацию
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // ВАЖНО: полностью сбрасываем состояние анимации
      animationStateRef.current = null;
      // Сбрасываем viewport
      viewportRef.current = null;
      setViewport(null);
      // Сбрасываем hover состояние
      setHoverIndex(null);
      setHoverCandle(null);
      setHoverX(null);
      setHoverY(null);
      // Сбрасываем флаг взаимодействия пользователя
      userInteractedRef.current = false;
      
      // Устанавливаем новые свечи
      setAnimatedCandles(candles);
      animatedCandlesRef.current = candles;
      prevCandlesRef.current = candles;
      
      // ВАЖНО: Явно вызываем рендеринг после установки свечей
      // Это гарантирует, что график отобразится даже если useEffect для animatedCandles еще не сработал
      if (renderCandlesRef.current) {
        console.log('[CandlesCanvas] 🎨 Запрос перерисовки после установки новых свечей');
        // Используем requestAnimationFrame для гарантии, что canvas готов
        requestAnimationFrame(() => {
          try {
            if (renderCandlesRef.current) {
              console.log('[CandlesCanvas] 🎨 Выполнение перерисовки после установки новых свечей');
              renderCandlesRef.current();
              console.log('[CandlesCanvas] ✅ Перерисовка после установки новых свечей выполнена');
            }
          } catch (error) {
            console.error('[CandlesCanvas] ❌ Ошибка при отрисовке', error);
          }
        });
      } else {
        console.warn('[CandlesCanvas] ⚠️ renderCandlesRef.current недоступен после установки новых свечей');
      }
      return;
    }
    
    // Проверяем, нужно ли скорректировать viewport после добавления старых свечей
    const pendingAdjustment = pendingViewportAdjustmentRef.current;
    if (pendingAdjustment !== null && candles.length > prevCandlesRef.current.length) {
      const addedCount = candles.length - prevCandlesRef.current.length;
      if (addedCount > 0) {
        // Корректируем viewport: добавляем количество новых свечей к fromIndex
        // Это сохраняет видимую область экрана на месте, новые свечи появляются слева
        const currentViewport = viewportRef.current;
        if (currentViewport) {
          const adjustedViewport = {
            ...currentViewport,
            fromIndex: currentViewport.fromIndex + addedCount,
            toIndex: currentViewport.toIndex + addedCount,
            centerIndex: currentViewport.centerIndex + addedCount,
          };
          
          viewportRef.current = adjustedViewport;
          setViewport(adjustedViewport);
          
          console.log('[CandlesCanvas] Viewport скорректирован после добавления свечей:', {
            oldFromIndex: currentViewport.fromIndex,
            newFromIndex: adjustedViewport.fromIndex,
            addedCandles: addedCount
          });
        }
        pendingViewportAdjustmentRef.current = null; // Сбрасываем ожидание
      }
    }
    
    // Если количество свечей увеличилось (добавилась новая свеча)
    if (candles.length > prevCandlesRef.current.length) {
      setAnimatedCandles(candles);
      animatedCandlesRef.current = candles;
      prevCandlesRef.current = candles;
      
      // Reset viewport to follow latest candle if user hasn't interacted
      if (!userInteractedRef.current) {
        viewportRef.current = null;
        setViewport(null);
      }
      
      // ВАЖНО: Явно вызываем рендеринг после добавления новой свечи
      if (renderCandlesRef.current) {
        requestAnimationFrame(() => {
          if (renderCandlesRef.current) {
            renderCandlesRef.current();
          }
        });
      }
      return;
    }

    // Если количество свечей не изменилось, обновляем последнюю свечу с анимацией
    const lastCandle = candles[candles.length - 1];
    const prevLastCandle = prevCandlesRef.current[prevCandlesRef.current.length - 1];

    if (lastCandle && prevLastCandle && lastCandle.x === prevLastCandle.x) {
      // Это обновление последней свечи - запускаем анимацию
      const candleIndex = candles.length - 1;
      const THRESHOLD = 1e-12; // Очень маленький порог - анимируем почти все изменения
      const closeDiff = Math.abs(lastCandle.c - prevLastCandle.c);
      const priceScale = Math.max(1e-12, Math.abs(lastCandle.c || 1));
      const relCloseDiff = closeDiff / priceScale;

      // ВСЕГДА запускаем анимацию для любых изменений цены
      // Анимируем только если изменение действительно нулевое (с учетом погрешности вычислений)
      if (relCloseDiff < 1e-15 && closeDiff < 1e-12) {
        // Изменение действительно нулевое (погрешность вычислений) - применяем сразу
        setAnimatedCandles(candles);
        animatedCandlesRef.current = candles;
        prevCandlesRef.current = candles;
        return;
      }

      // Проверяем, идет ли уже анимация для этой свечи
      const isAnimationActive = animationStateRef.current !== null && 
                                 animationStateRef.current.candleIndex === candleIndex;

      // Если анимация уже идет, перезапускаем с текущих значений для плавного перехода
      if (isAnimationActive && animatedCandlesRef.current.length > candleIndex) {
        // Используем текущее анимированное значение из ref (синхронный доступ)
        const currentAnimatedCandle = animatedCandlesRef.current[candleIndex];
        const currentClose = currentAnimatedCandle.c;
        const currentHigh = currentAnimatedCandle.h;
        const currentLow = currentAnimatedCandle.l;
        
        // Проверяем, есть ли реальное изменение цены
        const priceChange = Math.abs(lastCandle.c - currentClose);
        const priceScale = Math.max(1e-12, Math.abs(currentClose || 1));
        const relativeChange = priceChange / priceScale;
        
        // Если изменение слишком мало (меньше порога), не перезапускаем анимацию
        const MIN_PRICE_CHANGE_THRESHOLD = 1e-6; // Минимальное изменение для перезапуска анимации
        if (priceChange < MIN_PRICE_CHANGE_THRESHOLD && relativeChange < 1e-8) {
          // Цена практически не изменилась - не перезапускаем анимацию
          return;
        }
        
        // Перезапускаем анимацию с текущих значений для плавного перехода
        animationStateRef.current.startClose = currentClose;
        animationStateRef.current.currentClose = currentClose;
        animationStateRef.current.targetClose = lastCandle.c;
        animationStateRef.current.startHigh = currentHigh;
        animationStateRef.current.currentHigh = currentHigh;
        animationStateRef.current.targetHigh = lastCandle.h;
        animationStateRef.current.startLow = currentLow;
        animationStateRef.current.currentLow = currentLow;
        animationStateRef.current.targetLow = lastCandle.l;
        animationStateRef.current.startTime = performance.now();
        // Используем адаптивную длительность: больше для больших изменений
        // Длительность от 600мс до 2500мс в зависимости от изменения для более плавной анимации
        // Минимум 600мс гарантирует заметную плавность даже для малых изменений
        // Максимум 2500мс обеспечивает очень плавную анимацию больших изменений
        // При быстрых изменениях анимация будет плавно перезапускаться к новым целям
        const duration = Math.min(2500, Math.max(600, relativeChange * 12000));
        animationStateRef.current.duration = duration;
        
        // Обновляем high и low сразу, если они уже достигнуты текущей ценой
        const updatedCandles = [...animatedCandlesRef.current];
        const newHigh = Math.max(currentHigh, lastCandle.h);
        const newLow = Math.min(currentLow, lastCandle.l);
        
        updatedCandles[candleIndex] = {
          ...updatedCandles[candleIndex],
          h: newHigh,
          l: newLow,
          // c остается текущим анимированным значением
        };
        animatedCandlesRef.current = updatedCandles;
        
        // Убеждаемся, что анимация продолжается - всегда перезапускаем для плавности
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animateCandle);
      } else {
        // Создаем новое состояние анимации
        const startClose = prevLastCandle.c;
        const startHigh = prevLastCandle.h;
        const startLow = prevLastCandle.l;
        
        // Вычисляем адаптивную длительность анимации
        const priceChange = Math.abs(lastCandle.c - startClose);
        const priceScale = Math.max(1e-12, Math.abs(startClose || 1));
        const relativeChange = priceChange / priceScale;
        // Длительность от 600мс до 2500мс в зависимости от изменения для более плавной анимации
        // Минимум 600мс гарантирует заметную плавность даже для малых изменений
        // Максимум 2500мс обеспечивает очень плавную анимацию больших изменений
        // При быстрых изменениях анимация будет плавно перезапускаться к новым целям
        const duration = Math.min(2500, Math.max(600, relativeChange * 12000));
        
        animationStateRef.current = {
          candleIndex,
          startClose,
          targetClose: lastCandle.c,
          currentClose: startClose,
          startHigh,
          targetHigh: lastCandle.h,
          currentHigh: startHigh,
          startLow,
          targetLow: lastCandle.l,
          currentLow: startLow,
          startTime: performance.now(),
          duration,
        };

        // Обновляем high и low сразу, если они уже достигнуты начальной ценой
        // Это позволяет тени показывать реальные экстремумы с самого начала
        const updatedCandles = [...animatedCandlesRef.current];
        if (candleIndex >= 0 && candleIndex < updatedCandles.length) {
          const currentCandle = updatedCandles[candleIndex];
          const newHigh = Math.max(currentCandle.h, lastCandle.h);
          const newLow = Math.min(currentCandle.l, lastCandle.l);
          
          // Получаем open из предыдущей свечи
          const startOpen = prevLastCandle.o;
          
          // Определяем направление движения свечи
          const isFalling = lastCandle.c < startClose; // Свеча падает
          
          // Обновляем high: если цена уже прошла через этот максимум
          const maxPrice = isFalling ? startOpen : startClose;
          const finalHigh = newHigh <= maxPrice ? newHigh : currentCandle.h;
          
          // Обновляем low: если цена уже достигла этого минимума
          const minPrice = isFalling ? startClose : startOpen;
          const finalLow = newLow <= minPrice ? newLow : currentCandle.l;
          
          updatedCandles[candleIndex] = {
            ...updatedCandles[candleIndex],
            h: finalHigh,
            l: finalLow,
            c: startClose,
          };
        }
        setAnimatedCandles(updatedCandles);
        animatedCandlesRef.current = updatedCandles;

        // Вызываем onCandleUpdate для синхронизации с родительским компонентом
        if (onCandleUpdate && updatedCandles[candleIndex]) {
          onCandleUpdate(updatedCandles[candleIndex]);
        }

        // Запускаем анимацию
        if (animationFrameRef.current === null) {
          animationFrameRef.current = requestAnimationFrame(animateCandle);
        }
      }
    } else {
      // Новая свеча или другие изменения - применяем сразу
      // Останавливаем анимацию, если она была
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStateRef.current = null;
      setAnimatedCandles(candles);
      animatedCandlesRef.current = candles;
      prevCandlesRef.current = candles;
    }
  }, [candles, animateCandle]);

  // Вспомогательная функция для вычисления viewportWithPrices из currentViewport
  const calculateViewportWithPrices = useCallback((currentViewport: ViewportState, chartCandles: ChartCandle[], debugContext?: string): ViewportState | null => {
    if (chartCandles.length === 0) return null;
    
    // Вычисляем minPrice и maxPrice из видимых свечей (та же логика, что в renderCandles)
    const fromIdx = Math.max(0, Math.floor(currentViewport.fromIndex));
    const toIdx = Math.min(chartCandles.length - 1, Math.ceil(currentViewport.toIndex));
    const visibleCandles = chartCandles.slice(fromIdx, toIdx + 1);
    if (visibleCandles.length === 0) return null;
    
    // Собираем цены ТОЛЬКО из видимых свечей
    // Это гарантирует, что диапазон цен адаптируется к видимой области при панорамировании
    const prices = visibleCandles.flatMap(c => [c.high, c.low]);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    // Убираем padding, чтобы свечи растягивались на всю доступную высоту
    // Используем минимальный padding только для предотвращения деления на ноль
    const padding = priceRange > 0 ? 0 : Math.max(minPrice * 0.0001, 0.0001);
    
    // ВАЖНО: Включаем цены маркеров ставок в диапазон, чтобы они всегда были видны
    const finalMinPrice = minPrice - padding;
    const finalMaxPrice = maxPrice + padding;
    
    // Примечание: betMarkers не доступны в этом контексте, но это нормально,
    // так как маркеры учитываются в renderCandles отдельно
    
    const result = {
      centerIndex: currentViewport.centerIndex,
      fromIndex: currentViewport.fromIndex,
      toIndex: currentViewport.toIndex,
      candlesPerScreen: currentViewport.candlesPerScreen,
      minPrice: finalMinPrice,
      maxPrice: finalMaxPrice,
    };
    
    // Логируем только при сохранении или отрисовке рисунков
    if (debugContext && (debugContext.includes('save') || debugContext.includes('render'))) {
      console.log(`[CandlesCanvas] calculateViewportWithPrices (${debugContext})`, {
        fromIdx,
        toIdx,
        visibleCandlesCount: visibleCandles.length,
        rawMinPrice: minPrice,
        rawMaxPrice: maxPrice,
        priceRange,
        padding: padding.toFixed(10), // Высокая точность для выявления проблем с округлением
        paddingPercent: (priceRange > 0 ? (padding / priceRange * 100).toFixed(2) : 'N/A') + '%',
        calculatedMinPrice: result.minPrice,
        calculatedMaxPrice: result.maxPrice,
        viewport: {
          fromIndex: currentViewport.fromIndex,
          toIndex: currentViewport.toIndex,
          candlesPerScreen: currentViewport.candlesPerScreen
        }
      });
    }
    
    return result;
  }, []);

  // Handle document mouse events for panning
  useEffect(() => {
    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      // ВАЖНО: Проверяем режим рисования через DOM, так как drawingMode может быть не в пропсах
      // Проверяем, активен ли режим рисования
      const drawingCheck = checkDrawingModeActive();
      
      if (drawingCheck.isActive) {
        isDraggingRef.current = false;
        lastDragXRef.current = 0;
        return;
      }
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = e.clientX - lastDragXRef.current;
      lastDragXRef.current = e.clientX;
      
      const currentViewport = viewportRef.current;
      if (currentViewport) {
        const chartCandles = convertCandles(animatedCandlesRef.current);
        const newViewport = panViewport(
          currentViewport,
          deltaX,
          rect.width,
          chartCandles.length,
          panZoomConfig
        );
        const clampedViewport = clampViewport(newViewport, chartCandles.length, panZoomConfig);
        viewportRef.current = clampedViewport;
        setViewport(clampedViewport);
        scheduleRender();
      }
    };

    const handleDocumentMouseUp = () => {
      // Завершаем перемещение рисунка
      if (isMovingDrawingRef.current) {
        isMovingDrawingRef.current = false;
        moveOffsetRef.current = null;
        scheduleRender();
      }
      
      // Завершаем рисование, если оно было активно
      if (isDrawingRef.current && drawingStartPointRef.current && drawingCurrentPointRef.current && currentDrawingModeRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) {
          return;
        }
        
        const rect = container.getBoundingClientRect();
        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length === 0) {
          return;
        }
        
        const chartCandles = convertCandles(candlesToRender);
        const currentViewport = viewportRef.current;
        if (!currentViewport) {
          return;
        }
        
        // Вычисляем viewportWithPrices с правильными minPrice и maxPrice
        const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles, 'handleDocumentMouseUp-save');
        if (!viewportWithPrices) {
          return;
        }
        
        const startPixel = drawingStartPointRef.current;
        const endPixel = drawingCurrentPointRef.current;
        let path = drawingPathRef.current;
        const currentDrawingMode = currentDrawingModeRef.current;
        
        // Сглаживаем путь для freehand
        if (currentDrawingMode === 'freehand' && path.length > 2) {
          path = smoothPath(path);
        }
        
        // Преобразуем пиксели в время/цену
        // Координаты в startPixel и endPixel уже скорректированы (y - topPadding), поэтому добавляем topPadding обратно
        const startTimePrice = pixelToTimePrice(startPixel.x, startPixel.y + topPadding, viewportWithPrices, chartCandles, rect);
        const endTimePrice = pixelToTimePrice(endPixel.x, endPixel.y + topPadding, viewportWithPrices, chartCandles, rect);
        
        if (!startTimePrice || !endTimePrice) {
          // Если не удалось преобразовать координаты, сбрасываем состояние и выходим
          isDrawingRef.current = false;
          drawingStartPointRef.current = null;
          drawingCurrentPointRef.current = null;
          drawingPathRef.current = [];
          currentDrawingModeRef.current = null;
          return;
        }
        
        // Для простого клика (без перетаскивания) используем те же координаты для start и end
        // Это позволит сохранить рисунок даже при минимальном движении
        const finalStartTimePrice = startTimePrice;
        const finalEndTimePrice = endTimePrice;
        
        // Преобразуем path для freehand
        const pathTimePrice = path.map((p) => {
          const timePrice = pixelToTimePrice(p.x, p.y + topPadding, viewportWithPrices, chartCandles, rect);
          return timePrice || { time: finalStartTimePrice.time, price: finalStartTimePrice.price };
        });
        
        // Сохраняем нарисованную линию с координатами времени/цены
        const newDrawing: SavedDrawing = {
          id: `drawing-${Date.now()}-${Math.random()}`,
          type: currentDrawingMode,
          startPoint: finalStartTimePrice,
          endPoint: finalEndTimePrice,
          path: pathTimePrice,
          color: '#ffa500',
        };
        
        setSavedDrawings(prev => [...prev, newDrawing]);
        
        // Сбрасываем флаг логирования
        if (typeof window !== 'undefined') {
          (window as any).__isDrawingActive = false;
        }
        
        // Сбрасываем состояние
        isDrawingRef.current = false;
        drawingStartPointRef.current = null;
        drawingCurrentPointRef.current = null;
        drawingPathRef.current = [];
        currentDrawingModeRef.current = null;
        scheduleRender();
      }
      
      isDraggingRef.current = false;
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = 'crosshair';
      }
    };

    // Всегда добавляем обработчик mouseup на document для сохранения рисунков
    // даже если пользователь отпустит кнопку мыши вне canvas
    document.addEventListener('mouseup', handleDocumentMouseUp);
    
    if (isDraggingRef.current) {
      document.addEventListener('mousemove', handleDocumentMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [convertCandles, scheduleRender, checkDrawingModeActive, smoothPath, calculateViewportWithPrices]);

  // Рендерим при изменении анимированных свечей
  useEffect(() => {
    scheduleRender();
  }, [animatedCandles, scheduleRender]);

  // Рендерим при изменении viewport (zoom/pan)
  useEffect(() => {
    if (viewport) {
      scheduleRender();
    }
  }, [viewport, scheduleRender]);
  
  // Рендерим при изменении сохраненных рисунков
  useEffect(() => {
    scheduleRender();
  }, [savedDrawings, scheduleRender]);
  
  // Рендерим при изменении выделенных рисунков
  useEffect(() => {
    scheduleRender();
  }, [selectedDrawingIds, scheduleRender]);
  
  // Обработчик клавиши Delete для удаления выделенных рисунков
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Проверяем, что нажата клавиша Delete или Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingIds.size > 0) {
        // Предотвращаем стандартное поведение (например, возврат назад в браузере)
        e.preventDefault();
        e.stopPropagation();
        
        // Проверяем, что фокус не на поле ввода
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        // Удаляем только если фокус не на поле ввода
        if (!isInputFocused) {
          setSavedDrawings(prev => prev.filter(d => !selectedDrawingIds.has(d.id)));
          setSelectedDrawingIds(new Set());
          scheduleRender();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDrawingIds, scheduleRender]);

  // Постоянная анимация для плавного движения линии времени
  useEffect(() => {
    const animate = () => {
      // Останавливаем анимацию если вкладка скрыта
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        timeLineAnimationRafId.current = null;
        return;
      }
      
      // Плавно обновляем линию времени каждый кадр (60 FPS)
      // Вызываем рендер напрямую, минуя scheduleRender для максимальной плавности
      if (renderCandlesRef.current) {
        renderCandlesRef.current();
      }
      
      timeLineAnimationRafId.current = requestAnimationFrame(animate);
    };
    
    timeLineAnimationRafId.current = requestAnimationFrame(animate);
    
    return () => {
      if (timeLineAnimationRafId.current !== null) {
        cancelAnimationFrame(timeLineAnimationRafId.current);
        timeLineAnimationRafId.current = null;
      }
    };
  }, []);

  // Reset viewport when timeframe changes
  useEffect(() => {
    viewportRef.current = null;
    setViewport(null);
    userInteractedRef.current = false;
  }, [timeframe]);
  
  // Экспортируем методы через useImperativeHandle
  // ВАЖНО: Добавляем зависимости, чтобы функции имели доступ к актуальным значениям
  useImperativeHandle(ref, () => ({
    getAnimatedPrice: () => {
      // Получаем цену из последней анимированной свечи
      const lastCandle = animatedCandlesRef.current[animatedCandlesRef.current.length - 1];
      if (lastCandle && lastCandle.c && lastCandle.c > 0 && Number.isFinite(lastCandle.c)) {
        return lastCandle.c;
      }
      // Fallback: используем сохраненную цену из ref
      if (animatedPriceRef.current && animatedPriceRef.current > 0 && Number.isFinite(animatedPriceRef.current)) {
        return animatedPriceRef.current;
      }
      return null;
    },
    addBetMarker: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => {
      const isDemoMode = tradingMode === 'demo';
      const newMarker: BetMarker = {
        id: `bet-marker-${Date.now()}-${Math.random()}`,
        time,
        price, // Цена входа (для позиционирования на графике)
        amount, // Сумма ставки (для отображения на метке)
        direction,
        createdAt: getServerTime(),
        expirationTime,
        tradeId,
        isDemo: isDemoMode,
      };
      
      setBetMarkers(prev => {
        // Если маркер с таким tradeId уже существует, удаляем его перед добавлением нового
        const filtered = tradeId ? prev.filter(m => m.tradeId !== tradeId) : prev;
        const updated = [...filtered, newMarker];
        
        // Принудительно вызываем перерисовку
        if (renderCandlesRef.current) {
          requestAnimationFrame(() => {
            if (renderCandlesRef.current) {
              renderCandlesRef.current();
            }
          });
        }
        
        return updated;
      });
    },
    removeBetMarkerByTradeId: (tradeId: string) => {
      setBetMarkers(prev => {
        const updated = prev.filter(m => m.tradeId !== tradeId);
        
        // Принудительно вызываем перерисовку
        if (renderCandlesRef.current) {
          requestAnimationFrame(() => {
            if (renderCandlesRef.current) {
              renderCandlesRef.current();
            }
          });
        }
        
        return updated;
      });
    },
    openMarkerByTradeId: (tradeId: string) => {
      const marker = betMarkers.find(m => m.tradeId === tradeId);
      if (marker) {
        setSelectedMarker(marker);
        setIsMarkerSidebarOpen(true);
      }
    },
  }), [tradingMode]);

  // Автоматическое удаление маркеров с истекшим временем
  useEffect(() => {
    const checkExpiredMarkers = () => {
      const currentTime = getServerTime();
      setBetMarkers(prev => {
        const expiredMarkers = prev.filter(m => 
          m.expirationTime && m.expirationTime <= currentTime
        );
        
        if (expiredMarkers.length > 0) {
          console.log('[CandlesCanvas] Удаление истекших маркеров', {
            expiredCount: expiredMarkers.length,
            expiredMarkers: expiredMarkers.map(m => ({ tradeId: m.tradeId, expirationTime: m.expirationTime, currentTime }))
          });
          
          const updated = prev.filter(m => 
            !m.expirationTime || m.expirationTime > currentTime
          );
          
          // Принудительно вызываем перерисовку
          if (renderCandlesRef.current) {
            requestAnimationFrame(() => {
              if (renderCandlesRef.current) {
                renderCandlesRef.current();
              }
            });
          }
          
          return updated;
        }
        
        return prev;
      });
    };

    // Проверяем каждую секунду
    const interval = setInterval(checkExpiredMarkers, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Функции для преобразования координат
  const pixelToTimePrice = useCallback((pixelX: number, pixelY: number, viewport: ViewportState, chartCandles: ChartCandle[], rect: DOMRect): { time: number; price: number } | null => {
    if (chartCandles.length === 0) return null;
    
    // Преобразуем X (пиксель -> индекс -> время)
    // Используем точный индекс (без округления) для интерполяции времени между свечами
    const relative = pixelX / rect.width;
    const exactIndex = viewport.fromIndex + relative * viewport.candlesPerScreen;
    const clampedIndex = Math.max(0, Math.min(chartCandles.length - 1, exactIndex));
    
    // Вычисляем точное время через интерполяцию между свечами
    let time: number;
    const floorIndex = Math.floor(clampedIndex);
    const ceilIndex = Math.min(chartCandles.length - 1, Math.ceil(clampedIndex));
    
    if (floorIndex === ceilIndex) {
      // Если индекс точно совпадает с индексом свечи
      time = chartCandles[floorIndex].openTime;
    } else {
      // Интерполируем время между двумя свечами
      const floorCandle = chartCandles[floorIndex];
      const ceilCandle = chartCandles[ceilIndex];
      const fraction = clampedIndex - floorIndex;
      
      // Вычисляем временной интервал между свечами
      let timeInterval = 0;
      if (chartCandles.length > 1) {
        if (floorIndex < chartCandles.length - 1) {
          timeInterval = chartCandles[floorIndex + 1].openTime - floorCandle.openTime;
        } else if (floorIndex > 0) {
          timeInterval = floorCandle.openTime - chartCandles[floorIndex - 1].openTime;
        } else {
          timeInterval = ceilCandle.openTime - floorCandle.openTime;
        }
      }
      
      // Если временной интервал не может быть определен из соседних свечей, используем разницу между floor и ceil
      if (timeInterval === 0 && ceilIndex > floorIndex) {
        timeInterval = ceilCandle.openTime - floorCandle.openTime;
      }
      
      // Если все еще не можем определить, используем фиксированный интервал (1 минута как fallback)
      if (timeInterval === 0) {
        timeInterval = 60_000; // 1 минута по умолчанию
      }
      
      time = floorCandle.openTime + fraction * timeInterval;
    }
    
    // Преобразуем Y (пиксель -> цена)
    // pixelY уже в координатах относительно всего canvas (с учетом topPadding)
    // Используем ту же высоту области, что и для свечей, с учетом обоих отступов
    const chartAreaHeight = rect.height - ochlBottomPadding - topPadding;
    const adjustedY = pixelY - topPadding;
    const ratio = 1 - (adjustedY / chartAreaHeight);
    const price = viewport.minPrice + ratio * (viewport.maxPrice - viewport.minPrice);
    
    // Логируем только при рисовании (когда есть активный режим рисования)
    if (typeof window !== 'undefined' && (window as any).__isDrawingActive) {
      console.log('[CandlesCanvas] pixelToTimePrice', {
        inputPixelX: pixelX,
        inputPixelY: pixelY,
        rect: { width: rect.width, height: rect.height },
        topPadding,
        ochlBottomPadding,
        chartAreaHeight,
        adjustedY,
        ratio: ratio.toFixed(10), // Высокая точность для выявления проблем с округлением
        minPrice: viewport.minPrice,
        maxPrice: viewport.maxPrice,
        priceRange: viewport.maxPrice - viewport.minPrice,
        outputPrice: price,
        outputTime: time,
        // Проверка обратного преобразования для отладки
        reverseCheck: {
          calculatedRatio: (price - viewport.minPrice) / (viewport.maxPrice - viewport.minPrice),
          calculatedY: (1 - ratio) * chartAreaHeight,
          originalAdjustedY: adjustedY,
          difference: Math.abs((1 - ratio) * chartAreaHeight - adjustedY)
        }
      });
    }
    
    return { time, price };
  }, [topPadding, ochlBottomPadding]);
  
  const timePriceToPixel = useCallback((time: number, price: number, viewport: ViewportState, chartCandles: ChartCandle[], rect: DOMRect, debugId?: string): { x: number; y: number } | null => {
    if (chartCandles.length === 0) {
      return null;
    }
    
    // Проверяем, что viewport имеет валидные значения цены
    if (viewport.minPrice === undefined || viewport.maxPrice === undefined || viewport.maxPrice === viewport.minPrice) {
      return null;
    }
    
    // Вычисляем точный индекс (дробный) на основе времени через интерполяцию
    // Это позволяет точно позиционировать точки между свечами без привязки к сетке
    let exactIndex: number;
    
    // Проверяем граничные случаи
    if (time <= chartCandles[0].openTime) {
      exactIndex = 0;
    } else if (time >= chartCandles[chartCandles.length - 1].openTime) {
      // Для времени после последней свечи вычисляем индекс на основе временного интервала
      const lastCandle = chartCandles[chartCandles.length - 1];
      let timeInterval = 60_000; // По умолчанию 1 минута
      
      if (chartCandles.length > 1) {
        const prevCandle = chartCandles[chartCandles.length - 2];
        timeInterval = lastCandle.openTime - prevCandle.openTime;
      }
      
      if (timeInterval > 0) {
        const timeSinceLastCandle = time - lastCandle.openTime;
        exactIndex = chartCandles.length - 1 + (timeSinceLastCandle / timeInterval);
      } else {
        exactIndex = chartCandles.length - 1;
      }
    } else {
      // Ищем свечу, между которой находится время
      let foundIndex = -1;
      for (let i = 0; i < chartCandles.length - 1; i++) {
        if (time >= chartCandles[i].openTime && time <= chartCandles[i + 1].openTime) {
          foundIndex = i;
          break;
        }
      }
      
      if (foundIndex >= 0) {
        const currCandle = chartCandles[foundIndex];
        const nextCandle = chartCandles[foundIndex + 1];
        const timeInterval = nextCandle.openTime - currCandle.openTime;
        
        if (timeInterval > 0) {
          const fraction = (time - currCandle.openTime) / timeInterval;
          exactIndex = foundIndex + fraction;
        } else {
          exactIndex = foundIndex;
        }
      } else {
        // Fallback: находим ближайшую свечу
        foundIndex = chartCandles.reduce((closest, c, i) => {
          const currentDiff = Math.abs(c.openTime - time);
          const closestDiff = Math.abs(chartCandles[closest].openTime - time);
          return currentDiff < closestDiff ? i : closest;
        }, 0);
        exactIndex = foundIndex;
      }
    }
    
    // Преобразуем точный индекс в X координату (индекс -> пиксель)
    const relative = (exactIndex - viewport.fromIndex) / viewport.candlesPerScreen;
    const x = relative * rect.width;
    
    // Преобразуем цену в Y (цена -> пиксель)
    // Возвращаем координаты относительно области рисования (без topPadding), так как потом применяется translate(0, topPadding)
    // Используем ту же высоту области, что и для свечей, с учетом обоих отступов
    const chartAreaHeight = rect.height - ochlBottomPadding - topPadding;
    const ratio = (price - viewport.minPrice) / (viewport.maxPrice - viewport.minPrice);
    const y = (1 - ratio) * chartAreaHeight;
    
    // Логируем при отрисовке сохранённых рисунков
    if (debugId) {
      console.log('[CandlesCanvas] timePriceToPixel', {
        debugId,
        inputTime: time,
        inputPrice: price,
        rect: { width: rect.width, height: rect.height },
        topPadding,
        ochlBottomPadding,
        chartAreaHeight,
        minPrice: viewport.minPrice,
        maxPrice: viewport.maxPrice,
        priceRange: viewport.maxPrice - viewport.minPrice,
        ratio: ratio.toFixed(10), // Высокая точность для выявления проблем с округлением
        outputPixelX: x,
        outputPixelY: y,
        finalYWithPadding: y + topPadding,
        // Проверка обратного преобразования для отладки
        reverseCheck: {
          calculatedPrice: viewport.minPrice + ratio * (viewport.maxPrice - viewport.minPrice),
          originalPrice: price,
          priceDifference: Math.abs(viewport.minPrice + ratio * (viewport.maxPrice - viewport.minPrice) - price)
        }
      });
    }
    
    // Убираем проверку диапазона - рисунки должны отображаться всегда, даже если они вне видимой области
    // Canvas автоматически обрежет их при отрисовке
    
    return { x, y };
  }, [topPadding, ochlBottomPadding]);
  
  // Вспомогательная функция для вычисления расстояния от точки до отрезка
  const distanceToLineSegment = useCallback((
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Функция для проверки попадания точки на линию (hit testing)
  const isPointOnLine = useCallback((
    point: { x: number; y: number },
    line: SavedDrawing,
    viewport: ViewportState,
    chartCandles: ChartCandle[],
    rect: DOMRect,
    threshold: number = 8 // Увеличиваем threshold для лучшего определения диагональных линий
  ): boolean => {
    // Преобразуем координаты времени/цены линии в пиксели
    const startPixel = timePriceToPixel(line.startPoint.time, line.startPoint.price, viewport, chartCandles, rect);
    const endPixel = timePriceToPixel(line.endPoint.time, line.endPoint.price, viewport, chartCandles, rect);
    
    if (!startPixel || !endPixel) return false;
    
    // Точка уже в координатах области рисования (без topPadding), используем как есть
    const adjustedPoint = { x: point.x, y: point.y };
    
    if (line.type === 'freehand' && line.path.length > 1) {
      // Проверяем расстояние до каждого сегмента пути
      for (let i = 0; i < line.path.length - 1; i++) {
        const p1Pixel = timePriceToPixel(line.path[i].time, line.path[i].price, viewport, chartCandles, rect);
        const p2Pixel = timePriceToPixel(line.path[i + 1].time, line.path[i + 1].price, viewport, chartCandles, rect);
        if (p1Pixel && p2Pixel) {
          const dist = distanceToLineSegment(adjustedPoint, p1Pixel, p2Pixel);
          if (dist <= threshold) return true;
        }
      }
      return false;
    } else {
      // Специальная обработка для вертикальных линий
      const dx = Math.abs(endPixel.x - startPixel.x);
      const dy = Math.abs(endPixel.y - startPixel.y);
      const isVertical = dx < 1; // Линия считается вертикальной, если разница по X меньше 1 пикселя
      const isHorizontal = dy < 1; // Линия считается горизонтальной, если разница по Y меньше 1 пикселя
      
      if (isVertical) {
        // Для вертикальных линий: проверяем, находится ли точка в пределах Y-координат линии
        const minY = Math.min(startPixel.y, endPixel.y);
        const maxY = Math.max(startPixel.y, endPixel.y);
        const avgX = (startPixel.x + endPixel.x) / 2;
        
        // Проверяем, находится ли точка в пределах Y-координат линии и достаточно близко по X
        const withinYRange = adjustedPoint.y >= minY && adjustedPoint.y <= maxY;
        const distanceX = Math.abs(adjustedPoint.x - avgX);
        
        return withinYRange && distanceX <= threshold;
      } else if (isHorizontal) {
        // Для горизонтальных линий: проверяем, находится ли точка в пределах X-координат линии
        const minX = Math.min(startPixel.x, endPixel.x);
        const maxX = Math.max(startPixel.x, endPixel.x);
        const avgY = (startPixel.y + endPixel.y) / 2;
        
        // Проверяем, находится ли точка в пределах X-координат линии и достаточно близко по Y
        const withinXRange = adjustedPoint.x >= minX && adjustedPoint.x <= maxX;
        const distanceY = Math.abs(adjustedPoint.y - avgY);
        
        return withinXRange && distanceY <= threshold;
      } else {
        // Для других типов линий проверяем расстояние до прямой линии
        const dist = distanceToLineSegment(adjustedPoint, startPixel, endPixel);
        
        // Для диагональных линий используем адаптивный threshold на основе угла наклона
        const lineLength = Math.sqrt(
          Math.pow(endPixel.x - startPixel.x, 2) + 
          Math.pow(endPixel.y - startPixel.y, 2)
        );
        
        // Если линия очень короткая, увеличиваем threshold
        if (lineLength > 0 && lineLength < 50) {
          const adaptiveThreshold = Math.max(threshold, 10);
          return dist <= adaptiveThreshold;
        }
        
        return dist <= threshold;
      }
    }
  }, [distanceToLineSegment, timePriceToPixel, topPadding]);

  // Функция для проверки попадания точки в область маркера
  const isPointOnMarker = useCallback((
    point: { x: number; y: number },
    marker: BetMarker,
    viewport: ViewportState,
    chartCandles: ChartCandle[],
    rect: DOMRect
  ): boolean => {
    const markerPixel = timePriceToPixel(marker.time, marker.price, viewport, chartCandles, rect);
    if (!markerPixel) return false;

    // Приводим координаты точки к системе координат области рисования (вычитаем topPadding)
    // так как маркеры отрисовываются с ctx.translate(0, topPadding)
    const adjustedPointY = point.y - topPadding;

    const offsetFromCandle = 8;
    const markerX = markerPixel.x - offsetFromCandle;
    const markerY = markerPixel.y;

    // Форматируем текст для вычисления размеров метки
    // ВАЖНО: Используем amount (сумма ставки) для отображения, а не price (цена входа)
    const amountStr = marker.amount !== undefined && marker.amount !== null && marker.amount > 0
      ? `$${marker.amount.toFixed(2)}` 
      : formatPrice(marker.price); // Fallback на цену, если amount не указан или равен 0
      const currentTime = getServerTime();
    let timeStr = '';
    if (marker.expirationTime && marker.expirationTime > currentTime) {
      timeStr = formatRemainingTime(marker.expirationTime, currentTime);
    } else if (marker.expirationTime && marker.expirationTime <= currentTime) {
      timeStr = '00:00';
    } else {
      timeStr = formatTimeForTicks(marker.time, timeframe as Timeframe);
    }

    // Создаем временный canvas для измерения текста
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return false;

    tempCtx.font = '10px system-ui, -apple-system, sans-serif';
    const labelText = `${amountStr} ${timeStr}`;
    const labelMetrics = tempCtx.measureText(labelText);

    const labelPaddingX = 10;
    const labelHeight = 24;
    const labelWidth = labelMetrics.width + labelPaddingX * 2;
    const offsetFromLabel = 8;
    const handleSize = 6;

    const labelX = markerX - labelWidth - offsetFromLabel;
    const labelY = markerY;
    const labelRectY = labelY - labelHeight / 2;

    // Проверяем попадание в метку (прямоугольник)
    // Используем adjustedPointY, так как координаты маркера в системе области рисования
    // Добавляем небольшой запас для удобства клика
    const labelClickPadding = 5;
    if (point.x >= labelX - labelClickPadding && point.x <= labelX + labelWidth + labelClickPadding &&
        adjustedPointY >= labelRectY - labelClickPadding && adjustedPointY <= labelRectY + labelHeight + labelClickPadding) {
      return true;
    }

    // Вычисляем позицию handle (кружка)
    let lineEndX = rect.width;
    if (marker.expirationTime) {
      let expirationExactIndex: number;
      if (marker.expirationTime <= chartCandles[0].openTime) {
        expirationExactIndex = 0;
      } else if (marker.expirationTime >= chartCandles[chartCandles.length - 1].openTime) {
        const lastCandle = chartCandles[chartCandles.length - 1];
        let timeInterval = 60_000;
        if (chartCandles.length > 1) {
          const prevCandle = chartCandles[chartCandles.length - 2];
          timeInterval = lastCandle.openTime - prevCandle.openTime;
        }
        if (timeInterval > 0) {
          const timeSinceLastCandle = marker.expirationTime - lastCandle.openTime;
          expirationExactIndex = chartCandles.length - 1 + (timeSinceLastCandle / timeInterval);
        } else {
          expirationExactIndex = chartCandles.length - 1;
        }
      } else {
        let foundIndex = -1;
        for (let i = 0; i < chartCandles.length - 1; i++) {
          if (marker.expirationTime >= chartCandles[i].openTime && marker.expirationTime <= chartCandles[i + 1].openTime) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex >= 0) {
          const currCandle = chartCandles[foundIndex];
          const nextCandle = chartCandles[foundIndex + 1];
          const timeInterval = nextCandle.openTime - currCandle.openTime;
          if (timeInterval > 0) {
            const fraction = (marker.expirationTime - currCandle.openTime) / timeInterval;
            expirationExactIndex = foundIndex + fraction;
          } else {
            expirationExactIndex = foundIndex;
          }
        } else {
          foundIndex = chartCandles.reduce((closest, c, i) => {
            const currentDiff = Math.abs(c.openTime - marker.expirationTime);
            const closestDiff = Math.abs(chartCandles[closest].openTime - marker.expirationTime);
            return currentDiff < closestDiff ? i : closest;
          }, 0);
          expirationExactIndex = foundIndex;
        }
      }

      const expirationRelative = (expirationExactIndex - viewport.fromIndex) / viewport.candlesPerScreen;
      lineEndX = expirationRelative * rect.width;
      lineEndX = Math.max(labelX + labelWidth + offsetFromLabel, Math.min(rect.width, lineEndX));
    }

    const handleX = lineEndX;
    const handleY = labelY;

    // Проверяем попадание в линию между меткой и handle
    const lineStartX = labelX + labelWidth + offsetFromLabel;
    const lineStartY = labelY;
    if (point.x >= Math.min(lineStartX, handleX) && point.x <= Math.max(lineStartX, handleX)) {
      const lineClickTolerance = 8; // Допустимое расстояние от линии для клика
      const distanceToLine = Math.abs(adjustedPointY - lineStartY);
      if (distanceToLine <= lineClickTolerance) {
        console.log('[CandlesCanvas] isPointOnMarker: попадание в линию', {
          markerId: marker.id,
          pointX: point.x,
          pointY: point.y,
          adjustedPointY,
          lineStartX,
          lineStartY,
          handleX,
          distanceToLine,
          lineClickTolerance
        });
        return true;
      }
    }

    // Проверяем попадание в кружок (handle)
    // Используем adjustedPointY, так как координаты маркера в системе области рисования
    const dx = point.x - handleX;
    const dy = adjustedPointY - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isInHandle = distance <= handleSize + 10; // Увеличен запас для удобства клика
    if (isInHandle) {
      console.log('[CandlesCanvas] isPointOnMarker: попадание в handle', {
        markerId: marker.id,
        pointX: point.x,
        pointY: point.y,
        adjustedPointY,
        handleX,
        handleY,
        distance,
        handleSize: handleSize + 10
      });
      return true;
    }

    // Логируем детальную информацию о проверке попадания (только если близко)
    const minDistance = Math.min(
      Math.abs(point.x - labelX),
      Math.abs(point.x - (labelX + labelWidth)),
      Math.abs(adjustedPointY - labelRectY),
      Math.abs(adjustedPointY - (labelRectY + labelHeight)),
      distance
    );
    if (minDistance < 50) {
      const labelCheckX = point.x >= labelX - labelClickPadding && point.x <= labelX + labelWidth + labelClickPadding;
      const labelCheckY = adjustedPointY >= labelRectY - labelClickPadding && adjustedPointY <= labelRectY + labelHeight + labelClickPadding;
      
      console.log('[CandlesCanvas] isPointOnMarker: 🔍 Детальная проверка попадания', {
        markerId: marker.id,
        '🖱️ Точка': { x: point.x.toFixed(2), y: point.y.toFixed(2), adjustedY: adjustedPointY.toFixed(2), topPadding },
        '📍 Маркер позиция': { x: markerPixel.x.toFixed(2), y: markerPixel.y.toFixed(2) },
        '📦 Label область': {
          labelX: labelX.toFixed(2),
          labelRectY: labelRectY.toFixed(2),
          labelWidth: labelWidth.toFixed(2),
          labelHeight: labelHeight.toFixed(2),
          padding: labelClickPadding,
          minX: (labelX - labelClickPadding).toFixed(2),
          maxX: (labelX + labelWidth + labelClickPadding).toFixed(2),
          minY: (labelRectY - labelClickPadding).toFixed(2),
          maxY: (labelRectY + labelHeight + labelClickPadding).toFixed(2),
          '❌ X проверка': `${point.x.toFixed(2)} >= ${(labelX - labelClickPadding).toFixed(2)} && ${point.x.toFixed(2)} <= ${(labelX + labelWidth + labelClickPadding).toFixed(2)} = ${labelCheckX}`,
          '❌ Y проверка': `${adjustedPointY.toFixed(2)} >= ${(labelRectY - labelClickPadding).toFixed(2)} && ${adjustedPointY.toFixed(2)} <= ${(labelRectY + labelHeight + labelClickPadding).toFixed(2)} = ${labelCheckY}`,
          '✅ Попадает в Label': labelCheckX && labelCheckY
        },
        '🎯 Handle': { 
          handleX: handleX.toFixed(2), 
          handleY: handleY.toFixed(2), 
          distance: distance.toFixed(2), 
          radius: (handleSize + 10).toFixed(2), 
          isInHandle 
        },
        '📏 Минимальное расстояние до маркера': minDistance.toFixed(2)
      });
    }

    return false;
  }, [timePriceToPixel, formatPrice, formatRemainingTime, formatTimeForTicks, timeframe, topPadding]);

  // Handle mouse move for crosshair and panning
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ВАЖНО: Проверяем режим рисования через DOM
    const drawingCheck = checkDrawingModeActive();
    
    // ВАЖНО: Проверяем ластик ПЕРВЫМ, до всех других проверок режима рисования
    // Обрабатываем ластик - удаляем рисунки при наведении
    if (drawingMode === 'eraser') {
      // Используем ref для отслеживания нажатия кнопки, так как e.buttons может быть ненадежным после preventDefault()
      if (isEraserMouseDownRef.current || e.buttons === 1) {
        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length === 0) {
          return;
        }
        
        const chartCandles = convertCandles(candlesToRender);
        const currentViewport = viewportRef.current;
        if (!currentViewport) {
          return;
        }
        
        const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
        if (!viewportWithPrices) {
          return;
        }
        
        const topPadding = 50;
        const eraserX = x;
        const eraserY = y - topPadding; // Координата в области рисования
        
        // Проверяем каждый рисунок и удаляем те, которые попадают в радиус ластика
        const linesToRemove: string[] = [];
        for (const drawing of savedDrawings) {
          let shouldRemove = false;
          
          if (drawing.type === 'freehand' && drawing.path.length > 1) {
            // Проверяем расстояние до всех сегментов линии
            for (let i = 0; i < drawing.path.length - 1; i++) {
              const p1Pixel = timePriceToPixel(drawing.path[i].time, drawing.path[i].price, viewportWithPrices, chartCandles, rect);
              const p2Pixel = timePriceToPixel(drawing.path[i + 1].time, drawing.path[i + 1].price, viewportWithPrices, chartCandles, rect);
              if (p1Pixel && p2Pixel) {
                const dist = distanceToLineSegment({ x: eraserX, y: eraserY }, p1Pixel, p2Pixel);
                if (dist <= eraserRadius) {
                  shouldRemove = true;
                  break;
                }
              }
            }
          } else {
            // Для остальных типов линий проверяем расстояние до линии
            const startPixel = timePriceToPixel(drawing.startPoint.time, drawing.startPoint.price, viewportWithPrices, chartCandles, rect);
            const endPixel = timePriceToPixel(drawing.endPoint.time, drawing.endPoint.price, viewportWithPrices, chartCandles, rect);
            if (startPixel && endPixel) {
              const dist = distanceToLineSegment({ x: eraserX, y: eraserY }, startPixel, endPixel);
              if (dist <= eraserRadius) {
                shouldRemove = true;
              }
            }
          }
          
          if (shouldRemove) {
            linesToRemove.push(drawing.id);
          }
        }
        
        
        if (linesToRemove.length > 0) {
          const beforeCount = savedDrawings.length;
          setSavedDrawings(prev => {
            const filtered = prev.filter(d => !linesToRemove.includes(d.id));
            return filtered;
          });
          scheduleRender();
        } else {
        }
      } else {
      }
      
      // Устанавливаем курсор для ластика
      if (canvas) {
        canvas.style.cursor = 'crosshair';
      }
      
      return;
    }
    
    // ВАЖНО: Если активен режим рисования, обрабатываем рисование
    if (drawingCheck.isActive && drawingCheck.drawingMode) {
      // Если мы в процессе рисования
      if (isDrawingRef.current && drawingStartPointRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        const topPadding = 50; // Должно совпадать с topPadding в renderCandles
        const drawingX = x;
        const drawingY = y - topPadding; // Вычитаем topPadding, так как рисование происходит с translate(0, topPadding)
        
        drawingCurrentPointRef.current = { x: drawingX, y: drawingY };
        
        if (drawingCheck.drawingMode === 'freehand') {
          drawingPathRef.current.push({ x: drawingX, y: drawingY });
          
          // Логируем каждую 20-ю точку для freehand
          if (drawingPathRef.current.length % 20 === 0) {
            console.log('[CandlesCanvas] handleMouseMove: freehand точка', {
              pointIndex: drawingPathRef.current.length,
              pixelX: drawingX,
              pixelY: drawingY,
              adjustedY: drawingY + topPadding
            });
          }
        }
        
        // Принудительно вызываем отрисовку для активного рисунка
        if (renderCandlesRef.current) {
          renderCandlesRef.current();
        }
        scheduleRender();
        return;
      } else {
        // Режим рисования активен, но мы еще не начали рисовать
        // Сбрасываем состояние панорамирования, если оно было установлено
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          lastDragXRef.current = 0;
        }
        
        // Предотвращаем стандартное поведение при нажатой кнопке мыши
        if (e.buttons !== 0) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
    }
    
    // Обрабатываем перемещение выделенных рисунков (только если выделен один)
    const selectedIdsArray = Array.from(selectedDrawingIds);
    if (isMovingDrawingRef.current && selectedIdsArray.length === 1 && moveOffsetRef.current && e.buttons !== 0) {
      const selectedDrawingId = selectedIdsArray[0];
      e.preventDefault();
      e.stopPropagation();
      
      const candlesToRender = animatedCandlesRef.current;
      if (candlesToRender.length === 0) return;
      
        const chartCandles = convertCandles(candlesToRender);
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        
        // Вычисляем minPrice и maxPrice из видимых свечей (та же логика, что в renderCandles)
        const fromIdx = Math.max(0, Math.floor(currentViewport.fromIndex));
        const toIdx = Math.min(chartCandles.length - 1, Math.ceil(currentViewport.toIndex));
        const visibleCandles = chartCandles.slice(fromIdx, toIdx + 1);
        if (visibleCandles.length === 0) return;
        
        const prices = visibleCandles.flatMap(c => [c.high, c.low]);
        // Всегда включаем последнюю свечу в расчет диапазона
        const lastCandleIndex = chartCandles.length - 1;
        if (lastCandleIndex >= 0 && lastCandleIndex < chartCandles.length) {
          const lastCandle = chartCandles[lastCandleIndex];
          prices.push(lastCandle.high, lastCandle.low);
        }
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        // Убираем padding, чтобы свечи растягивались на всю доступную высоту
        const padding = priceRange > 0 ? 0 : Math.max(minPrice * 0.0001, 0.0001);
        
        const viewportWithPrices: ViewportState = {
          centerIndex: currentViewport.centerIndex,
          fromIndex: currentViewport.fromIndex,
          toIndex: currentViewport.toIndex,
          candlesPerScreen: currentViewport.candlesPerScreen,
          minPrice: minPrice - padding,
          maxPrice: maxPrice + padding,
        };
      
      const topPadding = 50;
      const drawingX = x;
      const drawingY = y - topPadding;
      
      // Преобразуем текущую позицию мыши в время/цену
      const newCenterTimePrice = pixelToTimePrice(drawingX, y, viewportWithPrices, chartCandles, rect);
      if (!newCenterTimePrice) return;
      
      const selectedDrawing = savedDrawings.find(d => d.id === selectedDrawingId);
      if (selectedDrawing) {
        // Вычисляем старый центр рисунка в координатах времени/цены
        const oldCenterTimePrice = selectedDrawing.type === 'freehand' && selectedDrawing.path.length > 0
          ? selectedDrawing.path[Math.floor(selectedDrawing.path.length / 2)]
          : {
              time: (selectedDrawing.startPoint.time + selectedDrawing.endPoint.time) / 2,
              price: (selectedDrawing.startPoint.price + selectedDrawing.endPoint.price) / 2,
            };
        
        // Вычисляем дельту в координатах времени/цены
        const deltaTime = newCenterTimePrice.time - oldCenterTimePrice.time;
        const deltaPrice = newCenterTimePrice.price - oldCenterTimePrice.price;
        
        // Обновляем позицию рисунка
        setSavedDrawings(prev => prev.map(drawing => {
          if (drawing.id === selectedDrawingId) {
            return {
              ...drawing,
              startPoint: {
                time: drawing.startPoint.time + deltaTime,
                price: drawing.startPoint.price + deltaPrice,
              },
              endPoint: {
                time: drawing.endPoint.time + deltaTime,
                price: drawing.endPoint.price + deltaPrice,
              },
              path: drawing.path.map(p => ({
                time: p.time + deltaTime,
                price: p.price + deltaPrice,
              })),
            };
          }
          return drawing;
        }));
        
        scheduleRender();
      }
      return;
    }
    
    // Обрабатываем выделение области (selection box)
    if (isSelectingRef.current && selectionBox) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
        scheduleRender();
      }
      return;
    }

    // Handle panning
    // НЕ выполняем панорамирование, если кликнули на маркер
    if (isDraggingRef.current && !clickedMarkerRef.current) {
      const deltaX = e.clientX - lastDragXRef.current;
      lastDragXRef.current = e.clientX;
      
      const currentViewport = viewportRef.current;
      if (currentViewport) {
        const chartCandles = convertCandles(animatedCandlesRef.current);
        const newViewport = panViewport(
          currentViewport,
          deltaX,
          rect.width,
          chartCandles.length,
          panZoomConfig
        );
        const clampedViewport = clampViewport(newViewport, chartCandles.length, panZoomConfig);
        viewportRef.current = clampedViewport;
        setViewport(clampedViewport);
        
        // Проверяем, достиг ли пользователь левого края для загрузки дополнительных свечей
        // Загружаем только если мы действительно упираемся в самую первую (самую старую) свечу
        const isAtFirstCandle = clampedViewport.fromIndex <= 50;
        if (onLoadMore && isAtFirstCandle && !isLoadingMoreRef.current) {
          const now = Date.now();
          // Проверяем не чаще раза в секунду
          if (now - lastLoadMoreCheckRef.current > 1000) {
            lastLoadMoreCheckRef.current = now;
            const currentCandlesCount = chartCandles.length;
            // Используем исходные свечи для получения времени первой свечи
            const originalCandles = animatedCandlesRef.current;
            const firstCandleTime = originalCandles.length > 0 ? originalCandles[0].x : null;
            
            // Проверяем, не запрашивали ли мы уже данные для этой первой свечи
            // Используем время первой свечи как ключ, чтобы избежать повторных запросов для одного диапазона
            const lastRequestedFirstTime = lastRequestedFirstCandleTimeRef.current;
            const alreadyRequested = lastRequestedFirstTime !== null && 
                                    firstCandleTime !== null && 
                                    Math.abs(lastRequestedFirstTime - firstCandleTime) < 1000; // Разница менее секунды означает ту же свечу
            
            if (!alreadyRequested && firstCandleTime !== null) {
              console.log('[CandlesCanvas] Достигнут левый край, запрашиваем загрузку 200 свечей:', {
                fromIndex: clampedViewport.fromIndex,
                currentCandlesCount,
                firstCandleTime: new Date(firstCandleTime).toISOString(),
                lastRequestedFirstTime: lastRequestedFirstTime ? new Date(lastRequestedFirstTime).toISOString() : null
              });
              
              lastRequestedFirstCandleTimeRef.current = firstCandleTime;
              isLoadingMoreRef.current = true;
              
              onLoadMore(currentCandlesCount)
                  .then((newCandlesCount) => {
                    console.log('[CandlesCanvas] Загружено дополнительных свечей, добавлено:', newCandlesCount);
                    isLoadingMoreRef.current = false;
                    
                    if (newCandlesCount > 0) {
                      // Сохраняем ожидаемое количество свечей для корректировки viewport
                      // Корректировка произойдет в useEffect для candles, когда свечи будут добавлены
                      pendingViewportAdjustmentRef.current = newCandlesCount;
                      console.log('[CandlesCanvas] Ожидаем добавление свечей для корректировки viewport:', newCandlesCount);
                    }
                  })
                  .catch((error) => {
                    console.error('[CandlesCanvas] Ошибка загрузки дополнительных свечей:', error);
                    isLoadingMoreRef.current = false;
                    setTimeout(() => {
                      lastRequestedFirstCandleTimeRef.current = null;
                    }, 5000);
                  });
            } else {
              console.log('[CandlesCanvas] Пропускаем загрузку - уже запрашивали данные для этой первой свечи:', {
                firstCandleTime: firstCandleTime ? new Date(firstCandleTime).toISOString() : null,
                lastRequestedFirstTime: lastRequestedFirstTime ? new Date(lastRequestedFirstTime).toISOString() : null
              });
            }
          }
        }
        
        scheduleRender();
      }
      return;
    }
    
    // Handle crosshair (только если не активен режим рисования)
    const candlesToRender = animatedCandlesRef.current;
    if (candlesToRender.length === 0) return;

    const chartCandles = convertCandles(candlesToRender);
    const currentViewport = viewportRef.current;
    if (!currentViewport) return;
    
    const viewportWithPrices: ViewportState = {
      centerIndex: currentViewport.centerIndex,
      fromIndex: currentViewport.fromIndex,
      toIndex: currentViewport.toIndex,
      candlesPerScreen: currentViewport.candlesPerScreen,
      minPrice: currentViewport.minPrice,
      maxPrice: currentViewport.maxPrice,
    };
    
    // Проверяем наведение на маркеры ставок (только если не в режиме рисования)
    let hoveredMarker = false;
    let currentHoveredMarkerId: string | null = null;
    if (!drawingMode && betMarkers.length > 0) {
      // Логируем текущую позицию курсора
      console.log('[CandlesCanvas] 🖱️ Mouse position:', {
        x: x.toFixed(2),
        y: y.toFixed(2),
        topPadding,
        adjustedY: (y - topPadding).toFixed(2),
        canvasRect: {
          width: rect.width,
          height: rect.height
        }
      });
      
      // Получаем позиции всех маркеров
      const markerPositions = betMarkers.map(marker => {
        const markerPixel = timePriceToPixel(marker.time, marker.price, viewportWithPrices, chartCandles, rect);
        const distance = markerPixel ? Math.sqrt(Math.pow(x - markerPixel.x, 2) + Math.pow(y - markerPixel.y, 2)) : Infinity;
        return {
          id: marker.id,
          position: markerPixel ? { x: markerPixel.x.toFixed(2), y: markerPixel.y.toFixed(2) } : null,
          distance: distance < Infinity ? parseFloat(distance.toFixed(2)) : Infinity
        };
      });
      
      // Находим минимальное расстояние
      const minDistance = Math.min(...markerPositions.map(m => m.distance));
      
      // Логируем информацию о маркерах когда мышь близко (в радиусе 300 пикселей)
      if (minDistance < 300 && minDistance !== Infinity) {
        console.log('[CandlesCanvas] 🖱️ Мышь близко к маркерам', {
          '🖱️ Мышь': { x: x.toFixed(2), y: y.toFixed(2) },
          '📍 Маркеры': markerPositions.filter(m => m.distance < 300),
          '📏 Минимальное расстояние': minDistance.toFixed(2)
        });
      }
      
      for (let i = betMarkers.length - 1; i >= 0; i--) {
        const marker = betMarkers[i];
        const isOnMarker = isPointOnMarker({ x, y }, marker, viewportWithPrices, chartCandles, rect);
        
        // Логируем результат проверки для каждого маркера, если мышь близко
        if (markerPositions[i].distance < 300 && markerPositions[i].distance !== Infinity) {
          console.log('[CandlesCanvas] 🔍 Проверка попадания на маркер', {
            markerId: marker.id,
            '🖱️ Мышь': { x: x.toFixed(2), y: y.toFixed(2) },
            '📍 Маркер позиция': markerPositions[i].position,
            '📏 Расстояние': markerPositions[i].distance.toFixed(2),
            '✅ Попадает': isOnMarker
          });
        }
        
        if (isOnMarker) {
          hoveredMarker = true;
          currentHoveredMarkerId = marker.id;
          if (canvas) {
            canvas.style.cursor = 'pointer';
          }
          // Логируем при наведении на маркер (только один раз при начале наведения)
          if (previousHoveredMarkerIdRef.current !== marker.id) {
            const markerPixel = timePriceToPixel(marker.time, marker.price, viewportWithPrices, chartCandles, rect);
            console.log('[CandlesCanvas] ✅✅✅ HOVERING OVER MARKER! ✅✅✅', {
              id: marker.id,
              tradeId: marker.tradeId,
              direction: marker.direction,
              price: marker.price,
              '🖱️ Мышь': { x: x.toFixed(2), y: y.toFixed(2) },
              '📍 Маркер позиция': markerPixel ? { x: markerPixel.x.toFixed(2), y: markerPixel.y.toFixed(2) } : null
            });
            previousHoveredMarkerIdRef.current = marker.id;
          }
          break;
        }
      }
    }
    
    // Сбрасываем предыдущий маркер, если курсор больше не на маркере
    if (!hoveredMarker && previousHoveredMarkerIdRef.current !== null) {
      previousHoveredMarkerIdRef.current = null;
    }
    
    // Проверяем наведение на сохраненные рисунки (только если не в режиме рисования и не на маркере)
    if (!drawingMode && !hoveredMarker && savedDrawings.length > 0) {
      // Проверяем наведение на рисунки (в обратном порядке, чтобы выбрать верхний)
      let hoveredDrawing = false;
      for (let i = savedDrawings.length - 1; i >= 0; i--) {
        const drawing = savedDrawings[i];
        if (isPointOnLine({ x, y: y - topPadding }, drawing, viewportWithPrices, chartCandles, rect)) {
          hoveredDrawing = true;
          if (canvas) {
            canvas.style.cursor = 'pointer';
          }
          break;
        }
      }
      
      if (!hoveredDrawing && canvas) {
        canvas.style.cursor = 'crosshair';
      }
    } else if (!drawingMode && !hoveredMarker && canvas) {
      canvas.style.cursor = 'crosshair';
    }

    // Find closest candle index
    const pixelToIndex = (pixelX: number): number => {
      const relative = pixelX / rect.width;
      return currentViewport.fromIndex + relative * currentViewport.candlesPerScreen;
    };

    const index = pixelToIndex(x);
    const candleIndex = Math.round(index);
    
    if (candleIndex >= 0 && candleIndex < chartCandles.length) {
      const candle = chartCandles[candleIndex];
      setHoverIndex(candleIndex);
      setHoverCandle(candle);
      setHoverX(x);
      setHoverY(y);
    } else {
      setHoverIndex(null);
      setHoverCandle(null);
      setHoverX(null);
      setHoverY(null);
    }
  }, [convertCandles, scheduleRender, checkDrawingModeActive, drawingMode, savedDrawings, selectedDrawingIds, isPointOnLine, betMarkers, isPointOnMarker, topPadding, selectionBox, eraserRadius, distanceToLineSegment, timePriceToPixel, calculateViewportWithPrices]);

  // Закрываем контекстное меню при клике
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuPosition) {
        setContextMenuPosition(null);
      }
    };
    
    if (contextMenuPosition) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenuPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left mouse button
    
    // Закрываем контекстное меню при клике на canvas
    if (contextMenuPosition) {
      setContextMenuPosition(null);
    }
    
    // ВАЖНО: Проверяем режим рисования через DOM
    const drawingCheck = checkDrawingModeActive();
    
    // ВАЖНО: Для ластика не начинаем рисование, а позволяем handleMouseMove обрабатывать удаление
    if (drawingCheck.isActive && drawingCheck.drawingMode === 'eraser') {
      // Устанавливаем флаг, что кнопка мыши нажата для ластика
      isEraserMouseDownRef.current = true;
      // Вызываем preventDefault чтобы предотвратить выделение текста, но НЕ устанавливаем состояние рисования
      // handleMouseMove будет использовать isEraserMouseDownRef для определения, нужно ли удалять линии
      e.preventDefault();
      return; // Выходим, не попадая в блок начала рисования
    }
    
      // ВАЖНО: Если активен режим рисования (но не ластик), начинаем рисование
      if (drawingCheck.isActive && drawingCheck.drawingMode && drawingCheck.drawingMode !== 'eraser') {
      e.preventDefault();
      e.stopPropagation();
      
      // Устанавливаем флаг для логирования
      if (typeof window !== 'undefined') {
        (window as any).__isDrawingActive = true;
      }
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      const topPadding = 50; // Должно совпадать с topPadding в renderCandles
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top - topPadding; // Вычитаем topPadding, так как рисование происходит с translate(0, topPadding)
      
      // Начинаем рисование
      isDrawingRef.current = true;
      drawingStartPointRef.current = { x, y };
      drawingCurrentPointRef.current = { x, y };
      currentDrawingModeRef.current = drawingCheck.drawingMode; // Сохраняем режим рисования
      
      if (drawingCheck.drawingMode === 'freehand') {
        drawingPathRef.current = [{ x, y }];
      } else {
        drawingPathRef.current = [];
      }
      
      scheduleRender();
      return;
    }
    
    // Проверяем клик на маркеры ставок (ПЕРЕД проверкой рисунков, чтобы маркеры имели приоритет)
    if (!drawingCheck.isActive && betMarkers.length > 0) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        const topPadding = 50;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length > 0) {
          const chartCandles = convertCandles(candlesToRender);
          const currentViewport = viewportRef.current;
          if (currentViewport) {
            const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
            if (viewportWithPrices) {
              // Ищем маркер, на который кликнули (проверяем в обратном порядке, чтобы выбрать верхний)
              for (let i = betMarkers.length - 1; i >= 0; i--) {
                const marker = betMarkers[i];
                const isOnMarker = isPointOnMarker({ x, y }, marker, viewportWithPrices, chartCandles, rect);
                if (isOnMarker) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Сохраняем маркер для открытия в handleMouseUp
                  clickedMarkerRef.current = marker;
                  // НЕ устанавливаем mouseDownPositionRef и isDraggingRef, чтобы handleMouseUp знал, что это был клик, а не перетаскивание
                  isDraggingRef.current = false; // Явно сбрасываем флаг перетаскивания
                  return; // Выходим, не устанавливая mouseDownPositionRef
                }
              }
            }
          }
        }
      }
    }
    
    // Проверяем клик на любой рисунок (для выделения или перемещения)
    let clickedOnDrawing = false;
    if (!drawingCheck.isActive && savedDrawings.length > 0) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        const topPadding = 50;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top; // Координата относительно canvas (с topPadding)
        
        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length > 0) {
          const chartCandles = convertCandles(candlesToRender);
          const currentViewport = viewportRef.current;
          if (currentViewport) {
            // Вычисляем viewportWithPrices с правильными minPrice и maxPrice
            const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
            if (viewportWithPrices) {
              // Ищем рисунок, на который кликнули (проверяем в обратном порядке, чтобы выбрать верхний)
              // Передаем координату относительно области рисования (y - topPadding)
              for (let i = savedDrawings.length - 1; i >= 0; i--) {
                const drawing = savedDrawings[i];
                if (isPointOnLine({ x, y: y - topPadding }, drawing, viewportWithPrices, chartCandles, rect)) {
                  clickedOnDrawing = true;
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Если это уже выделенный рисунок и выделен только он один, начинаем перемещение
                  if (selectedDrawingIds.has(drawing.id) && selectedDrawingIds.size === 1) {
                    const selectedDrawingId = drawing.id;
                    // Преобразуем центр рисунка в пиксели для вычисления смещения
                    const drawingCenterTimePrice = drawing.type === 'freehand' && drawing.path.length > 0
                      ? drawing.path[Math.floor(drawing.path.length / 2)]
                      : {
                          time: (drawing.startPoint.time + drawing.endPoint.time) / 2,
                          price: (drawing.startPoint.price + drawing.endPoint.price) / 2,
                        };
                    
                    const drawingCenterPixel = timePriceToPixel(drawingCenterTimePrice.time, drawingCenterTimePrice.price, viewportWithPrices, chartCandles, rect);
                    if (drawingCenterPixel) {
                      moveOffsetRef.current = {
                        x: x - drawingCenterPixel.x,
                        y: y - (drawingCenterPixel.y - topPadding),
                      };
                      
                      isMovingDrawingRef.current = true;
                      scheduleRender();
                      return;
                    }
                  } else {
                    // Добавляем/удаляем рисунок из выделения (Ctrl/Cmd для множественного выделения)
                    if (e.ctrlKey || e.metaKey) {
                      setSelectedDrawingIds(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(drawing.id)) {
                          newSet.delete(drawing.id);
                        } else {
                          newSet.add(drawing.id);
                        }
                        return newSet;
                      });
                    } else {
                      // Одиночное выделение - заменяем текущее выделение
                      setSelectedDrawingIds(new Set([drawing.id]));
                    }
                    scheduleRender();
                    return;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Если включен режим выделения, не в режиме рисования, не кликнули на рисунок и не начали перемещение, начинаем выделение области
    if (selectionMode && !drawingCheck.isActive && !isMovingDrawingRef.current && !clickedOnDrawing) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Начинаем выделение области
        isSelectingRef.current = true;
        setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
        mouseDownPositionRef.current = { x: e.clientX, y: e.clientY };
        scheduleRender();
        return;
      }
    }
    
    isDraggingRef.current = true;
    lastDragXRef.current = e.clientX;
    mouseDownPositionRef.current = { x: e.clientX, y: e.clientY };
    userInteractedRef.current = true;
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'grabbing';
    }
  }, [checkDrawingModeActive, scheduleRender, savedDrawings, selectedDrawingIds, isPointOnLine, convertCandles, calculateViewportWithPrices, timePriceToPixel, contextMenuPosition, setContextMenuPosition, betMarkers, isPointOnMarker, selectionMode]);


  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left mouse button
    
    // Сбрасываем флаг нажатия мыши для ластика
    if (isEraserMouseDownRef.current) {
      isEraserMouseDownRef.current = false;
    }
    
    // Завершаем выделение области
    if (isSelectingRef.current && selectionBox) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const topPadding = 50;
        
        // Вычисляем границы области выделения
        const minX = Math.min(selectionBox.startX, selectionBox.endX);
        const maxX = Math.max(selectionBox.startX, selectionBox.endX);
        const minY = Math.min(selectionBox.startY, selectionBox.endY);
        const maxY = Math.max(selectionBox.startY, selectionBox.endY);
        
        // Проверяем, какие рисунки попадают в область выделения
        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length > 0) {
          const chartCandles = convertCandles(candlesToRender);
          const currentViewport = viewportRef.current;
          if (currentViewport) {
            const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
            if (viewportWithPrices) {
              const selectedIds = new Set<string>();
              
              savedDrawings.forEach(drawing => {
                // Проверяем, пересекается ли рисунок с областью выделения
                const startPixel = timePriceToPixel(drawing.startPoint.time, drawing.startPoint.price, viewportWithPrices, chartCandles, rect);
                const endPixel = timePriceToPixel(drawing.endPoint.time, drawing.endPoint.price, viewportWithPrices, chartCandles, rect);
                
                if (startPixel && endPixel) {
                  // Проверяем, попадает ли хотя бы одна точка рисунка в область выделения
                  const startInBox = startPixel.x >= minX && startPixel.x <= maxX && 
                                    (startPixel.y + topPadding) >= minY && (startPixel.y + topPadding) <= maxY;
                  const endInBox = endPixel.x >= minX && endPixel.x <= maxX && 
                                  (endPixel.y + topPadding) >= minY && (endPixel.y + topPadding) <= maxY;
                  
                  // Для freehand проверяем все точки пути
                  let pathInBox = false;
                  if (drawing.type === 'freehand' && drawing.path.length > 0) {
                    pathInBox = drawing.path.some(point => {
                      const pixel = timePriceToPixel(point.time, point.price, viewportWithPrices, chartCandles, rect);
                      if (pixel) {
                        return pixel.x >= minX && pixel.x <= maxX && 
                               (pixel.y + topPadding) >= minY && (pixel.y + topPadding) <= maxY;
                      }
                      return false;
                    });
                  }
                  
                  if (startInBox || endInBox || pathInBox) {
                    selectedIds.add(drawing.id);
                  }
                }
              });
              
              // Обновляем выделение
              if (e.ctrlKey || e.metaKey) {
                // Добавляем к текущему выделению
                setSelectedDrawingIds(prev => {
                  const newSet = new Set(prev);
                  selectedIds.forEach(id => newSet.add(id));
                  return newSet;
                });
              } else {
                // Заменяем текущее выделение
                setSelectedDrawingIds(selectedIds);
              }
            }
          }
        }
      }
      
      isSelectingRef.current = false;
      setSelectionBox(null);
      scheduleRender();
      return;
    }
    
    // Завершаем перемещение рисунка
    if (isMovingDrawingRef.current) {
      isMovingDrawingRef.current = false;
      moveOffsetRef.current = null;
      scheduleRender();
      return;
    }
    
    // Завершаем рисование, если оно было активно
    // ВАЖНО: Используем сохраненный режим рисования из ref, так как режим мог быть отключен между mouseDown и mouseUp
    const currentDrawingMode = currentDrawingModeRef.current;
    
    if (isDrawingRef.current && drawingStartPointRef.current && drawingCurrentPointRef.current && currentDrawingMode) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      const candlesToRender = animatedCandlesRef.current;
      if (candlesToRender.length === 0) return;
      
      const chartCandles = convertCandles(candlesToRender);
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;
      
      // Вычисляем viewportWithPrices с правильными minPrice и maxPrice
      const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles, 'handleMouseUp-save');
      if (!viewportWithPrices) return;
      
      const startPixel = drawingStartPointRef.current;
      const endPixel = drawingCurrentPointRef.current;
      let path = drawingPathRef.current;
      
      // Сглаживаем путь для freehand
      if (currentDrawingMode === 'freehand' && path.length > 2) {
        path = smoothPath(path);
      }
      
      // Преобразуем пиксели в время/цену
      // Координаты в startPixel и endPixel уже скорректированы (y - topPadding), поэтому добавляем topPadding обратно
      console.log('[CandlesCanvas] handleMouseUp: преобразование координат перед сохранением', {
        startPixel: { x: startPixel.x, y: startPixel.y, adjustedY: startPixel.y + topPadding },
        endPixel: { x: endPixel.x, y: endPixel.y, adjustedY: endPixel.y + topPadding },
        rect: { width: rect.width, height: rect.height },
        topPadding,
        ochlBottomPadding,
        chartAreaHeight: rect.height - ochlBottomPadding - topPadding,
        viewport: {
          minPrice: viewportWithPrices.minPrice,
          maxPrice: viewportWithPrices.maxPrice,
          fromIndex: viewportWithPrices.fromIndex,
          toIndex: viewportWithPrices.toIndex,
          candlesPerScreen: viewportWithPrices.candlesPerScreen
        },
        pathLength: path.length
      });
      
      const startTimePrice = pixelToTimePrice(startPixel.x, startPixel.y + topPadding, viewportWithPrices, chartCandles, rect);
      const endTimePrice = pixelToTimePrice(endPixel.x, endPixel.y + topPadding, viewportWithPrices, chartCandles, rect);
      
      console.log('[CandlesCanvas] handleMouseUp: результат преобразования', {
        startTimePrice,
        endTimePrice
      });
      
      if (!startTimePrice || !endTimePrice) {
        console.warn('[CandlesCanvas] handleMouseUp: не удалось преобразовать координаты');
        // Если не удалось преобразовать координаты, сбрасываем состояние и выходим
        isDrawingRef.current = false;
        drawingStartPointRef.current = null;
        drawingCurrentPointRef.current = null;
        drawingPathRef.current = [];
        currentDrawingModeRef.current = null;
        return;
      }
      
      // Для простого клика (без перетаскивания) используем те же координаты для start и end
      // Это позволит сохранить рисунок даже при минимальном движении
      const finalStartTimePrice = startTimePrice;
      const finalEndTimePrice = endTimePrice;
      
      // Преобразуем path для freehand
      const pathTimePrice = path.map((p, index) => {
        const timePrice = pixelToTimePrice(p.x, p.y + topPadding, viewportWithPrices, chartCandles, rect);
        const result = timePrice || { time: finalStartTimePrice.time, price: finalStartTimePrice.price };
        
        // Логируем первые 3 и последние 3 точки
        if (index < 3 || index >= path.length - 3) {
          console.log(`[CandlesCanvas] handleMouseUp: преобразование path точки ${index}`, {
            pixelX: p.x,
            pixelY: p.y,
            adjustedY: p.y + topPadding,
            timePrice: result
          });
        }
        
        return result;
      });
      
      // Проверяем обратное преобразование для сохранённых координат
      const startBackToPixel = timePriceToPixel(finalStartTimePrice.time, finalStartTimePrice.price, viewportWithPrices, chartCandles, rect);
      const endBackToPixel = timePriceToPixel(finalEndTimePrice.time, finalEndTimePrice.price, viewportWithPrices, chartCandles, rect);
      
      // Проверяем первую и последнюю точки path
      const firstPathBackToPixel = pathTimePrice.length > 0 
        ? timePriceToPixel(pathTimePrice[0].time, pathTimePrice[0].price, viewportWithPrices, chartCandles, rect)
        : null;
      const lastPathBackToPixel = pathTimePrice.length > 0
        ? timePriceToPixel(pathTimePrice[pathTimePrice.length - 1].time, pathTimePrice[pathTimePrice.length - 1].price, viewportWithPrices, chartCandles, rect)
        : null;
      
      console.log('[CandlesCanvas] handleMouseUp: проверка обратного преобразования', {
        savedStart: finalStartTimePrice,
        savedEnd: finalEndTimePrice,
        startBackToPixel,
        endBackToPixel,
        originalStartPixel: { x: startPixel.x, y: startPixel.y },
        originalEndPixel: { x: endPixel.x, y: endPixel.y },
        startYDifference: startBackToPixel ? Math.abs(startBackToPixel.y - startPixel.y) : null,
        endYDifference: endBackToPixel ? Math.abs(endBackToPixel.y - endPixel.y) : null,
        firstPathPoint: pathTimePrice.length > 0 ? pathTimePrice[0] : null,
        lastPathPoint: pathTimePrice.length > 0 ? pathTimePrice[pathTimePrice.length - 1] : null,
        firstPathOriginalPixel: path.length > 0 ? { x: path[0].x, y: path[0].y } : null,
        lastPathOriginalPixel: path.length > 0 ? { x: path[path.length - 1].x, y: path[path.length - 1].y } : null,
        firstPathBackToPixel,
        lastPathBackToPixel,
        firstPathYDifference: firstPathBackToPixel && path.length > 0 ? Math.abs(firstPathBackToPixel.y - path[0].y) : null,
        lastPathYDifference: lastPathBackToPixel && path.length > 0 ? Math.abs(lastPathBackToPixel.y - path[path.length - 1].y) : null,
        viewport: {
          minPrice: viewportWithPrices.minPrice,
          maxPrice: viewportWithPrices.maxPrice,
          chartAreaHeight: rect.height - ochlBottomPadding - topPadding
        }
      });
      
      // Сохраняем нарисованную линию с координатами времени/цены
      const newDrawing: SavedDrawing = {
        id: `drawing-${Date.now()}-${Math.random()}`,
        type: currentDrawingMode,
        startPoint: finalStartTimePrice,
        endPoint: finalEndTimePrice,
        path: pathTimePrice,
        color: '#ffa500',
      };
      
      console.log('[CandlesCanvas] handleMouseUp: сохранение рисунка', {
        drawingId: newDrawing.id,
        type: newDrawing.type,
        savedStart: newDrawing.startPoint,
        savedEnd: newDrawing.endPoint,
        pathLength: newDrawing.path.length,
        firstPathPoint: newDrawing.path[0],
        lastPathPoint: newDrawing.path[newDrawing.path.length - 1]
      });
      
      setSavedDrawings(prev => [...prev, newDrawing]);
      
      // Сбрасываем флаг логирования
      if (typeof window !== 'undefined') {
        (window as any).__isDrawingActive = false;
      }
      
      // Сбрасываем состояние
      isDrawingRef.current = false;
      drawingStartPointRef.current = null;
      drawingCurrentPointRef.current = null;
      drawingPathRef.current = [];
      currentDrawingModeRef.current = null; // Сбрасываем сохраненный режим
      scheduleRender();
      e.stopPropagation(); // Предотвращаем всплытие, чтобы handleDocumentMouseUp не обрабатывал это событие
      return;
    }
    
    // Проверяем клик на существующий рисунок (только если не в режиме рисования и не было перемещения)
    const drawingCheck = checkDrawingModeActive();
    // Проверяем, было ли движение мыши (если было минимальное движение, это все еще клик)
    let isClick = true;
    if (mouseDownPositionRef.current) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - mouseDownPositionRef.current.x, 2) +
        Math.pow(e.clientY - mouseDownPositionRef.current.y, 2)
      );
      isClick = dragDistance < 10; // Считаем кликом, если движение меньше 10 пикселей
    }
    mouseDownPositionRef.current = null;
    
    // Обработка клика на маркеры ставок
    // Проверяем, был ли клик на маркер в handleMouseDown
    if (clickedMarkerRef.current) {
      const marker = clickedMarkerRef.current;
      console.log('[CandlesCanvas] handleMouseUp: открываем сайдбар для маркера', {
        markerId: marker.id,
        tradeId: marker.tradeId,
        time: marker.time,
        price: marker.price
      });
      clickedMarkerRef.current = null; // Сбрасываем ref
      // Открываем меню с информацией о сделке
      setSelectedMarker(marker);
      setIsMarkerSidebarOpen(true);
      isDraggingRef.current = false;
      scheduleRender();
      e.stopPropagation(); // Предотвращаем всплытие события
      e.preventDefault(); // Предотвращаем стандартное поведение
      return; // Выходим, не обрабатывая другие клики
    }
    
    // Обработка клика на маркеры ставок (старая логика для обратной совместимости)
    if (!drawingCheck.isActive && betMarkers.length > 0 && isClick) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        const topPadding = 50;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length > 0) {
          const chartCandles = convertCandles(candlesToRender);
          const currentViewport = viewportRef.current;
          if (currentViewport) {
            const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
            if (viewportWithPrices) {
              // Ищем маркер, на который кликнули (проверяем в обратном порядке, чтобы выбрать верхний)
              for (let i = betMarkers.length - 1; i >= 0; i--) {
                const marker = betMarkers[i];
                if (isPointOnMarker({ x, y }, marker, viewportWithPrices, chartCandles, rect)) {
                  // Открываем меню с информацией о сделке
                  setSelectedMarker(marker);
                  setIsMarkerSidebarOpen(true);
                  isDraggingRef.current = false;
                  scheduleRender();
                  e.stopPropagation(); // Предотвращаем всплытие события
                  return; // Выходим, не обрабатывая другие клики
                }
              }
            }
          }
        }
      }
    }
    
    if (!drawingCheck.isActive && savedDrawings.length > 0 && isClick) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        const topPadding = 50;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top; // Координата относительно canvas (с topPadding)
        
        const candlesToRender = animatedCandlesRef.current;
        if (candlesToRender.length > 0) {
          const chartCandles = convertCandles(candlesToRender);
          const currentViewport = viewportRef.current;
          if (currentViewport) {
            // Вычисляем viewportWithPrices с правильными minPrice и maxPrice
            const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
            if (viewportWithPrices) {
              // Ищем рисунок, на который кликнули (проверяем в обратном порядке, чтобы выбрать верхний)
              // Передаем координату относительно области рисования (y - topPadding)
              for (let i = savedDrawings.length - 1; i >= 0; i--) {
                const drawing = savedDrawings[i];
                if (isPointOnLine({ x, y: y - topPadding }, drawing, viewportWithPrices, chartCandles, rect)) {
                  // Добавляем/удаляем рисунок из выделения (Ctrl/Cmd для множественного выделения)
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedDrawingIds(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(drawing.id)) {
                        newSet.delete(drawing.id);
                      } else {
                        newSet.add(drawing.id);
                      }
                      return newSet;
                    });
                  } else {
                    // Одиночное выделение - заменяем текущее выделение
                    setSelectedDrawingIds(new Set([drawing.id]));
                  }
                  isDraggingRef.current = false;
                  scheduleRender();
                  return;
                }
              }
            }
          }
        }
        
        // Если кликнули не на рисунок и не было выделения области, снимаем выделение
        if (!isSelectingRef.current && selectedDrawingIds.size > 0 && !(e.ctrlKey || e.metaKey)) {
          setSelectedDrawingIds(new Set());
          scheduleRender();
        }
        
        // Логика создания маркера ставки при клике удалена
      }
    }
    
    isDraggingRef.current = false;
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }
  }, [scheduleRender, drawingMode, savedDrawings, selectedDrawingIds, isPointOnLine, smoothPath, checkDrawingModeActive, convertCandles, pixelToTimePrice, calculateViewportWithPrices, hoverCandle, betMarkers, isPointOnMarker, selectionBox, timePriceToPixel]);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    mouseDownPositionRef.current = null;
    
    // Сбрасываем флаг нажатия мыши для ластика
    if (isEraserMouseDownRef.current) {
      isEraserMouseDownRef.current = false;
    }
    
    setHoverIndex(null);
    setHoverCandle(null);
    setHoverX(null);
    setHoverY(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Предотвращаем стандартное контекстное меню
    e.stopPropagation(); // Останавливаем всплытие события
    
    const drawingCheck = checkDrawingModeActive();
    
    // Если активен режим рисования, не показываем меню
    if (drawingCheck.isActive) {
      return;
    }
    
    // Всегда открываем меню в месте клика
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container && savedDrawings.length > 0) {
      const rect = container.getBoundingClientRect();
      const topPadding = 50;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top; // Координата относительно canvas (с topPadding)
      
      const candlesToRender = animatedCandlesRef.current;
      if (candlesToRender.length > 0) {
        const chartCandles = convertCandles(candlesToRender);
        const currentViewport = viewportRef.current;
        if (currentViewport) {
          const viewportWithPrices = calculateViewportWithPrices(currentViewport, chartCandles);
          if (viewportWithPrices) {
            // Ищем рисунок, на который кликнули (проверяем в обратном порядке, чтобы выбрать верхний)
            // Передаем координату относительно области рисования (y - topPadding)
            for (let i = savedDrawings.length - 1; i >= 0; i--) {
              const drawing = savedDrawings[i];
              if (isPointOnLine({ x, y: y - topPadding }, drawing, viewportWithPrices, chartCandles, rect)) {
                // Выделяем рисунок и открываем меню
                setSelectedDrawingIds(new Set([drawing.id]));
                setContextMenuPosition({ x: e.clientX, y: e.clientY });
                scheduleRender();
                return;
              }
            }
          }
        }
      }
    }
    
    // Если кликнули не на рисунок, все равно показываем меню в месте клика
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, [checkDrawingModeActive, savedDrawings, isPointOnLine, convertCandles, calculateViewportWithPrices, scheduleRender]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    userInteractedRef.current = true;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const anchorPixelX = e.clientX - rect.left;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    const currentViewport = viewportRef.current;
    if (!currentViewport) return;

    const chartCandles = convertCandles(animatedCandlesRef.current);
    const newViewport = zoomViewport(
      currentViewport,
      zoomFactor,
      anchorPixelX,
      rect.width,
      chartCandles.length,
      panZoomConfig
    );
    const clampedViewport = clampViewport(newViewport, chartCandles.length, panZoomConfig);
    viewportRef.current = clampedViewport;
    setViewport(clampedViewport);
    scheduleRender();
  }, [convertCandles, scheduleRender]);

  // Регистрируем обработчики resize и wheel
  useEffect(() => {
    scheduleRender();

    const resizeObserver = new ResizeObserver(() => {
      scheduleRender();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Регистрируем обработчик wheel с { passive: false } для возможности preventDefault
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      if (renderFrameRef.current !== null) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      // ВАЖНО: Останавливаем анимацию свечи при размонтировании
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStateRef.current = null;
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [scheduleRender, handleWheel]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        pointerEvents: 'auto',
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
      {contextMenuPosition && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            minWidth: '150px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedDrawingIds.size > 0 && (
            <div
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '12px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => {
                setSavedDrawings(prev => prev.filter(d => !selectedDrawingIds.has(d.id)));
                setSelectedDrawingIds(new Set());
                setContextMenuPosition(null);
                scheduleRender();
              }}
            >
              {selectedDrawingIds.size === 1 ? 'Удалить' : `Удалить (${selectedDrawingIds.size})`}
            </div>
          )}
        </div>
      )}
      {/* Сайдбар с информацией о ставке */}
      {isMarkerSidebarOpen && selectedMarker && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10002,
              animation: 'fadeIn 0.3s ease-out',
            }}
            onClick={() => {
              setIsMarkerSidebarOpen(false);
              setSelectedMarker(null);
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '400px',
              height: '100%',
              backgroundColor: '#1a1a1a',
              borderLeft: '1px solid #333',
              zIndex: 10003,
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.3s ease-out',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                {t('trading.markerInfo.title')}
              </h2>
              <button
                onClick={() => {
                  setIsMarkerSidebarOpen(false);
                  setSelectedMarker(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '20px', flex: 1 }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.direction')}</div>
                <div
                  style={{
                    color: selectedMarker.direction === 'buy' ? '#32AC41' : '#F7525F',
                    fontSize: '13px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedMarker.direction === 'buy' ? t('trading.markerInfo.buy') : t('trading.markerInfo.sell')}
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.betAmount')}</div>
                <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                  {selectedMarker.amount !== undefined && selectedMarker.amount !== null
                    ? `$${selectedMarker.amount.toFixed(2)}`
                    : formatPrice(selectedMarker.price)}
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.betTime')}</div>
                <div style={{ color: '#fff', fontSize: '13px' }}>
                  {formatDateTimeUTC(selectedMarker.time)}
                </div>
              </div>
              
              {selectedMarker.expirationTime && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.endTime')}</div>
                  <div style={{ color: '#fff', fontSize: '13px' }}>
                    {formatDateTimeUTC(selectedMarker.expirationTime)}
                  </div>
                  {(() => {
                    const currentServerTime = getServerTime();
                    return (
                      <>
                        {selectedMarker.expirationTime > currentServerTime && (
                          <div style={{ color: '#4A90E2', fontSize: '12px', marginTop: '8px' }}>
                            {t('trading.markerInfo.remaining')}: {formatRemainingTime(selectedMarker.expirationTime, currentServerTime)}
                          </div>
                        )}
                        {selectedMarker.expirationTime <= currentServerTime && (
                          <div style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                            {t('trading.markerInfo.betCompleted')}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              
              {selectedMarker.tradeId && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.tradeId')}</div>
                    <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                      {selectedMarker.tradeId}
                    </div>
                  </div>
                  {(() => {
                    const trade = activeTrades.find(t => t.id === selectedMarker.tradeId);
                    if (trade) {
                      return (
                        <>
                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.amount')}</div>
                            <div style={{ color: '#fff', fontSize: '13px' }}>
                              {formatPrice(trade.amount)}
                            </div>
                          </div>
                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.entryPrice')}</div>
                            <div style={{ color: '#fff', fontSize: '13px' }}>
                              {formatPrice(trade.entryPrice)}
                            </div>
                          </div>
                          {trade.currentPrice !== null && trade.currentPrice !== undefined && (
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.currentPrice')}</div>
                              <div style={{ color: '#fff', fontSize: '13px' }}>
                                {formatPrice(trade.currentPrice)}
                              </div>
                            </div>
                          )}
                          {trade.profitPercentage !== undefined && trade.profitPercentage !== null && (
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.profit')} (%)</div>
                              <div
                                style={{
                                  color: trade.profitPercentage >= 0 ? '#32AC41' : '#F7525F',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                }}
                              >
                                {formatPercent(trade.profitPercentage)}
                              </div>
                            </div>
                          )}
                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.tradeEndTime')}</div>
                            <div style={{ color: '#fff', fontSize: '13px' }}>
                              {formatDateTimeUTC(trade.expirationTime)}
                            </div>
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{t('trading.markerInfo.creationDate')}</div>
                <div style={{ color: '#fff', fontSize: '12px' }}>
                  {formatDateTimeUTC(selectedMarker.createdAt)}
                </div>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
});

CandlesCanvas.displayName = 'CandlesCanvas';

export default CandlesCanvas;

