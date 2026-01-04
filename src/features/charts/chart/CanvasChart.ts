import { CanvasChartOptions, CanvasChartHandle, Candle, ViewportState, Timeframe, DrawingState, ChartView } from './types';
import { clampViewport, panViewport, zoomViewport, PanZoomConfig } from './panZoom';
import { renderChart, xIndexToPixel, priceToPixel } from './rendering';
import { getTimeframeDurationMs } from '../ui/utils';
import { getServerTime } from '@src/shared/lib/serverTime';
import backgroundImageSrc from '@src/assets/images/backgrounds/background_chart.png';
import { ActiveCandleUpdater } from './ActiveCandleUpdater';

export class CanvasChart implements CanvasChartHandle {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private candles: Candle[] = [];
  private timeframe: Timeframe;
  private viewport: ViewportState;
  private panZoomConfig: PanZoomConfig;
  private overshootCandles: number;
  public followPrice: boolean;

  private hasViewportInitialized = false;
  private hasUserInteracted = false;

  get userHasInteracted(): boolean {
    return this.hasUserInteracted;
  }

  private isDragging = false;
  private lastDragX: number | null = null;
  private hoverIndex: number | null = null;
  private hoverCandle: Candle | null = null;
  private hoverX: number | null = null;
  private hoverY: number | null = null;
  private eraserPosition: { x: number; y: number } | null = null;
  private creationTime: number = Date.now();
  private readonly HOVER_BLOCK_DURATION = 100;
  private lastVisibilityChangeTime: number = 0; // Время последнего изменения видимости
  private pendingRenderTimeout: number | null = null; // Таймер для debounce render
  private lastRenderTime: number = 0; // Время последнего фактического рендеринга
  private wasCreatedWhileHidden: boolean = false; // Флаг: график был создан при скрытой вкладке
  private readonly RENDER_DEBOUNCE_MS = 16; // Минимальный интервал между рендерами (~60 FPS)
  private readonly VISIBILITY_RENDER_DELAY_MS = 100; // Задержка рендера после возврата видимости

  private resizeObserver?: ResizeObserver;
  private rafId: number | null = null;
  private momentumRafId: number | null = null;
  private adaptiveAnimationRafId: number | null = null;
  private hoverUpdateRafId: number | null = null;
  private timeLineAnimationRafId: number | null = null; // Анимация линии времени для плавного движения
  private countdownTimerInterval: number | null = null;
  private getServerTime?: () => number;
  private getCurrentTime?: () => number; // Функция для получения времени из Redux
  
  private velocityHistory: Array<{ time: number; delta: number }> = [];
  private currentVelocity: number = 0;
  private recentVelocities: Array<{ time: number; velocity: number }> = [];
  private readonly friction = 0.96;
  private readonly minVelocity = 0.3;
  private readonly minVelocityForMomentum = 1.0;
  
  private backgroundImage: HTMLImageElement | null = null;
  private activeIndicators: string[] = [];
  private drawingState?: DrawingState;
  private onDrawingStateChange?: (state: DrawingState) => void;
  private onUserInteraction?: () => void;
  private isDrawingMode = false;
  private drawingStartPoint: { x: number; y: number; time: number; price: number } | null = null;
  private chartView: ChartView = 'candles';
  
  private adaptiveAnimation: {
    startMinPrice: number;
    startMaxPrice: number;
    targetMinPrice: number;
    targetMaxPrice: number;
    startTime: number;
    duration: number;
  } | null = null;
  
  
  private priceLineAnimation: {
    currentPrice: number;
    targetPrice: number;
  } | null = null;
  private priceLineAnimationRafId: number | null = null;
  
  // Анимация активной свечи
  private activeCandleAnimation: {
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
  } | null = null;
  private activeCandleAnimationRafId: number | null = null;
  
  private hoveredButton: 'buy' | 'sell' | null = null;
  private bottomPadding: number = 0;
  
  // Pinch-to-zoom tracking
  private pinchStartDistance: number | null = null;
  private pinchStartCenter: { x: number; y: number } | null = null;
  private isPinching: boolean = false;
  
  private boundHandlers: {
    mouseDown?: (e: MouseEvent) => void;
    mouseMove?: (e: MouseEvent) => void;
    mouseUp?: (e: MouseEvent) => void;
    mouseLeave?: (e: MouseEvent) => void;
    wheel?: (e: WheelEvent) => void;
    pointerDown?: (e: PointerEvent) => void;
    pointerMove?: (e: PointerEvent) => void;
    pointerUp?: (e: PointerEvent) => void;
    pointerLeave?: (e: PointerEvent) => void;
    touchStart?: (e: TouchEvent) => void;
    touchMove?: (e: TouchEvent) => void;
    touchEnd?: (e: TouchEvent) => void;
  } = {};

  constructor(options: CanvasChartOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context from canvas');
    }
    this.ctx = ctx;

    this.timeframe = options.timeframe;
    this.overshootCandles = options.overshootCandles ?? 0.5;
    this.followPrice = options.followPrice ?? true;
    this.candles = [...options.candles]
      .filter((candle): candle is Candle => {
        return candle !== null && 
               candle !== undefined &&
               typeof candle.openTime === 'number' &&
               typeof candle.open === 'number' &&
               typeof candle.high === 'number' &&
               typeof candle.low === 'number' &&
               typeof candle.close === 'number' &&
               Number.isFinite(candle.openTime) &&
               Number.isFinite(candle.open) &&
               Number.isFinite(candle.high) &&
               Number.isFinite(candle.low) &&
               Number.isFinite(candle.close) &&
               candle.open > 0 &&
               candle.high > 0 &&
               candle.low > 0 &&
               candle.close > 0 &&
               candle.high >= candle.low &&
               candle.high >= candle.open &&
               candle.high >= candle.close &&
               candle.low <= candle.open &&
               candle.low <= candle.close;
      })
      .sort((a, b) => a.openTime - b.openTime);
    
    // Сбрасываем состояние анимации при создании графика
    this.stopActiveCandleAnimation();
    this.getServerTime = options.getServerTime;
    this.getCurrentTime = options.getCurrentTime;
    this.activeIndicators = options.activeIndicators ?? [];
    this.drawingState = options.drawingState ? { ...options.drawingState } : undefined;
    console.log('[CanvasChart] constructor: инициализация drawingState', {
      hasDrawingState: !!this.drawingState,
      mode: this.drawingState?.mode,
      isDrawing: this.drawingState?.isDrawing
    });
    this.onDrawingStateChange = options.onDrawingStateChange;
    this.onUserInteraction = options.onUserInteraction;
    this.chartView = options.chartView ?? 'candles';
    this.bottomPadding = options.bottomPadding ?? 0;

    this.panZoomConfig = {
      minCandlesPerScreen: 30,
      maxCandlesPerScreen: 500,
      overshootCandles: this.overshootCandles,
    };

    this.hoverIndex = null;
    this.hoverCandle = null;
    this.hoverX = null;
    this.hoverY = null;
    
    this.initializeViewportIfNeeded();
    this.setupEventHandlers();
    this.setupResizeObserver();
    this.setupVisibilityChangeHandler();
    this.loadBackgroundImage();
    this.startCountdownTimer();
    this.startTimeLineAnimation();
    
    const visibilityState = typeof document !== 'undefined' ? document.visibilityState : 'unknown';
    const isVisible = visibilityState === 'visible';
    this.wasCreatedWhileHidden = !isVisible;
    
    // Если график создан при видимой вкладке, сразу рендерим
    // Если при скрытой - рендер произойдет когда вкладка станет видимой через visibility-change handler
    if (isVisible) {
      this.scheduleRender('constructor');
    }
  }
  
  private setupVisibilityChangeHandler(): void {
    if (typeof document === 'undefined') return;
    
      const handleVisibilityChange = () => {
      const visibilityState = document.visibilityState;
      const isVisible = visibilityState === 'visible';
      const now = Date.now();
      this.lastVisibilityChangeTime = now;
      
      // Останавливаем все анимации когда вкладка скрывается
      if (!isVisible) {
        // Очищаем rafId для основного рендера
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.priceLineAnimationRafId !== null) {
          cancelAnimationFrame(this.priceLineAnimationRafId);
          this.priceLineAnimationRafId = null;
        }
        if (this.adaptiveAnimationRafId !== null) {
          cancelAnimationFrame(this.adaptiveAnimationRafId);
          this.adaptiveAnimationRafId = null;
        }
        if (this.momentumRafId !== null) {
          cancelAnimationFrame(this.momentumRafId);
          this.momentumRafId = null;
        }
        if (this.activeCandleAnimationRafId !== null) {
          cancelAnimationFrame(this.activeCandleAnimationRafId);
          this.activeCandleAnimationRafId = null;
        }
        if (this.timeLineAnimationRafId !== null) {
          cancelAnimationFrame(this.timeLineAnimationRafId);
          this.timeLineAnimationRafId = null;
        }
      }
      
      // Отменяем любые ожидающие рендеры
      if (this.pendingRenderTimeout !== null) {
        clearTimeout(this.pendingRenderTimeout);
        this.pendingRenderTimeout = null;
      }
      
      // При возврате видимости принудительно обновляем график с задержкой,
      // чтобы избежать множественных рендерингов подряд и дать браузеру время обработать изменение видимости
      if (isVisible) {
        // Останавливаем анимацию активной свечи при возврате видимости
        // и применяем финальные значения, чтобы избежать "дергания" свечи
        if (this.activeCandleAnimation) {
          this.stopActiveCandleAnimation();
        }
        
        // Если график был создан при скрытой вкладке, увеличиваем задержку для предотвращения дергания
        const delay = this.wasCreatedWhileHidden ? Math.max(this.VISIBILITY_RENDER_DELAY_MS * 2, 200) : this.VISIBILITY_RENDER_DELAY_MS;
        
        // Используем увеличенную задержку для предотвращения множественных рендеров
        this.pendingRenderTimeout = window.setTimeout(() => {
          this.pendingRenderTimeout = null;
          // Проверяем, что страница все еще видима перед рендерингом
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            // Перезапускаем анимацию линии времени при возврате видимости
            this.startTimeLineAnimation();
            // Сбрасываем флаг после первого рендера при возврате видимости
            this.wasCreatedWhileHidden = false;
            this.scheduleRender('visibility-change');
          }
        }, delay);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Сохраняем обработчик для возможной очистки в будущем
    (this as any)._visibilityChangeHandler = handleVisibilityChange;
  }
  
  private loadBackgroundImage(): void {
    try {
      const img = new Image();
      img.src = backgroundImageSrc;
      img.onload = () => {
        this.backgroundImage = img;
        this.scheduleRender('background-image-loaded');
      };
      img.onerror = () => {
        this.backgroundImage = null;
      };
    } catch (error) {
      this.backgroundImage = null;
    }
  }

  private initializeViewportIfNeeded(): void {
    if (this.hasViewportInitialized) return;

    const candlesCount = this.candles.length;
    if (candlesCount === 0) {
      this.viewport = {
        centerIndex: 0,
        candlesPerScreen: 50,
        fromIndex: 0,
        toIndex: 50,
        minPrice: 0,
        maxPrice: 100,
      };
      this.hasViewportInitialized = true;
      return;
    }

    // Определяем оптимальное количество свечей на экране в зависимости от таймфрейма
    // Для больших таймфреймов (1h, 30m) показываем больше свечей для лучшей визуализации
    let defaultCandlesPerScreen: number;
    switch (this.timeframe) {
      case '15s':
      case '30s':
        defaultCandlesPerScreen = 30;
        break;
      case '1m':
      case '5m':
        defaultCandlesPerScreen = 50;
        break;
      case '15m':
      case '30m':
        defaultCandlesPerScreen = 80;
        break;
      case '1h':
        defaultCandlesPerScreen = 100;
        break;
      default:
        defaultCandlesPerScreen = 50;
    }

    const candlesPerScreen = Math.max(
      Math.min(defaultCandlesPerScreen, candlesCount),
      5,
    );

    const lastIndex = candlesCount - 1;
    const o = this.panZoomConfig.overshootCandles;
    const maxFrom = lastIndex + o * candlesPerScreen - candlesPerScreen;
    const fromIndex = maxFrom;
    const toIndex = fromIndex + candlesPerScreen;

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (let i = fromIndex; i <= toIndex && i < this.candles.length; i++) {
      const candle = this.candles[i];
      if (!candle || typeof candle.low !== 'number' || typeof candle.high !== 'number') {
        continue;
      }
      if (Number.isFinite(candle.low) && Number.isFinite(candle.high)) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
      }
    }

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      minPrice = 0;
      maxPrice = 100;
    } else {
      // Убираем padding, чтобы свечи растягивались на всю доступную высоту
      const padding = 0;
      minPrice -= padding;
      maxPrice += padding;
    }

    this.viewport = {
      centerIndex: (fromIndex + toIndex) / 2,
      candlesPerScreen,
      fromIndex,
      toIndex,
      minPrice,
      maxPrice,
    };

    this.updateViewportPriceRange();
    this.hasViewportInitialized = true;
  }

  private lastLeftBoundaryCheck: number = -1;
  private lastBoundaryCheckTime: number = 0;
  private isUpdatingViewportInRender: boolean = false;
  private lastPriceRangeUpdateInRender: { minPrice: number; maxPrice: number } | null = null;
  
  private applyClamp(): void {
    const candlesCount = this.candles.length;
    const beforeClamp = this.viewport.fromIndex;
    
    this.viewport = clampViewport(
      this.viewport,
      candlesCount,
      this.panZoomConfig,
    );
    
    const afterClamp = this.viewport.fromIndex;
    
    this.checkLeftBoundary();
  }
  
  private checkLeftBoundary(): void {
    if (!this.onReachLeftBoundary) {
      return;
    }
    
    const candlesCount = this.candles.length;
    if (candlesCount === 0) {
      return;
    }
    
    const o = this.panZoomConfig.overshootCandles;
    const width = this.viewport.candlesPerScreen;
    const minLeft = -o * width;
    const currentFromIndex = this.viewport.fromIndex;
    
    const distanceToMin = currentFromIndex - minLeft;
    const threshold = width * 0.3;
    
    const isNearLeftBoundary = distanceToMin <= threshold;
    
    if (!isNearLeftBoundary) {
      return;
    }
    
    const now = this.getServerTime ? this.getServerTime() : getServerTime();
    const isFirstCheck = this.lastLeftBoundaryCheck === -1;
    const isAtExactBoundary = Math.abs(distanceToMin) < 0.01;
    const hasMovedSinceLastCheck = !isFirstCheck && Math.abs(currentFromIndex - this.lastLeftBoundaryCheck) > width * 0.1;
    const timeSinceLastCheck = now - this.lastBoundaryCheckTime;
    const minTimeBetweenChecks = isAtExactBoundary ? 2000 : 500;
    
    if (isFirstCheck || hasMovedSinceLastCheck) {
      if (timeSinceLastCheck < 300) {
        return;
      }
      
      this.lastLeftBoundaryCheck = currentFromIndex;
      this.lastBoundaryCheckTime = now;
      this.onReachLeftBoundary();
    } else if (isAtExactBoundary && timeSinceLastCheck >= minTimeBetweenChecks) {
      this.lastLeftBoundaryCheck = currentFromIndex;
      this.lastBoundaryCheckTime = now;
      this.onReachLeftBoundary();
    }
  }
  
  onReachLeftBoundary?: () => void;

  private updateViewportPriceRange(): void {
    if (this.candles.length === 0) {
      this.viewport.minPrice = 0;
      this.viewport.maxPrice = 100;
      return;
    }

    // Используем РЕАЛЬНЫЕ свечи (не анимированные) для расчета диапазона цен
    // Это предотвращает искажение свечи при анимации
    // Анимированные значения используются только для отрисовки
    const candlesToUse = this.candles;
    const fromIdx = Math.max(0, Math.floor(this.viewport.fromIndex));
    const toIdx = Math.min(candlesToUse.length - 1, Math.ceil(this.viewport.toIndex));

    if (fromIdx > toIdx) {
      return;
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (let i = fromIdx; i <= toIdx && i < candlesToUse.length; i++) {
      const candle = candlesToUse[i];
      if (candle && Number.isFinite(candle.low) && Number.isFinite(candle.high)) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
      }
    }

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice === Infinity || maxPrice === -Infinity) {
      if (candlesToUse.length > 0) {
        const allCandles = candlesToUse.slice(Math.max(0, candlesToUse.length - 100));
        minPrice = Math.min(...allCandles.map(c => c.low));
        maxPrice = Math.max(...allCandles.map(c => c.high));
      }
      
      if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
        minPrice = 0;
        maxPrice = 100;
      }
    }

    if (minPrice === maxPrice) {
      minPrice = minPrice * 0.99;
      maxPrice = maxPrice * 1.01;
    }

    // Убираем padding, чтобы свечи растягивались на всю доступную высоту
    const padding = 0;
    minPrice -= padding;
    maxPrice += padding;

    const currentMinPrice = this.viewport.minPrice;
    const currentMaxPrice = this.viewport.maxPrice;
    
    if (currentMinPrice === 0 && currentMaxPrice === 0 || currentMinPrice === 0 && currentMaxPrice === 100) {
      this.viewport.minPrice = minPrice;
      this.viewport.maxPrice = maxPrice;
      return;
    }
    
    const minPriceDiff = Math.abs(minPrice - currentMinPrice);
    const maxPriceDiff = Math.abs(maxPrice - currentMaxPrice);
    const priceRange = currentMaxPrice - currentMinPrice;
    const threshold = priceRange > 0 ? priceRange * 0.01 : 0.0001;
    
    if (minPriceDiff < threshold && maxPriceDiff < threshold) {
      this.viewport.minPrice = minPrice;
      this.viewport.maxPrice = maxPrice;
      return;
    }

    this.startAdaptiveAnimation(currentMinPrice, currentMaxPrice, minPrice, maxPrice);
  }
  
  private startAdaptiveAnimation(
    startMinPrice: number,
    startMaxPrice: number,
    targetMinPrice: number,
    targetMaxPrice: number
  ): void {
    if (this.adaptiveAnimationRafId !== null) {
      cancelAnimationFrame(this.adaptiveAnimationRafId);
    }

    this.adaptiveAnimation = {
      startMinPrice,
      startMaxPrice,
      targetMinPrice,
      targetMaxPrice,
      startTime: performance.now(),
      duration: 300,
    };

    this.animateAdaptiveViewport();
  }
  
  private animateAdaptiveViewport(): void {
    // Останавливаем анимацию если вкладка скрыта
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      this.adaptiveAnimationRafId = null;
      return;
    }
    
    if (!this.adaptiveAnimation) {
      this.adaptiveAnimationRafId = null;
      return;
    }

    const now = performance.now();
    const elapsed = now - this.adaptiveAnimation.startTime;
    const progress = Math.min(1, elapsed / this.adaptiveAnimation.duration);

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const easedProgress = easeOutCubic(progress);

    const currentMinPrice = this.adaptiveAnimation.startMinPrice + 
      (this.adaptiveAnimation.targetMinPrice - this.adaptiveAnimation.startMinPrice) * easedProgress;
    const currentMaxPrice = this.adaptiveAnimation.startMaxPrice + 
      (this.adaptiveAnimation.targetMaxPrice - this.adaptiveAnimation.startMaxPrice) * easedProgress;

    this.viewport.minPrice = currentMinPrice;
    this.viewport.maxPrice = currentMaxPrice;

    if (progress >= 1) {
      this.viewport.minPrice = this.adaptiveAnimation.targetMinPrice;
      this.viewport.maxPrice = this.adaptiveAnimation.targetMaxPrice;
      this.adaptiveAnimation = null;
      this.adaptiveAnimationRafId = null;
    } else {
      this.adaptiveAnimationRafId = requestAnimationFrame(() => this.animateAdaptiveViewport());
    }

    this.scheduleRender('adaptive-viewport-animation');
  }

  private setupEventHandlers(): void {
    this.boundHandlers.mouseDown = this.handleMouseDown.bind(this);
    this.boundHandlers.mouseMove = this.handleMouseMove.bind(this);
    this.boundHandlers.mouseUp = this.handleMouseUp.bind(this);
    this.boundHandlers.mouseLeave = this.handleMouseLeave.bind(this);
    this.boundHandlers.wheel = this.handleWheel.bind(this);
    
    // Pointer events для поддержки тачпада
    this.boundHandlers.pointerDown = (e: PointerEvent) => {
      // Обрабатываем все pointer события, включая touch от тачпада
      // Тачпад на Linux генерирует события с pointerType === 'touch'
      // Разрешаем все события, так как различить тачпад от реального touch экрана сложно
      const width = (e as any).width || 0;
      const height = (e as any).height || 0;
      
      // Если активен режим рисования, предотвращаем стандартное поведение
      if (this.drawingState && this.drawingState.mode && this.drawingState.mode !== 'eraser') {
        e.preventDefault();
      }
      
      // Преобразуем PointerEvent в MouseEvent для совместимости
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
        bubbles: true,
        cancelable: true,
      });
      this.handleMouseDown(mouseEvent);
    };
    
    this.boundHandlers.pointerMove = (e: PointerEvent) => {
      // Обрабатываем все pointer события, включая touch от тачпада
      // Тачпад на Linux генерирует события с pointerType === 'touch'
      
      // Если активен режим рисования или ластик, предотвращаем стандартное поведение
      if (this.isDrawingMode || (this.drawingState && this.drawingState.mode)) {
        e.preventDefault();
      }
      
      // Преобразуем PointerEvent в MouseEvent для совместимости
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
        bubbles: true,
        cancelable: true,
      });
      this.handleMouseMove(mouseEvent);
    };
    
    this.boundHandlers.pointerUp = (e: PointerEvent) => {
      // Обрабатываем все pointer события, включая touch от тачпада
      // Тачпад на Linux генерирует события с pointerType === 'touch'
      // Преобразуем PointerEvent в MouseEvent для совместимости
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
        bubbles: true,
        cancelable: true,
      });
      this.handleMouseUp(mouseEvent);
    };
    
    this.boundHandlers.pointerLeave = (e: PointerEvent) => {
      // Обрабатываем все pointer события, включая touch от тачпада
      // Тачпад на Linux генерирует события с pointerType === 'touch'
      // Преобразуем PointerEvent в MouseEvent для совместимости
      const mouseEvent = new MouseEvent('mouseleave', {
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
        bubbles: true,
        cancelable: true,
      });
      this.handleMouseLeave(mouseEvent);
    };
    
    // Mouse events (для совместимости)
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseLeave);
    
    // Pointer events (для поддержки тачпада)
    // Используем passive: false для pointerdown и pointermove, чтобы можно было предотвращать стандартное поведение при рисовании
    this.canvas.addEventListener('pointerdown', this.boundHandlers.pointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.boundHandlers.pointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.boundHandlers.pointerUp, { passive: true });
    this.canvas.addEventListener('pointerleave', this.boundHandlers.pointerLeave, { passive: true });
    
    // Wheel events для зума
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    
    // Touch events для pinch-to-zoom
    this.boundHandlers.touchStart = this.handleTouchStart.bind(this);
    this.boundHandlers.touchMove = this.handleTouchMove.bind(this);
    this.boundHandlers.touchEnd = this.handleTouchEnd.bind(this);
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.boundHandlers.touchEnd, { passive: false });
    
  }

  private setupResizeObserver(): void {
    // ResizeObserver disabled for performance
  }

  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log('[CanvasChart] handleMouseDown', {
      drawingState: this.drawingState ? {
        mode: this.drawingState.mode,
        isDrawing: this.drawingState.isDrawing,
        hasStartPoint: !!this.drawingState.startPoint
      } : null,
      isDragging: this.isDragging,
      lastDragX: this.lastDragX,
      buttons: e.buttons
    });

    if (this.drawingState && this.drawingState.mode && this.drawingState.mode !== 'eraser') {
      console.log('[CanvasChart] handleMouseDown: режим рисования активен', {
        mode: this.drawingState.mode,
        isDraggingBefore: this.isDragging
      });
      
      // Предотвращаем панорамирование и стандартное поведение при рисовании
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = false;
      this.lastDragX = null;
      this.stopMomentum();
      
      const timePrice = this.pixelToTimePrice(x, y);
      console.log('[CanvasChart] handleMouseDown: преобразование координат', {
        pixelX: x,
        pixelY: y,
        rect: { width: rect.width, height: rect.height },
        bottomPadding: this.bottomPadding,
        chartAreaHeight: rect.height - this.bottomPadding,
        timePrice,
        viewport: this.viewport ? {
          minPrice: this.viewport.minPrice,
          maxPrice: this.viewport.maxPrice
        } : null
      });
      
      if (timePrice) {
        this.isDrawingMode = true;
        this.drawingStartPoint = { x, y, time: timePrice.time, price: timePrice.price };
        this.drawingState.startPoint = { x, y };
        this.drawingState.currentPoint = { x, y };
        this.drawingState.currentPath = [];
        
        if (this.drawingState.mode === 'freehand') {
          this.drawingState.currentPath.push({ x, y });
        }
        
        // Проверяем обратное преобразование
        const backToPixel = this.priceToPixel(timePrice.price);
        console.log('[CanvasChart] handleMouseDown: проверка обратного преобразования', {
          savedPrice: timePrice.price,
          backToPixelY: backToPixel,
          originalY: y,
          difference: backToPixel !== null ? Math.abs(backToPixel - y) : null,
          mode: this.drawingState.mode,
          isDrawingMode: this.isDrawingMode,
          isDragging: this.isDragging
        });
        
        this.notifyDrawingStateChange();
        this.scheduleRender('mouse-down-drawing');
      } else {
        console.warn('[CanvasChart] handleMouseDown: не удалось получить timePrice');
      }
      return;
    }

    if (this.drawingState && this.drawingState.mode === 'eraser') {
      // Не устанавливаем isDragging, чтобы предотвратить панорамирование
      // Используем прямую проверку e.buttons в handleMouseMove
      this.isDragging = false;
      this.lastDragX = null;
      this.eraserPosition = { x, y };
      this.handleEraserMove(x, y);
      this.scheduleRender('mouse-down-eraser');
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!this.drawingState || !this.drawingState.mode) {
      console.log('[CanvasChart] handleMouseDown: обычный режим - включаем панорамирование', {
        hasDrawingState: !!this.drawingState,
        mode: this.drawingState?.mode
      });
      this.isDragging = true;
      this.lastDragX = e.clientX;
      this.canvas.style.cursor = 'grabbing';
      this.velocityHistory = [];
      this.recentVelocities = [];
      this.currentVelocity = 0;
      this.stopMomentum();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;


    // ВАЖНО: Проверяем режим ластика ПЕРВЫМ, ДО всех других проверок
    // Это предотвращает панорамирование, когда выбран ластик
    if (this.drawingState && this.drawingState.mode === 'eraser') {
        buttons: e.buttons,
        eraserPosition: (() => {
          const pos = this.eraserPosition;
          // Eraser position passed to rendering
          return pos;
        })(),
        eraserRadius: this.drawingState.eraserRadius,
        linesCount: this.drawingState.lines.length
      });
      
      // Всегда сбрасываем состояние панорамирования для ластика
      this.isDragging = false;
      this.lastDragX = null;
      
      // ВСЕГДА предотвращаем стандартное поведение для ластика, чтобы избежать прокрутки графика
      e.preventDefault();
      e.stopPropagation();
      
      // ВСЕГДА устанавливаем позицию ластика, чтобы круг был виден
      this.eraserPosition = { x, y };
      
      if (e.buttons === 1) {
        // ЛКМ зажата - удаляем фигуры
        this.handleEraserMove(x, y);
        this.scheduleRender('mouse-move-eraser-dragging');
      } else {
        // ЛКМ не зажата - просто показываем позицию ластика
        this.scheduleRender('mouse-move-eraser-hover');
      }
      return;
    }

    // ВАЖНО: Проверяем режим рисования ПЕРВЫМ, ДО всех других проверок
    // Это предотвращает панорамирование, когда выбран инструмент рисования
    if (this.drawingState && this.drawingState.mode && this.drawingState.mode !== 'eraser') {
      console.log('[CanvasChart] handleMouseMove: режим рисования активен', {
        mode: this.drawingState.mode,
        isDrawingMode: this.isDrawingMode,
        hasStartPoint: !!this.drawingStartPoint,
        isDraggingBefore: this.isDragging,
        lastDragXBefore: this.lastDragX,
        buttons: e.buttons
      });
      
      // Если режим рисования активен, всегда сбрасываем состояние панорамирования
      const wasDragging = this.isDragging;
      this.isDragging = false;
      this.lastDragX = null;
      
      if (wasDragging) {
        console.log('[CanvasChart] handleMouseMove: сбросили isDragging с true на false');
      }
      
      // Если мы в процессе рисования
      if (this.isDrawingMode && this.drawingStartPoint) {
        // Предотвращаем стандартное поведение и панорамирование
        e.preventDefault();
        e.stopPropagation();
        
        this.drawingState.currentPoint = { x, y };
        
        if (this.drawingState.mode === 'freehand') {
          this.drawingState.currentPath.push({ x, y });
          
          // Логируем каждую 10-ю точку для freehand
          if (this.drawingState.currentPath.length % 10 === 0) {
            const timePrice = this.pixelToTimePrice(x, y);
            const backToPixel = timePrice ? this.priceToPixel(timePrice.price) : null;
            console.log('[CanvasChart] handleMouseMove: freehand точка', {
              pointIndex: this.drawingState.currentPath.length,
              pixelX: x,
              pixelY: y,
              timePrice,
              backToPixelY: backToPixel,
              difference: backToPixel !== null && timePrice ? Math.abs(backToPixel - y) : null
            });
          }
        }
        
        this.notifyDrawingStateChange();
        this.scheduleRender('mouse-move-drawing');
        return;
      } else {
        // Режим рисования активен, но мы еще не начали рисовать
        console.log('[CanvasChart] handleMouseMove: режим рисования активен, но не начали рисовать', {
          buttons: e.buttons
        });
        // Предотвращаем стандартное поведение, чтобы избежать прокрутки
        if (e.buttons !== 0) {
          console.log('[CanvasChart] handleMouseMove: предотвращаем стандартное поведение (кнопка нажата)');
          e.preventDefault();
          e.stopPropagation();
        }
        // Просто обновляем hover, не панорамируем
        this.updateHover(x, y);
        return;
      }
    }

    if (this.isDragging && this.lastDragX !== null) {
      console.log('[CanvasChart] handleMouseMove: ПАНОРАМИРОВАНИЕ!', {
        isDragging: this.isDragging,
        lastDragX: this.lastDragX,
        drawingState: this.drawingState ? {
          mode: this.drawingState.mode,
          isDrawing: this.drawingState.isDrawing
        } : null,
        buttons: e.buttons
      });
      
      const deltaX = e.clientX - this.lastDragX;
      if (Math.abs(deltaX) > 0.1) {
      }
      const now = performance.now();
      
      this.velocityHistory.push({ time: now, delta: deltaX });
      
      const historyWindow = 100;
      const cutoffTime = now - historyWindow;
      this.velocityHistory = this.velocityHistory.filter(v => v.time > cutoffTime);
      
      if (this.velocityHistory.length > 1) {
        const timeSpan = this.velocityHistory[this.velocityHistory.length - 1].time - this.velocityHistory[0].time;
        if (timeSpan > 0) {
          const totalDelta = this.velocityHistory.reduce((sum, v) => sum + v.delta, 0);
          this.currentVelocity = (totalDelta / timeSpan) * 16;
          
          this.recentVelocities.push({ time: now, velocity: Math.abs(this.currentVelocity) });
          const velocityWindow = 150;
          const velocityCutoffTime = now - velocityWindow;
          this.recentVelocities = this.recentVelocities.filter(v => v.time > velocityCutoffTime);
        }
      }

      this.lastDragX = e.clientX;

      const canvasWidth = rect.width;
      const oldFromIndex = this.viewport.fromIndex;
      
      this.viewport = panViewport(
        this.viewport,
        deltaX,
        canvasWidth,
        this.candles.length,
        this.panZoomConfig,
      );
      
      this.applyClamp();
      this.hasUserInteracted = true;
      this.followPrice = false;
      this.onUserInteraction?.();
      this.updateViewportPriceRange();
      this.scheduleRender('mouse-move-pan');
    } else {
      this.updateHover(x, y);
    }
  }

  private updateHover(x: number, y: number): void {
    const timeSinceCreation = Date.now() - this.creationTime;
    if (timeSinceCreation < this.HOVER_BLOCK_DURATION) {
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const index = this.viewport.fromIndex + (x / canvasWidth) * this.viewport.candlesPerScreen;
    const nearestIndex = Math.round(index);
    const newHoverIndex = (nearestIndex >= 0 && nearestIndex < this.candles.length) ? nearestIndex : null;

    const indexChanged = this.hoverIndex !== newHoverIndex;
    const needsUpdate = indexChanged || 
      this.hoverX === null || Math.abs(this.hoverX - x) > 0.5 ||
      this.hoverY === null || Math.abs(this.hoverY - y) > 0.5;

    if (needsUpdate) {
      const prevHoverIndex = this.hoverIndex;
      this.hoverIndex = newHoverIndex;
      if (newHoverIndex !== null) {
        this.hoverCandle = this.candles[newHoverIndex];
        if (!this.isDragging) {
          this.canvas.style.cursor = 'crosshair';
        }
      } else {
        this.hoverCandle = null;
        if (!this.isDragging) {
          this.canvas.style.cursor = 'default';
        }
      }
      this.hoverX = x;
      this.hoverY = y;
    }
    
    if (this.hoverUpdateRafId === null) {
      this.hoverUpdateRafId = requestAnimationFrame(() => {
        this.hoverUpdateRafId = null;
        this.scheduleRender('hover-update');
      });
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    console.log('[CanvasChart] handleMouseUp', {
      isDrawingMode: this.isDrawingMode,
      isDragging: this.isDragging,
      drawingState: this.drawingState ? {
        mode: this.drawingState.mode,
        isDrawing: this.drawingState.isDrawing
      } : null
    });
    
    // Обработка завершения работы с ластиком
    if (this.drawingState && this.drawingState.mode === 'eraser') {
      // Не сбрасываем eraserPosition здесь, чтобы круг оставался видимым при наведении
      // this.eraserPosition = null;
      // Не вызываем scheduleRender здесь, так как позиция ластика должна оставаться видимой
      return;
    }
    
    if (this.isDrawingMode && this.drawingState && this.drawingStartPoint) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const timePrice = this.pixelToTimePrice(x, y);
      
      console.log('[CanvasChart] handleMouseUp: завершение рисования', {
        endPixelX: x,
        endPixelY: y,
        startPixelX: this.drawingStartPoint.x,
        startPixelY: this.drawingStartPoint.y,
        rect: { width: rect.width, height: rect.height },
        bottomPadding: this.bottomPadding,
        chartAreaHeight: rect.height - this.bottomPadding,
        endTimePrice: timePrice,
        startTimePrice: { time: this.drawingStartPoint.time, price: this.drawingStartPoint.price },
        mode: this.drawingState.mode,
        currentPathLength: this.drawingState.currentPath?.length || 0
      });
      
      if (timePrice && this.drawingState.mode) {
        // Проверяем обратное преобразование для конечной точки
        const endBackToPixel = this.priceToPixel(timePrice.price);
        const startBackToPixel = this.priceToPixel(this.drawingStartPoint.price);
        console.log('[CanvasChart] handleMouseUp: проверка обратного преобразования', {
          endPrice: timePrice.price,
          endBackToPixelY: endBackToPixel,
          endOriginalY: y,
          endDifference: endBackToPixel !== null ? Math.abs(endBackToPixel - y) : null,
          startPrice: this.drawingStartPoint.price,
          startBackToPixelY: startBackToPixel,
          startOriginalY: this.drawingStartPoint.y,
          startDifference: startBackToPixel !== null ? Math.abs(startBackToPixel - this.drawingStartPoint.y) : null
        });
        
        this.finishDrawing(this.drawingStartPoint, { x, y, time: timePrice.time, price: timePrice.price });
      }
      
      this.isDrawingMode = false;
      this.drawingStartPoint = null;
      if (this.drawingState) {
        this.drawingState.startPoint = null;
        this.drawingState.currentPoint = null;
      }
      this.notifyDrawingStateChange();
      this.scheduleRender('mouse-up-drawing');
      return;
    }

    console.log('[CanvasChart] handleMouseUp: завершение панорамирования');
    this.isDragging = false;
    this.lastDragX = null;
    this.canvas.style.cursor = 'default';
    
    const shouldStartMomentum = this.shouldStartMomentum();
    
    if (shouldStartMomentum) {
      this.startMomentum();
    } else {
      this.currentVelocity = 0;
      this.velocityHistory = [];
      this.recentVelocities = [];
    }
  }

  private handleMouseLeave(e: MouseEvent): void {
    // Сбрасываем позицию ластика при выходе курсора
    if (this.drawingState && this.drawingState.mode === 'eraser') {
      this.eraserPosition = null;
      this.isDragging = false;
      this.lastDragX = null;
      this.scheduleRender('mouse-leave-eraser');
      return;
    }
    
    if (this.isDragging) {
      this.isDragging = false;
      this.lastDragX = null;
      
      const shouldStartMomentum = this.shouldStartMomentum();
      
      if (shouldStartMomentum) {
        this.startMomentum();
      } else {
        this.currentVelocity = 0;
        this.velocityHistory = [];
        this.recentVelocities = [];
      }
    }
    
    if (this.hoverIndex !== null) {
      this.hoverIndex = null;
      this.hoverCandle = null;
      this.hoverX = null;
      this.hoverY = null;
      this.canvas.style.cursor = 'default';
      this.scheduleRender('mouse-leave');
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    this.stopMomentum();
    this.currentVelocity = 0;
    this.velocityHistory = [];

    const rect = this.canvas.getBoundingClientRect();
    const anchorPixelX = e.clientX - rect.left;
    const canvasWidth = rect.width;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    this.viewport = zoomViewport(
      this.viewport,
      zoomFactor,
      anchorPixelX,
      canvasWidth,
      this.candles.length,
      this.panZoomConfig,
    );
    this.applyClamp();

    this.hasUserInteracted = true;
    this.followPrice = false;
    this.onUserInteraction?.();

    this.updateViewportPriceRange();
    this.scheduleRender('wheel-zoom');
  }

  private getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(touches: TouchList, rect: DOMRect): { x: number; y: number } | null {
    if (touches.length < 2) return null;
    const centerX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
    return { x: centerX, y: centerY };
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.pinchStartDistance = this.getTouchDistance(e.touches);
      this.pinchStartCenter = this.getTouchCenter(e.touches, rect);
      this.isPinching = true;
      this.stopMomentum();
      this.currentVelocity = 0;
      this.velocityHistory = [];
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.isPinching && e.touches.length === 2 && this.pinchStartDistance !== null && this.pinchStartCenter !== null) {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const currentDistance = this.getTouchDistance(e.touches);
      const currentCenter = this.getTouchCenter(e.touches, rect);
      
      if (currentDistance > 0 && this.pinchStartDistance > 0 && currentCenter) {
        const zoomFactor = currentDistance / this.pinchStartDistance;
        const canvasWidth = rect.width;
        const anchorPixelX = currentCenter.x;

        this.viewport = zoomViewport(
          this.viewport,
          zoomFactor,
          anchorPixelX,
          canvasWidth,
          this.candles.length,
          this.panZoomConfig,
        );
        this.applyClamp();

        this.hasUserInteracted = true;
        this.followPrice = false;
        this.onUserInteraction?.();

        this.updateViewportPriceRange();
        this.scheduleRender('touch-pinch-zoom');

        // Обновляем начальное расстояние для следующего кадра
        this.pinchStartDistance = currentDistance;
        this.pinchStartCenter = currentCenter;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (this.isPinching) {
      e.preventDefault();
      this.isPinching = false;
      this.pinchStartDistance = null;
      this.pinchStartCenter = null;
    }
  }

  setCandles(candles: Candle[]): void {
    this.candles = [...candles]
      .filter((candle): candle is Candle => {
        return candle !== null && 
               candle !== undefined &&
               typeof candle.openTime === 'number' &&
               typeof candle.open === 'number' &&
               typeof candle.high === 'number' &&
               typeof candle.low === 'number' &&
               typeof candle.close === 'number' &&
               Number.isFinite(candle.openTime) &&
               Number.isFinite(candle.open) &&
               Number.isFinite(candle.high) &&
               Number.isFinite(candle.low) &&
               Number.isFinite(candle.close) &&
               candle.open > 0 &&
               candle.high > 0 &&
               candle.low > 0 &&
               candle.close > 0 &&
               candle.high >= candle.low &&
               candle.high >= candle.open &&
               candle.high >= candle.close &&
               candle.low <= candle.open &&
               candle.low <= candle.close;
      })
      .sort((a, b) => a.openTime - b.openTime);
    this.hasUserInteracted = false;
    this.hasViewportInitialized = false;
    this.followPrice = true;
    const prevHoverIndex = this.hoverIndex;
    this.hoverIndex = null;
    this.hoverCandle = null;
    this.hoverX = null;
    this.hoverY = null;
    this.creationTime = Date.now();
    this.initializeViewportIfNeeded();
    if (this.hasViewportInitialized && this.candles.length > 0) {
      this.updateViewportPriceRange();
      requestAnimationFrame(() => {
        this.scheduleRender('setCandles-raf');
      });
    } else {
      this.scheduleRender('setCandles');
    }
  }
  
  prependCandles(newCandles: Candle[]): void {
    if (newCandles.length === 0) {
      return;
    }
    
    const validCandles = newCandles.filter((candle): candle is Candle => {
      return candle !== null && 
             candle !== undefined &&
             typeof candle.openTime === 'number' &&
             typeof candle.open === 'number' &&
             typeof candle.high === 'number' &&
             typeof candle.low === 'number' &&
             typeof candle.close === 'number' &&
             Number.isFinite(candle.openTime) &&
             Number.isFinite(candle.open) &&
             Number.isFinite(candle.high) &&
             Number.isFinite(candle.low) &&
             Number.isFinite(candle.close) &&
             candle.open > 0 &&
             candle.high > 0 &&
             candle.low > 0 &&
             candle.close > 0 &&
             candle.high >= candle.low &&
             candle.high >= candle.open &&
             candle.high >= candle.close &&
             candle.low <= candle.open &&
             candle.low <= candle.close;
    });
    
    if (validCandles.length === 0) {
      return;
    }
    
    const oldCandlesCount = this.candles.length;
    
    const sortedNew = [...validCandles].sort((a, b) => a.openTime - b.openTime);
    const firstNewTime = sortedNew[0].openTime;
    const lastNewTime = sortedNew[sortedNew.length - 1].openTime;
    
    const firstExistingTime = this.candles.length > 0 ? this.candles[0].openTime : null;
    const lastExistingTime = this.candles.length > 0 ? this.candles[this.candles.length - 1].openTime : null;
    
    // Фильтруем новые свечи: оставляем только те, которые раньше первой существующей свечи
    let uniqueNew = sortedNew;
    if (firstExistingTime) {
      // Оставляем только свечи, которые раньше первой существующей
      uniqueNew = sortedNew.filter(c => c.openTime < firstExistingTime);
      
      // Также фильтруем дубликаты
      const existingTimes = new Set(this.candles.map(c => c.openTime));
      uniqueNew = uniqueNew.filter(c => !existingTimes.has(c.openTime));
    } else {
      // Если нет существующих свечей, просто фильтруем дубликаты
      const existingTimes = new Set(this.candles.map(c => c.openTime));
      uniqueNew = sortedNew.filter(c => !existingTimes.has(c.openTime));
    }
    
    if (uniqueNew.length === 0) {
      return;
    }
    
    // Объединяем: сначала новые свечи (они должны быть раньше), потом существующие
    const merged = [...uniqueNew, ...this.candles];
    
    // Сортируем по времени для гарантии правильного порядка
    merged.sort((a, b) => a.openTime - b.openTime);
    
    const oldFromIndex = this.viewport.fromIndex;
    const oldToIndex = this.viewport.toIndex;
    
    const addedCount = uniqueNew.length;
    const shift = addedCount;
    
    this.candles = merged;
    
    this.viewport.fromIndex = oldFromIndex + shift;
    this.viewport.toIndex = oldToIndex + shift;
    this.viewport.centerIndex = (this.viewport.fromIndex + this.viewport.toIndex) / 2;
    
    this.lastLeftBoundaryCheck = -1;
    this.applyClamp();
    this.updateViewportPriceRange();
    this.scheduleRender('center-last-candle-internal');
  }
  
  getFirstCandleTime(): number | null {
    return this.candles.length > 0 ? this.candles[0].openTime : null;
  }

  getCandles(): Candle[] {
    return [...this.candles];
  }

  getViewport(): ViewportState | null {
    return this.viewport ? { ...this.viewport } : null;
  }

  timestampToPixel(timestamp: number): number | null {
    if (!this.viewport || this.candles.length === 0) return null;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;

    let closestIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < this.candles.length; i++) {
      const diff = Math.abs(this.candles[i].openTime - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    if (closestIndex === -1) return null;

    if (minDiff === 0 || closestIndex === 0 || closestIndex === this.candles.length - 1) {
      return xIndexToPixel(closestIndex, this.viewport, width);
    }

    const candle = this.candles[closestIndex];
    let index = closestIndex;

    if (timestamp < candle.openTime && closestIndex > 0) {
      const prevCandle = this.candles[closestIndex - 1];
      const timeDiff = candle.openTime - prevCandle.openTime;
      if (timeDiff > 0) {
        const ratio = (timestamp - prevCandle.openTime) / timeDiff;
        index = closestIndex - 1 + ratio;
      }
    } else if (timestamp > candle.openTime && closestIndex < this.candles.length - 1) {
      const nextCandle = this.candles[closestIndex + 1];
      const timeDiff = nextCandle.openTime - candle.openTime;
      if (timeDiff > 0) {
        const ratio = (timestamp - candle.openTime) / timeDiff;
        index = closestIndex + ratio;
      }
    }

    return xIndexToPixel(index, this.viewport, width);
  }

  priceToPixel(price: number): number | null {
    if (!this.viewport) return null;
    
    const rect = this.canvas.getBoundingClientRect();
    const height = rect.height;
    const chartAreaHeight = height - this.bottomPadding;
    
    const { minPrice, maxPrice } = this.viewport;
    if (maxPrice === minPrice) return chartAreaHeight / 2;
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    const pixelY = chartAreaHeight - ratio * chartAreaHeight;
    
    // Логируем только при отрисовке рисунков (когда есть drawingState с линиями)
    if (this.drawingState && this.drawingState.lines && this.drawingState.lines.length > 0) {
      console.log('[CanvasChart] priceToPixel', {
        inputPrice: price,
        height,
        bottomPadding: this.bottomPadding,
        chartAreaHeight,
        minPrice,
        maxPrice,
        ratio,
        outputPixelY: pixelY
      });
    }
    
    return pixelY;
  }

  pixelToTimePrice(x: number, y: number): { time: number; price: number } | null {
    if (!this.viewport || this.candles.length === 0) return null;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const chartAreaHeight = height - this.bottomPadding;

    const relativeX = x / width;
    const index = this.viewport.fromIndex + relativeX * this.viewport.candlesPerScreen;
    
    let time: number;
    if (index < 0) {
      const firstCandle = this.candles[0];
      const timeframeDuration = getTimeframeDurationMs(this.timeframe) ?? 60_000;
      const timeDiff = this.candles.length > 1 ? this.candles[1].openTime - firstCandle.openTime : timeframeDuration;
      time = firstCandle.openTime + index * timeDiff;
    } else if (index >= this.candles.length - 1) {
      const lastCandle = this.candles[this.candles.length - 1];
      const timeframeDuration = getTimeframeDurationMs(this.timeframe) ?? 60_000;
      const timeDiff = this.candles.length > 1 ? lastCandle.openTime - this.candles[this.candles.length - 2].openTime : timeframeDuration;
      time = lastCandle.openTime + (index - (this.candles.length - 1)) * timeDiff;
    } else {
      const floorIdx = Math.floor(index);
      const ceilIdx = Math.ceil(index);
      const floorCandle = this.candles[floorIdx];
      const ceilCandle = this.candles[ceilIdx];
      const ratio = index - floorIdx;
      time = floorCandle.openTime + (ceilCandle.openTime - floorCandle.openTime) * ratio;
    }

    // Используем chartAreaHeight вместо height для согласованности с priceToPixel
    // Преобразуем Y относительно области графика (без нижнего отступа)
    // Формула обратная к priceToPixel: y = chartAreaHeight - ratio * chartAreaHeight
    // Отсюда: ratio = (chartAreaHeight - y) / chartAreaHeight
    // Разрешаем координаты за пределами области графика (для рисования ниже линии времени)
    const { minPrice, maxPrice } = this.viewport;
    if (maxPrice === minPrice) {
      return { time, price: minPrice };
    }
    const ratio = chartAreaHeight > 0 ? (chartAreaHeight - y) / chartAreaHeight : 0;
    // Разрешаем цены за пределами minPrice/maxPrice для поддержки рисования за пределами области графика
    const price = minPrice + (maxPrice - minPrice) * ratio;

    // Логируем только при рисовании (когда есть drawingState)
    if (this.drawingState && this.drawingState.mode) {
      console.log('[CanvasChart] pixelToTimePrice', {
        inputPixelX: x,
        inputPixelY: y,
        height,
        bottomPadding: this.bottomPadding,
        chartAreaHeight,
        ratio,
        minPrice,
        maxPrice,
        outputPrice: price,
        outputTime: time
      });
    }

    return { time, price };
  }
  
  resetLeftBoundaryCheck(): void {
    this.lastLeftBoundaryCheck = -1;
    this.lastBoundaryCheckTime = 0;
  }

  upsertCandle(candle: Candle): void {
    // Проверяем, что свеча валидна
    if (!candle || 
        !Number.isFinite(candle.openTime) ||
        !Number.isFinite(candle.open) ||
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close) ||
        candle.open <= 0 ||
        candle.high <= 0 ||
        candle.low <= 0 ||
        candle.close <= 0) {
      return;
    }
    
    // Используем ActiveCandleUpdater для определения, обновлять или создавать новую свечу
    const updateResult = ActiveCandleUpdater.updateActiveCandle(
      candle,
      this.candles,
      this.timeframe
    );
    
    // Если массив пуст, добавляем первую свечу
    if (this.candles.length === 0) {
      this.candles.push(candle);
      this.updateViewportPriceRange();
      this.scheduleRender('upsertCandle-new-empty');
      return;
    }
    
    // Если нужно создать новую свечу
    if (updateResult.shouldCreateNew) {
      // Останавливаем анимацию предыдущей свечи
      this.stopActiveCandleAnimation();
      
      // Проверяем, нет ли уже свечи с таким же openTime (дубликат)
      const existingIndex = this.candles.findIndex(c => c.openTime === candle.openTime);
      if (existingIndex !== -1) {
        const existingCandle = this.candles[existingIndex];
        
        // Check if existing candle is flat (temporary placeholder)
        const isFlatCandle = (c: Candle) => {
          const range = c.high - c.low;
          const priceScale = Math.max(1e-12, Math.abs(c.close || 1));
          const relativeRange = range / priceScale;
          return relativeRange < 1e-10 && Math.abs(c.open - c.close) < 1e-10;
        };
        
        // Always replace flat temporary candles with real candles from server
        // For non-flat candles, prefer the one with more data (larger range)
        if (isFlatCandle(existingCandle) || !isFlatCandle(candle)) {
          // Replace flat candle or if new candle is real, always use it
          this.candles[existingIndex] = candle;
        } else {
          // Existing is real, new is flat - keep existing
          // (shouldn't happen, but just in case)
        }
        
        this.updateViewportPriceRange();
        this.scheduleRender('upsertCandle-update-duplicate');
        return;
      }
      
      this.candles.push(candle);
      this.candles.sort((a, b) => a.openTime - b.openTime);
      
      // Логируем пропуски во времени после добавления новой свечи
      if (process.env.NODE_ENV === 'development' && this.candles.length > 1) {
        const lastIndex = this.candles.length - 1;
        const prevCandle = this.candles[lastIndex - 1];
        const newCandle = this.candles[lastIndex];
        const timeDiff = newCandle.openTime - prevCandle.openTime;
        const timeframeDuration = getTimeframeDurationMs(this.timeframe) ?? 60_000;
        const expectedInterval = timeframeDuration;
        
        if (timeDiff > expectedInterval * 1.5) {
          const missingCandles = Math.floor(timeDiff / expectedInterval) - 1;
          console.warn('[CanvasChart] ⚠️ ПРОПУСК ВО ВРЕМЕНИ при добавлении свечи:', {
            prevTime: new Date(prevCandle.openTime).toISOString(),
            newTime: new Date(newCandle.openTime).toISOString(),
            timeDiffMs: timeDiff,
            timeDiffSeconds: (timeDiff / 1000).toFixed(1),
            expectedIntervalMs: expectedInterval,
            missingCandles,
            timeframe: this.timeframe,
          });
        }
      }
      
      this.updateViewportPriceRange();
      this.scheduleRender('upsertCandle-new');
      return;
    }
    
    // Обновляем только активную свечу с анимацией
    if (updateResult.wasUpdated && updateResult.updatedCandle && updateResult.updatedIndex !== null) {
      const candleIndex = updateResult.updatedIndex;
      const currentCandle = this.candles[candleIndex];
      const targetCandle = updateResult.updatedCandle;
      
      // Проверяем, нужно ли вообще анимировать (если значения действительно одинаковые, применяем сразу)
      // Используем очень маленький порог, чтобы анимировать почти все изменения
      const THRESHOLD = 1e-12;
      const closeDiff = Math.abs(targetCandle.close - currentCandle.close);
      const priceScale = Math.max(1e-12, Math.abs(targetCandle.close || 1));
      const relCloseDiff = closeDiff / priceScale;
      
      // Анимируем только если изменение действительно нулевое (с учетом погрешности вычислений)
      if (relCloseDiff < THRESHOLD && closeDiff < 1e-10) {
        // Изменение действительно нулевое - применяем сразу
        this.candles[candleIndex] = targetCandle;
        this.updateViewportPriceRange();
        this.scheduleRender('upsertCandle-update-instant');
        // Останавливаем анимацию, если она была запущена
        if (this.activeCandleAnimation && this.activeCandleAnimation.candleIndex === candleIndex) {
          this.stopActiveCandleAnimation();
        }
        return;
      }
      
      // ВСЕГДА запускаем анимацию для любых изменений цены
      
      // Если это та же свеча, что анимируется, обновляем целевую цену
      if (this.activeCandleAnimation && this.activeCandleAnimation.candleIndex === candleIndex) {
        // Проверяем, что это все еще последняя свеча
        const isLastCandle = candleIndex === this.candles.length - 1;
        if (!isLastCandle) {
          // Свеча больше не последняя - останавливаем анимацию и применяем значения сразу
          this.stopActiveCandleAnimation();
          this.candles[candleIndex] = targetCandle;
          this.updateViewportPriceRange();
          this.scheduleRender('upsertCandle-update-instant');
          return;
        }
        
        // Всегда перезапускаем анимацию с новыми целевыми значениями для плавности
        // Не проверяем порог - анимируем все изменения
        
        // Перезапускаем анимацию с текущих анимированных значений для плавного перехода
        const currentAnimatedClose = this.activeCandleAnimation.currentClose;
        const currentAnimatedHigh = this.activeCandleAnimation.currentHigh;
        const currentAnimatedLow = this.activeCandleAnimation.currentLow;
        
        // Вычисляем новую длительность анимации
        const priceChange = Math.abs(targetCandle.close - currentAnimatedClose);
        const priceScaleForDuration = Math.max(1e-12, Math.abs(currentAnimatedClose || 1));
        const relativeChange = priceChange / priceScaleForDuration;
        
        // Если изменение слишком мало, не перезапускаем анимацию
        const MIN_PRICE_CHANGE_THRESHOLD = 1e-6;
        if (priceChange < MIN_PRICE_CHANGE_THRESHOLD && relativeChange < 1e-8) {
          return;
        }
        
        // Длительность от 600мс до 2500мс для более плавной анимации
        // При быстрых изменениях анимация будет плавно перезапускаться к новым целям
        const duration = Math.min(2500, Math.max(600, relativeChange * 12000));
        
        // Обновляем состояние анимации с текущих значений
        this.activeCandleAnimation.startClose = currentAnimatedClose;
        this.activeCandleAnimation.currentClose = currentAnimatedClose;
        this.activeCandleAnimation.targetClose = targetCandle.close;
        this.activeCandleAnimation.startHigh = currentAnimatedHigh;
        this.activeCandleAnimation.currentHigh = currentAnimatedHigh;
        this.activeCandleAnimation.targetHigh = targetCandle.high;
        this.activeCandleAnimation.startLow = currentAnimatedLow;
        this.activeCandleAnimation.currentLow = currentAnimatedLow;
        this.activeCandleAnimation.targetLow = targetCandle.low;
        this.activeCandleAnimation.startTime = performance.now();
        this.activeCandleAnimation.duration = duration;
        
        // Убеждаемся, что анимация продолжается - перезапускаем если нужно
        if (this.activeCandleAnimationRafId === null) {
          this.activeCandleAnimationRafId = requestAnimationFrame(() => this.animateActiveCandle());
        }
      } else {
        // Начинаем новую анимацию, используя текущие значения свечи
        this.startActiveCandleAnimation(candleIndex, currentCandle, targetCandle);
      }
      
      return;
    }
    
    // Ничего не изменилось
    this.scheduleRender('upsertCandle-no-change');
  }
  
  private startActiveCandleAnimation(candleIndex: number, startCandle: Candle, targetCandle: Candle): void {
    // Останавливаем предыдущую анимацию, если она есть
    this.stopActiveCandleAnimation();
    
    // Проверяем, что свеча все еще существует и имеет правильный индекс
    if (candleIndex < 0 || candleIndex >= this.candles.length) {
      return;
    }
    
    // Используем актуальные значения из массива свечей, а не переданные
    const actualCandle = this.candles[candleIndex];
    
    // ВСЕГДА запускаем анимацию для любых изменений цены
    // Вычисляем адаптивную длительность анимации
    const priceChange = Math.abs(targetCandle.close - actualCandle.close);
    const priceScale = Math.max(1e-12, Math.abs(actualCandle.close || 1));
    const relativeChange = priceChange / priceScale;
    // Длительность от 600мс до 2500мс в зависимости от изменения для более плавной анимации
    // Минимум 600мс гарантирует заметную плавность даже для малых изменений
    // Максимум 2500мс обеспечивает очень плавную анимацию больших изменений
    // При быстрых изменениях анимация будет плавно перезапускаться к новым целям
    const duration = Math.min(2500, Math.max(600, relativeChange * 12000));
    
    this.activeCandleAnimation = {
      candleIndex,
      startClose: actualCandle.close,
      targetClose: targetCandle.close,
      currentClose: actualCandle.close,
      startHigh: actualCandle.high,
      targetHigh: targetCandle.high,
      currentHigh: actualCandle.high,
      startLow: actualCandle.low,
      targetLow: targetCandle.low,
      currentLow: actualCandle.low,
      startTime: performance.now(),
      duration,
    };
    
    this.animateActiveCandle();
  }
  
  private stopActiveCandleAnimation(): void {
    if (this.activeCandleAnimationRafId !== null) {
      cancelAnimationFrame(this.activeCandleAnimationRafId);
      this.activeCandleAnimationRafId = null;
    }
    
    // Применяем финальные значения, если анимация была прервана
    if (this.activeCandleAnimation) {
      const { candleIndex, targetClose, targetHigh, targetLow } = this.activeCandleAnimation;
      if (candleIndex >= 0 && candleIndex < this.candles.length) {
        const candle = this.candles[candleIndex];
        candle.close = targetClose;
        candle.high = targetHigh;
        candle.low = targetLow;
      }
    }
    
    this.activeCandleAnimation = null;
  }
  
  // Easing функция для очень плавной анимации (ease-out exponential)
  private easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  private animateActiveCandle(): void {
    if (!this.activeCandleAnimation) {
      return;
    }
    
    const { candleIndex, targetClose, targetHigh, targetLow, startClose, startHigh, startLow, startTime, duration } = this.activeCandleAnimation;
    
    if (candleIndex < 0 || candleIndex >= this.candles.length) {
      this.stopActiveCandleAnimation();
      return;
    }
    
    const candle = this.candles[candleIndex];
    
    // Проверяем, что это все еще последняя свеча (активная свеча)
    // Если индекс изменился или свеча больше не последняя, останавливаем анимацию
    const isLastCandle = candleIndex === this.candles.length - 1;
    if (!isLastCandle) {
      this.stopActiveCandleAnimation();
      return;
    }
    
    // Вычисляем прогресс анимации на основе времени
    const currentTime = performance.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Используем очень плавную easing функцию
    const easedProgress = this.easeOutExpo(progress);
    
    // Интерполируем значения с использованием easing
    const closeDiff = targetClose - startClose;
    const highDiff = targetHigh - startHigh;
    const lowDiff = targetLow - startLow;
    
    this.activeCandleAnimation.currentClose = startClose + closeDiff * easedProgress;
    this.activeCandleAnimation.currentHigh = startHigh + highDiff * easedProgress;
    this.activeCandleAnimation.currentLow = startLow + lowDiff * easedProgress;
    
    // Проверяем завершение анимации
    if (progress >= 1) {
      // Анимация завершена - устанавливаем финальные значения
      this.activeCandleAnimation.currentClose = targetClose;
      this.activeCandleAnimation.currentHigh = targetHigh;
      this.activeCandleAnimation.currentLow = targetLow;
      
      candle.close = targetClose;
      candle.high = targetHigh;
      candle.low = targetLow;
      
      this.updateViewportPriceRange();
      this.scheduleRender('upsertCandle-animate-complete');
      
      // Останавливаем анимацию
      this.stopActiveCandleAnimation();
      return;
    }
    
    // Обновляем свечу с анимированными значениями
    candle.close = this.activeCandleAnimation.currentClose;
    
    // Обновляем high и low динамически во время анимации для плавности
    // High должен быть максимумом между стартовым значением и текущей анимированной ценой
    candle.high = Math.max(startHigh, this.activeCandleAnimation.currentHigh, candle.close);
    // Low должен быть минимумом между стартовым значением и текущей анимированной ценой
    candle.low = Math.min(startLow, this.activeCandleAnimation.currentLow, candle.close);
    
    this.updateViewportPriceRange();
    
    // Вызываем рендер напрямую во время анимации, минуя debouncing в scheduleRender
    // Это гарантирует, что каждый кадр анимации будет отрисован
    this.render('upsertCandle-animate');
    
    // Продолжаем анимацию
    this.activeCandleAnimationRafId = requestAnimationFrame(() => this.animateActiveCandle());
  }

  setTimeframe(tf: Timeframe, candles: Candle[]): void {
    this.timeframe = tf;
    this.candles = [...candles]
      .filter((candle): candle is Candle => {
        return candle !== null && 
               candle !== undefined &&
               typeof candle.openTime === 'number' &&
               typeof candle.open === 'number' &&
               typeof candle.high === 'number' &&
               typeof candle.low === 'number' &&
               typeof candle.close === 'number' &&
               Number.isFinite(candle.openTime) &&
               Number.isFinite(candle.open) &&
               Number.isFinite(candle.high) &&
               Number.isFinite(candle.low) &&
               Number.isFinite(candle.close) &&
               candle.open > 0 &&
               candle.high > 0 &&
               candle.low > 0 &&
               candle.close > 0 &&
               candle.high >= candle.low &&
               candle.high >= candle.open &&
               candle.high >= candle.close &&
               candle.low <= candle.open &&
               candle.low <= candle.close;
      })
      .sort((a, b) => a.openTime - b.openTime);

    this.hasUserInteracted = false;
    this.hasViewportInitialized = false;
    this.followPrice = true;
    const prevHoverIndex = this.hoverIndex;
    this.hoverIndex = null;
    this.hoverCandle = null;
    this.hoverX = null;
    this.hoverY = null;
    this.creationTime = Date.now();

    this.initializeViewportIfNeeded();
    this.scheduleRender('setTimeframe');
  }

  setActiveIndicators(indicators: string[]): void {
    this.activeIndicators = [...indicators];
    this.scheduleRender('setActiveIndicators');
  }

  updateDrawingState(state: DrawingState): void {
    const prevMode = this.drawingState?.mode;
    const isEraserMode = state.mode === 'eraser';
    
    this.drawingState = { ...state };
    
    if (prevMode !== state.mode) {
      this.isDrawingMode = false;
      this.drawingStartPoint = null;
      if (this.drawingState) {
        this.drawingState.startPoint = null;
        this.drawingState.currentPoint = null;
        this.drawingState.currentPath = [];
      }
    }
    this.scheduleRender('updateDrawingState');
  }

  setChartView(view: ChartView): void {
    this.chartView = view;
    this.scheduleRender('setChartView');
  }

  setBottomPadding(padding: number): void {
    this.bottomPadding = padding;
    this.scheduleRender('setBottomPadding');
  }

  setHoveredButton(button: 'buy' | 'sell' | null): void {
    this.hoveredButton = button;
    this.scheduleRender('setHoveredButton');
  }

  getPriceAtMousePosition(): number | null {
    if (!this.hoverX || !this.hoverY || !this.viewport || this.candles.length === 0) {
      return null;
    }
    const result = this.pixelToTimePrice(this.hoverX, this.hoverY);
    return result?.price ?? null;
  }

  getTimeAtMousePosition(): number | null {
    if (!this.hoverX || !this.hoverY || !this.viewport || this.candles.length === 0) {
      return null;
    }
    const result = this.pixelToTimePrice(this.hoverX, this.hoverY);
    return result?.time ?? null;
  }

  getAnimatedPrice(): number | null {
    if (this.candles.length > 0) {
      return this.candles[this.candles.length - 1].close;
    }
    return null;
  }

  setFollowPrice(enabled: boolean): void {
    if (this.followPrice === enabled) return;
    this.followPrice = enabled;
    if (enabled && !this.hasUserInteracted) {
      this.stickToRightInternal();
      this.scheduleRender('setFollowPrice-enabled');
    } else {
      this.scheduleRender('setFollowPrice-disabled');
    }
  }

  private stickToRightInternal(): void {
    const candlesCount = this.candles.length;
    if (candlesCount === 0) return;

    const width = this.viewport.candlesPerScreen;
    const lastIndex = candlesCount - 1;
    const o = this.panZoomConfig.overshootCandles;

    const maxFrom = lastIndex + o * width - width;
    const newFrom = maxFrom;
    const newTo = newFrom + width;

    this.viewport.fromIndex = newFrom;
    this.viewport.toIndex = newTo;
    this.viewport.centerIndex = (newFrom + newTo) / 2;

    this.applyClamp();
  }

  stickToRight(): void {
    this.stickToRightInternal();
    this.hasUserInteracted = true;
    this.scheduleRender('stickToRight');
  }
  
  resetUserInteractionAndFollow(): void {
    this.hasUserInteracted = false;
    this.followPrice = true;
    this.stickToRightInternal();
    this.scheduleRender('resetUserInteractionAndFollow');
  }
  
  private animatePriceLine(): void {
    // Останавливаем анимацию если вкладка скрыта
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      this.priceLineAnimationRafId = null;
      return;
    }
    
    if (!this.priceLineAnimation || this.chartView !== 'candles') {
      this.priceLineAnimationRafId = null;
      return;
    }

    const threshold = 0.000001;
    const smoothingFactor = 0.02;
    
    const priceDiff = this.priceLineAnimation.targetPrice - this.priceLineAnimation.currentPrice;
    
    if (Math.abs(priceDiff) > threshold) {
      this.priceLineAnimation.currentPrice += priceDiff * smoothingFactor;
      this.scheduleRender('animatePriceLine');
      this.priceLineAnimationRafId = requestAnimationFrame(() => this.animatePriceLine());
    } else {
      this.priceLineAnimation.currentPrice = this.priceLineAnimation.targetPrice;
      this.scheduleRender('animatePriceLine-end');
      this.priceLineAnimation = null;
      this.priceLineAnimationRafId = null;
    }
  }
  

  private notifyDrawingStateChange(): void {
    if (this.drawingState && this.onDrawingStateChange) {
      this.onDrawingStateChange({ ...this.drawingState });
    }
  }

  private finishDrawing(start: { x: number; y: number; time: number; price: number }, end: { x: number; y: number; time: number; price: number }): void {
    if (!this.drawingState || !this.drawingState.mode) return;

    const mode = this.drawingState.mode;
    const color = this.drawingState.color;
    const id = `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let lineType: 'straight' | 'freehand' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone';
    let endTime = end.time;
    let endPrice = end.price;
    let points: Array<{ time: number; price: number }> | undefined;
    let text: string | undefined;
    let fibonacciLevels: number[] | undefined;

    if (mode === 'horizontal') {
      lineType = 'horizontal';
      endTime = start.time;
      endPrice = start.price;
    } else if (mode === 'vertical') {
      lineType = 'vertical';
      endTime = end.time;
      endPrice = start.price;
    } else if (mode === 'freehand') {
      lineType = 'freehand';
      if (this.drawingState.currentPath && this.drawingState.currentPath.length > 0) {
        console.log('[CanvasChart] finishDrawing: преобразование freehand точек', {
          totalPoints: this.drawingState.currentPath.length,
          firstPoint: this.drawingState.currentPath[0],
          lastPoint: this.drawingState.currentPath[this.drawingState.currentPath.length - 1]
        });
        
        points = this.drawingState.currentPath.map((p, index) => {
          const tp = this.pixelToTimePrice(p.x, p.y);
          const result = tp ? { time: tp.time, price: tp.price } : { time: start.time, price: start.price };
          
          // Логируем первые 3 и последние 3 точки
          if (index < 3 || index >= this.drawingState.currentPath.length - 3) {
            const backToPixel = this.priceToPixel(result.price);
            console.log(`[CanvasChart] finishDrawing: freehand точка ${index}`, {
              pixelX: p.x,
              pixelY: p.y,
              savedPrice: result.price,
              backToPixelY: backToPixel,
              difference: backToPixel !== null ? Math.abs(backToPixel - p.y) : null
            });
          }
          
          return result;
        });
        
        console.log('[CanvasChart] finishDrawing: freehand точки преобразованы', {
          totalPoints: points.length,
          firstPoint: points[0],
          lastPoint: points[points.length - 1]
        });
      }
    } else if (mode === 'line') {
      lineType = 'straight';
    } else if (mode === 'rectangle') {
      lineType = 'rectangle';
    } else if (mode === 'circle') {
      lineType = 'circle';
    } else if (mode === 'arrow') {
      lineType = 'arrow';
    } else if (mode === 'text') {
      lineType = 'text';
      text = prompt('Введите текст:') || '';
      if (!text) return;
    } else if (mode === 'parallel') {
      lineType = 'parallel';
    } else if (mode === 'fibonacci') {
      lineType = 'fibonacci';
      fibonacciLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    } else if (mode === 'channel') {
      lineType = 'channel';
    } else if (mode === 'trendline') {
      lineType = 'trendline';
    } else if (mode === 'zone') {
      lineType = 'zone';
    } else {
      lineType = 'straight';
    }

    const newLine = {
      id,
      type: lineType,
      startTime: start.time,
      startPrice: start.price,
      endTime,
      endPrice,
      points,
      color,
      timestamp: Date.now(),
      text,
      fibonacciLevels,
    };

    // Проверяем, как будет отрисовываться сохранённый рисунок
    const startRenderY = this.priceToPixel(start.price);
    const endRenderY = this.priceToPixel(endPrice);
    console.log('[CanvasChart] finishDrawing: сохранение рисунка', {
      lineId: id,
      lineType,
      savedStart: { time: start.time, price: start.price, pixelX: start.x, pixelY: start.y },
      savedEnd: { time: endTime, price: endPrice, pixelX: end.x, pixelY: end.y },
      renderStartY: startRenderY,
      renderEndY: endRenderY,
      originalStartY: start.y,
      originalEndY: end.y,
      startYDifference: startRenderY !== null ? Math.abs(startRenderY - start.y) : null,
      endYDifference: endRenderY !== null ? Math.abs(endRenderY - end.y) : null,
      pointsCount: points?.length || 0,
      viewport: this.viewport ? {
        minPrice: this.viewport.minPrice,
        maxPrice: this.viewport.maxPrice
      } : null
    });

    this.drawingState.lines.push(newLine);
    this.notifyDrawingStateChange();
  }

  private handleEraserMove(x: number, y: number): void {
    if (!this.drawingState) {
      return;
    }

    const eraserRadius = this.drawingState.eraserRadius || 10;
    const linesToRemove: string[] = [];
    
    const hasTimestampToPixel = typeof this.timestampToPixel === 'function';
    const hasPriceToPixel = typeof this.priceToPixel === 'function';
    

    for (const line of this.drawingState.lines) {
      let shouldRemove = false;

      if (line.type === 'straight' || line.type === 'horizontal' || line.type === 'vertical' || line.type === 'arrow') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const distance = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        shouldRemove = distance < eraserRadius;
        
      } else if (line.type === 'freehand' && line.points && line.points.length > 0) {
        // Проверяем расстояние до всех сегментов линии, а не только до точек
        for (let i = 0; i < line.points.length - 1; i++) {
          const point1 = line.points[i];
          const point2 = line.points[i + 1];
          const px1 = this.timestampToPixel?.(point1.time) ?? 0;
          const py1 = this.priceToPixel?.(point1.price) ?? 0;
          const px2 = this.timestampToPixel?.(point2.time) ?? 0;
          const py2 = this.priceToPixel?.(point2.price) ?? 0;
          
          const distance = this.distanceToLineSegment(x, y, px1, py1, px2, py2);
          if (distance < eraserRadius) {
            shouldRemove = true;
            break;
          }
        }
      } else if (line.type === 'rectangle') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        
        const closestX = Math.max(rectX, Math.min(x, rectX + rectWidth));
        const closestY = Math.max(rectY, Math.min(y, rectY + rectHeight));
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'circle') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radius = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) / 2;
        
        const distanceToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const distanceToEdge = Math.abs(distanceToCenter - radius);
        shouldRemove = distanceToEdge < eraserRadius;
      } else if (line.type === 'text') {
        const textX = this.timestampToPixel?.(line.startTime) ?? 0;
        const textY = this.priceToPixel?.(line.startPrice) ?? 0;
        const distance = Math.sqrt((x - textX) ** 2 + (y - textY) ** 2);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'parallel') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        // Проверяем расстояние до основной линии
        const distance1 = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        if (distance1 < eraserRadius) {
          shouldRemove = true;
        } else {
          // Проверяем расстояние до параллельной линии
          const dx = endX - startX;
          const dy = endY - startY;
          const parallelStartX = startX + dx * 0.3;
          const parallelStartY = startY + dy * 0.3;
          const parallelEndX = endX + dx * 0.3;
          const parallelEndY = endY + dy * 0.3;
          const distance2 = this.distanceToLineSegment(x, y, parallelStartX, parallelStartY, parallelEndX, parallelEndY);
          shouldRemove = distance2 < eraserRadius;
        }
      } else if (line.type === 'fibonacci') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const priceRange = Math.abs(line.endPrice - line.startPrice);
        const isUp = line.endPrice > line.startPrice;
        const basePrice = isUp ? line.startPrice : line.endPrice;
        const levels = line.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        
        // Проверяем расстояние до любой из горизонтальных линий Фибоначчи
        for (const level of levels) {
          const price = basePrice + priceRange * level;
          const lineY = this.priceToPixel?.(price) ?? 0;
          const distance = this.distanceToLineSegment(x, y, startX, lineY, endX, lineY);
          if (distance < eraserRadius) {
            shouldRemove = true;
            break;
          }
        }
      } else if (line.type === 'channel') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const dx = endX - startX;
        const dy = endY - startY;
        
        // Проверяем расстояние до трех параллельных линий канала
        const distance1 = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        const distance2 = this.distanceToLineSegment(x, y, startX, startY + dy, endX, endY + dy);
        const distance3 = this.distanceToLineSegment(x, y, startX, startY - dy, endX, endY - dy);
        
        shouldRemove = distance1 < eraserRadius || distance2 < eraserRadius || distance3 < eraserRadius;
      } else if (line.type === 'trendline') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const distance = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'zone') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        
        const closestX = Math.max(rectX, Math.min(x, rectX + rectWidth));
        const closestY = Math.max(rectY, Math.min(y, rectY + rectHeight));
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        shouldRemove = distance < eraserRadius;
      }

      if (shouldRemove) {
        linesToRemove.push(line.id);
      }
    }


    if (linesToRemove.length > 0) {
      const beforeCount = this.drawingState.lines.length;
      this.drawingState.lines = this.drawingState.lines.filter(line => !linesToRemove.includes(line.id));
      const afterCount = this.drawingState.lines.length;
      this.notifyDrawingStateChange();
    }
  }

  private handleEraserClick(x: number, y: number): void {
    if (!this.drawingState) return;

    const eraserRadius = this.drawingState.eraserRadius || 10;
    const linesToRemove: string[] = [];

    for (const line of this.drawingState.lines) {
      let shouldRemove = false;

      if (line.type === 'straight' || line.type === 'horizontal' || line.type === 'vertical' || line.type === 'arrow') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const distance = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'freehand' && line.points && line.points.length > 0) {
        // Проверяем расстояние до всех сегментов линии, а не только до точек
        for (let i = 0; i < line.points.length - 1; i++) {
          const point1 = line.points[i];
          const point2 = line.points[i + 1];
          const px1 = this.timestampToPixel?.(point1.time) ?? 0;
          const py1 = this.priceToPixel?.(point1.price) ?? 0;
          const px2 = this.timestampToPixel?.(point2.time) ?? 0;
          const py2 = this.priceToPixel?.(point2.price) ?? 0;
          
          const distance = this.distanceToLineSegment(x, y, px1, py1, px2, py2);
          if (distance < eraserRadius) {
            shouldRemove = true;
            break;
          }
        }
      } else if (line.type === 'rectangle') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        
        const closestX = Math.max(rectX, Math.min(x, rectX + rectWidth));
        const closestY = Math.max(rectY, Math.min(y, rectY + rectHeight));
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'circle') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radius = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) / 2;
        
        const distanceToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const distanceToEdge = Math.abs(distanceToCenter - radius);
        shouldRemove = distanceToEdge < eraserRadius;
      } else if (line.type === 'text') {
        const textX = this.timestampToPixel?.(line.startTime) ?? 0;
        const textY = this.priceToPixel?.(line.startPrice) ?? 0;
        const distance = Math.sqrt((x - textX) ** 2 + (y - textY) ** 2);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'parallel') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        // Проверяем расстояние до основной линии
        const distance1 = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        if (distance1 < eraserRadius) {
          shouldRemove = true;
        } else {
          // Проверяем расстояние до параллельной линии
          const dx = endX - startX;
          const dy = endY - startY;
          const parallelStartX = startX + dx * 0.3;
          const parallelStartY = startY + dy * 0.3;
          const parallelEndX = endX + dx * 0.3;
          const parallelEndY = endY + dy * 0.3;
          const distance2 = this.distanceToLineSegment(x, y, parallelStartX, parallelStartY, parallelEndX, parallelEndY);
          shouldRemove = distance2 < eraserRadius;
        }
      } else if (line.type === 'fibonacci') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const priceRange = Math.abs(line.endPrice - line.startPrice);
        const isUp = line.endPrice > line.startPrice;
        const basePrice = isUp ? line.startPrice : line.endPrice;
        const levels = line.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        
        // Проверяем расстояние до любой из горизонтальных линий Фибоначчи
        for (const level of levels) {
          const price = basePrice + priceRange * level;
          const lineY = this.priceToPixel?.(price) ?? 0;
          const distance = this.distanceToLineSegment(x, y, startX, lineY, endX, lineY);
          if (distance < eraserRadius) {
            shouldRemove = true;
            break;
          }
        }
      } else if (line.type === 'channel') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const dx = endX - startX;
        const dy = endY - startY;
        
        // Проверяем расстояние до трех параллельных линий канала
        const distance1 = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        const distance2 = this.distanceToLineSegment(x, y, startX, startY + dy, endX, endY + dy);
        const distance3 = this.distanceToLineSegment(x, y, startX, startY - dy, endX, endY - dy);
        
        shouldRemove = distance1 < eraserRadius || distance2 < eraserRadius || distance3 < eraserRadius;
      } else if (line.type === 'trendline') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const distance = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        shouldRemove = distance < eraserRadius;
      } else if (line.type === 'zone') {
        const startX = this.timestampToPixel?.(line.startTime) ?? 0;
        const startY = this.priceToPixel?.(line.startPrice) ?? 0;
        const endX = this.timestampToPixel?.(line.endTime) ?? 0;
        const endY = this.priceToPixel?.(line.endPrice) ?? 0;
        
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        
        const closestX = Math.max(rectX, Math.min(x, rectX + rectWidth));
        const closestY = Math.max(rectY, Math.min(y, rectY + rectHeight));
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        shouldRemove = distance < eraserRadius;
      }

      if (shouldRemove) {
        linesToRemove.push(line.id);
      }
    }

    if (linesToRemove.length > 0) {
      this.drawingState.lines = this.drawingState.lines.filter(line => !linesToRemove.includes(line.id));
      this.notifyDrawingStateChange();
      this.scheduleRender('eraser-remove-lines');
    }
  }

  private distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private getAnimatedCandles(): Candle[] {
    return this.candles;
  }

  private centerLastCandleInternal(): void {
    const candlesCount = this.candles.length;
    if (candlesCount === 0) return;

    const width = this.viewport.candlesPerScreen;
    const lastIndex = candlesCount - 1;

    const newFrom = lastIndex - width / 2;
    const newTo = newFrom + width;

    this.viewport.fromIndex = newFrom;
    this.viewport.toIndex = newTo;
    this.viewport.centerIndex = (newFrom + newTo) / 2;

    this.applyClamp();
  }

  centerLastCandle(): void {
    this.centerLastCandleInternal();
    this.hasUserInteracted = true;
    this.scheduleRender('centerLastCandle');
  }

  redraw(): void {
    this.updateViewportPriceRange();
    this.scheduleRender('redraw');
  }

  private scheduleRender(reason: string = 'unknown'): void {
    // Проверяем видимость страницы - не рендерим, если страница скрыта
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastRender = now - this.lastRenderTime;
    
    // Если уже запланирован рimage.pngендер или последний рендер был совсем недавно, пропускаем
    if (this.rafId !== null || this.pendingRenderTimeout !== null) {
      return;
    }
    
    // Debounce: если последний рендер был очень недавно, откладываем следующий
    if (timeSinceLastRender < this.RENDER_DEBOUNCE_MS) {
      const delay = this.RENDER_DEBOUNCE_MS - timeSinceLastRender;
      this.pendingRenderTimeout = window.setTimeout(() => {
        this.pendingRenderTimeout = null;
        this.render(reason);
      }, delay);
      return;
    }
    
    // Вызываем рендер сразу
    this.render(reason);
  }
  
  private render(reason: string = 'unknown'): void {
    // Проверяем видимость страницы - не рендерим, если страница скрыта
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    
    // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем rafId ПЕРВЫМ делом, ДО любых других операций
    // Это предотвращает race condition при множественных вызовах
    if (this.rafId !== null) {
      return;
    }
    
    // Debounce: Если последний рендер был очень недавно, откладываем через setTimeout
    const now = Date.now();
    const timeSinceLastRender = now - this.lastRenderTime;
    if (timeSinceLastRender > 0 && timeSinceLastRender < this.RENDER_DEBOUNCE_MS) {
      const delay = this.RENDER_DEBOUNCE_MS - timeSinceLastRender;
      // Используем setTimeout для отложенного рендера вместо немедленного requestAnimationFrame
      if (this.pendingRenderTimeout !== null) {
        clearTimeout(this.pendingRenderTimeout);
      }
      this.pendingRenderTimeout = window.setTimeout(() => {
        this.pendingRenderTimeout = null;
        // Пропускаем проверку debounce при вызове из setTimeout, так как достаточно времени уже прошло
        this.performRender();
      }, delay);
      return;
    }
    
    this.performRender();
  }
  
  private performRender(): void {
    // Проверяем видимость страницы еще раз перед фактическим рендерингом
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    
    // Проверяем rafId еще раз для защиты от race condition
    if (this.rafId !== null) {
      return;
    }
    
    this.rafId = requestAnimationFrame(() => {
      
      // Сбрасываем флаг перед началом рендеринга нового кадра
      this.lastPriceRangeUpdateInRender = null;
      this.rafId = null;
      this.lastRenderTime = Date.now(); // Обновляем время последнего рендера
      
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;
      
      if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
      }
      
      if (this.candles.length > 0 && this.hasViewportInitialized && !this.isUpdatingViewportInRender) {
        const { minPrice, maxPrice } = this.viewport;
        const needsUpdate = !Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice === maxPrice || (minPrice === 0 && maxPrice === 0) || (minPrice === 0 && maxPrice === 100);
        
        // Проверяем, не вызывали ли мы уже updateViewportPriceRange с теми же значениями в этом кадре
        const wasUpdatedThisFrame = this.lastPriceRangeUpdateInRender !== null && 
          this.lastPriceRangeUpdateInRender.minPrice === minPrice && 
          this.lastPriceRangeUpdateInRender.maxPrice === maxPrice;
        
        if (needsUpdate && !wasUpdatedThisFrame) {
          this.isUpdatingViewportInRender = true;
          const beforeMin = this.viewport.minPrice;
          const beforeMax = this.viewport.maxPrice;
          this.updateViewportPriceRange();
          const afterMin = this.viewport.minPrice;
          const afterMax = this.viewport.maxPrice;
          
          // Сохраняем значения после обновления, чтобы не вызывать повторно
          if (beforeMin === afterMin && beforeMax === afterMax) {
            this.lastPriceRangeUpdateInRender = { minPrice: afterMin, maxPrice: afterMax };
          } else {
            this.lastPriceRangeUpdateInRender = null;
          }
          
          this.isUpdatingViewportInRender = false;
        } else if (!needsUpdate) {
          // Сбрасываем флаг, если значения валидны
          this.lastPriceRangeUpdateInRender = null;
        }
        
        // Проверяем левую границу при каждом рендере, если пользователь панорамирует
        // Но только если мы не обновляем viewport в этом же кадре
        if (!this.followPrice && !this.isUpdatingViewportInRender) {
          this.checkLeftBoundary();
        }
      }

      const candlesToRender = this.getAnimatedCandles();
      
      renderChart({
        ctx: this.ctx,
        width,
        height,
        candles: candlesToRender,
        viewport: this.viewport,
        timeframe: this.timeframe,
        hoverIndex: this.hoverIndex,
        hoverCandle: this.hoverCandle,
        hoverX: this.hoverX,
        hoverY: this.hoverY,
        backgroundImage: this.backgroundImage,
        currentTime: this.getCurrentTime ? this.getCurrentTime() : (this.getServerTime ? this.getServerTime() : getServerTime()),
        activeIndicators: this.activeIndicators,
        drawingState: this.drawingState,
        timestampToPixel: (timestamp: number) => this.timestampToPixel(timestamp),
        priceToPixel: (price: number) => this.priceToPixel(price),
        eraserPosition: (() => {
          const pos = this.eraserPosition;
          // Eraser position passed to rendering
          return pos;
        })(),
        chartView: this.chartView,
        realCandles: this.candles,
        animatedPrice: this.candles.length > 0 ? this.candles[this.candles.length - 1].close : null,
        hoveredButton: this.hoveredButton,
        bottomPadding: this.bottomPadding,
      });
    });
  }

  private startMomentum(): void {
    this.stopMomentum();
    
    let lastPriceRangeUpdate = 0;
    const priceRangeUpdateInterval = 100;
    
    const animate = () => {
      // Останавливаем анимацию если вкладка скрыта
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        this.momentumRafId = null;
        return;
      }
      
      if (Math.abs(this.currentVelocity) < this.minVelocity) {
        this.currentVelocity = 0;
        this.velocityHistory = [];
        this.momentumRafId = null;
        this.updateViewportPriceRange();
        this.scheduleRender('momentum-end');
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      
      this.viewport = panViewport(
        this.viewport,
        this.currentVelocity,
        canvasWidth,
        this.candles.length,
        this.panZoomConfig,
      );
      
      this.applyClamp();
      // Дополнительная проверка левой границы после панорамирования с инерцией
      this.checkLeftBoundary();
      
      const now = performance.now();
      if (now - lastPriceRangeUpdate >= priceRangeUpdateInterval) {
        this.updateViewportPriceRange();
        lastPriceRangeUpdate = now;
      }
      
      this.scheduleRender('momentum-animation');

      this.currentVelocity *= this.friction;
      
      this.checkLeftBoundary();
      
      this.momentumRafId = requestAnimationFrame(animate);
    };

    this.momentumRafId = requestAnimationFrame(animate);
  }

  private shouldStartMomentum(): boolean {
    const absVelocity = Math.abs(this.currentVelocity);
    
    if (absVelocity < this.minVelocityForMomentum) {
      return false;
    }
    
    if (this.recentVelocities.length < 3) {
      return absVelocity >= this.minVelocityForMomentum;
    }
    
    const recent = this.recentVelocities.slice(-3);
    const velocities = recent.map(v => v.velocity);
    const avgRecent = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    
    if (avgRecent < this.minVelocityForMomentum) {
      return false;
    }
    
    const isDecelerating = velocities.length >= 2 && velocities[velocities.length - 1] < velocities[0] * 0.5;
    
    if (isDecelerating && absVelocity < this.minVelocityForMomentum * 1.5) {
      return false;
    }
    
    return true;
  }

  private stopMomentum(): void {
    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId);
      this.momentumRafId = null;
    }
  }

  private startCountdownTimer(): void {
    if (this.countdownTimerInterval !== null) {
      clearInterval(this.countdownTimerInterval);
    }
    
    this.countdownTimerInterval = window.setInterval(() => {
      // ВСЕГДА используем время из Redux для вычисления времени окончания свечи
      // Это гарантирует, что все пользователи видят одинаковое время окончания активной свечи
      const currentTime = this.getCurrentTime ? this.getCurrentTime() : (this.getServerTime ? this.getServerTime() : getServerTime());
      
      if (this.candles.length > 0) {
        const timeframeDuration = getTimeframeDurationMs(this.timeframe) ?? 60_000;
        const lastCandle = this.candles[this.candles.length - 1];
        const lastCandleEndTime = lastCandle.openTime + timeframeDuration;
        const timeUntilNewCandle = lastCandleEndTime - currentTime;
        
        // DISABLED: Create new candle immediately when period starts
        // This is disabled to test behavior without client-side candle creation
        // New candles will be created only when received from server via WebSocket
        /*
        // OPTIMIZATION: Create new candle immediately when period starts or is about to start
        // Increased threshold to 200ms to account for rendering delay and ensure candle appears before 00:00
        // Also check if we're past the period end (negative timeUntilNewCandle)
        if (timeUntilNewCandle <= 200 || timeUntilNewCandle < 0) {
          const expectedNextCandleTime = lastCandle.openTime + timeframeDuration;
          // Выравниваем время по таймфрейму на основе времени из Redux
          const alignedCurrentTime = Math.floor(currentTime / timeframeDuration) * timeframeDuration;
          
          let newCandleOpenTime: number;
          if (alignedCurrentTime >= expectedNextCandleTime) {
            newCandleOpenTime = alignedCurrentTime;
          } else {
            newCandleOpenTime = expectedNextCandleTime;
          }
          
          // Find the last REAL candle (not a flat temporary one)
          // A flat candle is one where open=close=high=low (temporary placeholder)
          const isFlatCandle = (c: Candle) => {
            const range = c.high - c.low;
            const priceScale = Math.max(1e-12, Math.abs(c.close || 1));
            const relativeRange = range / priceScale;
            return relativeRange < 1e-10 && Math.abs(c.open - c.close) < 1e-10;
          };
          
          // Find last non-flat candle to get the real close price
          let realLastCandle = lastCandle;
          for (let i = this.candles.length - 1; i >= 0; i--) {
            if (!isFlatCandle(this.candles[i])) {
              realLastCandle = this.candles[i];
              break;
            }
          }
          
          const currentPrice = realLastCandle.close;
          
          const newCandle: Candle = {
            openTime: newCandleOpenTime,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
          };
          
          const existingIdx = this.candles.findIndex((c) => c.openTime === newCandleOpenTime);
          if (existingIdx !== -1) {
            // If there's already a candle at this time, check if it's flat and replace it
            const existingCandle = this.candles[existingIdx];
            if (isFlatCandle(existingCandle)) {
              // Replace flat temporary candle with new one (will be updated by server data)
              this.candles[existingIdx] = newCandle;
              this.updateViewportPriceRange();
              this.scheduleRender('new-candle-replaced-flat');
            }
            // If existing candle is not flat, it's a real candle from server, don't replace
          } else {
            // OPTIMIZATION: Immediately create new candle when period starts
            this.candles.push(newCandle);
            this.candles.sort((a, b) => a.openTime - b.openTime);
            
            // Stop animation of previous candle
            this.stopActiveCandleAnimation();
            
            if (this.followPrice && !this.hasUserInteracted) {
              this.stickToRightInternal();
            }
            
            this.updateViewportPriceRange();
            
            // Immediately render the new candle
            this.scheduleRender('new-candle-created-immediately');
          }
        }
        */
      }
      
      this.scheduleRender('period-timer-check');
    }, 10); // OPTIMIZATION: Check every 10ms for immediate candle creation exactly at 00:00 (00:00, 00:15, etc.)
  }

  private startTimeLineAnimation(): void {
    this.stopTimeLineAnimation();
    
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let lastLogTime = performance.now();
    
    const animate = () => {
      // Останавливаем анимацию если вкладка скрыта
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        this.timeLineAnimationRafId = null;
        return;
      }
      
      const currentFrameTime = performance.now();
      const frameDelta = currentFrameTime - lastFrameTime;
      frameCount++;
      
      // Update log time for throttling
      if (currentFrameTime - lastLogTime > 1000) {
        lastLogTime = currentFrameTime;
        frameCount = 0;
      }
      lastFrameTime = currentFrameTime;
      
      // Плавно обновляем линию времени каждый кадр (60 FPS)
      // Вызываем рендер напрямую для максимальной плавности
      this.performRender();
      
      this.timeLineAnimationRafId = requestAnimationFrame(animate);
    };
    
    this.timeLineAnimationRafId = requestAnimationFrame(animate);
  }

  private stopTimeLineAnimation(): void {
    if (this.timeLineAnimationRafId !== null) {
      cancelAnimationFrame(this.timeLineAnimationRafId);
      this.timeLineAnimationRafId = null;
    }
  }

  destroy(): void {
    // Отменяем ожидающий рендер
    if (this.pendingRenderTimeout !== null) {
      clearTimeout(this.pendingRenderTimeout);
      this.pendingRenderTimeout = null;
    }
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.stopMomentum();
    
    if (this.adaptiveAnimationRafId !== null) {
      cancelAnimationFrame(this.adaptiveAnimationRafId);
      this.adaptiveAnimationRafId = null;
    }

    if (this.hoverUpdateRafId !== null) {
      cancelAnimationFrame(this.hoverUpdateRafId);
      this.hoverUpdateRafId = null;
    }

    if (this.priceLineAnimationRafId !== null) {
      cancelAnimationFrame(this.priceLineAnimationRafId);
      this.priceLineAnimationRafId = null;
    }
    
    // Останавливаем анимацию активной свечи
    this.stopActiveCandleAnimation();
    
    // Останавливаем анимацию линии времени
    this.stopTimeLineAnimation();

    if (this.countdownTimerInterval !== null) {
      clearInterval(this.countdownTimerInterval);
      this.countdownTimerInterval = null;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    
    if (this.boundHandlers.mouseDown) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
    }
    if (this.boundHandlers.mouseMove) {
      this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
    }
    if (this.boundHandlers.mouseUp) {
      this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    }
    if (this.boundHandlers.mouseLeave) {
      this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseLeave);
    }
    if (this.boundHandlers.pointerDown) {
      this.canvas.removeEventListener('pointerdown', this.boundHandlers.pointerDown);
    }
    if (this.boundHandlers.pointerMove) {
      this.canvas.removeEventListener('pointermove', this.boundHandlers.pointerMove);
    }
    if (this.boundHandlers.pointerUp) {
      this.canvas.removeEventListener('pointerup', this.boundHandlers.pointerUp);
    }
    if (this.boundHandlers.pointerLeave) {
      this.canvas.removeEventListener('pointerleave', this.boundHandlers.pointerLeave);
    }
    if (this.boundHandlers.wheel) {
      this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
    }
    if (this.boundHandlers.touchStart) {
      this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart);
    }
    if (this.boundHandlers.touchMove) {
      this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove);
    }
    if (this.boundHandlers.touchEnd) {
      this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd);
      this.canvas.removeEventListener('touchcancel', this.boundHandlers.touchEnd);
    }
    
    this.boundHandlers = {};
  }
}



