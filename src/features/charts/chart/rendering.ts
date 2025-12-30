import { Candle, ViewportState, Timeframe, DrawingState, DrawingLine, ChartView } from './types';
import { formatTimeForTicks, formatPrice } from './timeframes';
import { getTimeframeDurationMs } from '../ui/utils';
import { getServerTime } from '@src/shared/lib/serverTime';
import { getIndicatorRenderer } from '../ui/indicators/renderers';
import type { IndicatorRenderContext } from '../ui/indicators/types';
// Тип Candle теперь импортируется из types
import type { Candle as IndicatorCandle } from './types';

export interface RenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  candles: Candle[];
  viewport: ViewportState;
  timeframe: Timeframe;
  hoverIndex: number | null;
  hoverCandle: Candle | null;
  hoverX: number | null;
  hoverY: number | null;
  backgroundImage: HTMLImageElement | null;
  currentTime?: number;
  activeIndicators?: string[];
  drawingState?: DrawingState;
  timestampToPixel?: (timestamp: number) => number | null;
  priceToPixel?: (price: number) => number | null;
  eraserPosition?: { x: number; y: number } | null;
  chartView?: ChartView;
  realCandles?: Candle[]; // Реальные свечи для отображения OHLC (без анимации)
  animatedPrice?: number | null; // Анимированная цена для плавной линии цены
  hoveredButton?: 'buy' | 'sell' | null; // Наведенная кнопка для отображения градиента
  bottomPadding?: number; // Отступ снизу для интерфейса ставок
}

export function xIndexToPixel(index: number, viewport: ViewportState, width: number): number {
  const relative = (index - viewport.fromIndex) / viewport.candlesPerScreen;
  return relative * width;
}

export function priceToPixel(price: number, viewport: ViewportState, height: number): number {
  const { minPrice, maxPrice } = viewport;
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || maxPrice === minPrice) {
    return height / 2;
  }
  if (maxPrice < minPrice) {
    return height / 2;
  }
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  const pixelY = height - ratio * height;
  // Ограничиваем координату Y в пределах [0, height], чтобы свечи не выходили за пределы
  return Math.max(0, Math.min(height, pixelY));
}

function fillRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
}

function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, backgroundImage: HTMLImageElement | null): void {
  if (backgroundImage && backgroundImage.complete) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const imgAspect = backgroundImage.width / backgroundImage.height;
    const canvasAspect = width / height;
    
    let drawWidth = width;
    let drawHeight = height;
    let drawX = 0;
    let drawY = 0;
    
    if (imgAspect > canvasAspect) {
      drawWidth = height * imgAspect;
      drawX = (width - drawWidth) / 2;
    } else {
      drawHeight = width / imgAspect;
      drawY = (height - drawHeight) / 2;
    }
    
    // 1. Рисуем оригинальное ЧБ изображение
    ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
    
    // 2. Накладываем цветной градиент (сверху → вниз) с несколькими цветами
    const colorfulGradient = ctx.createLinearGradient(0, 0, 0, height);
    // Верх - голубой/синий с акцентом
    colorfulGradient.addColorStop(0, 'rgba(51, 207, 255, 0.25)'); // яркий голубой
    colorfulGradient.addColorStop(0.2, 'rgba(29, 47, 107, 0.35)'); // синий
    colorfulGradient.addColorStop(0.5, 'rgba(41, 186, 230, 0.3)'); // акцентный голубой
    colorfulGradient.addColorStop(0.7, 'rgba(22, 36, 87, 0.4)'); // темно-синий
    colorfulGradient.addColorStop(1, 'rgba(11, 18, 32, 0.5)'); // очень темный низ
    ctx.fillStyle = colorfulGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 3. Добавляем радиальный градиент для дополнительного эффекта (по центру)
    const radialGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    radialGradient.addColorStop(0, 'rgba(51, 207, 255, 0.15)'); // яркий центр
    radialGradient.addColorStop(0.5, 'rgba(29, 47, 107, 0.2)');
    radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // прозрачные края
    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
  }
}

function calculateNiceStep(min: number, max: number, targetSteps: number): number {
  const range = max - min;
  const rawStep = range / targetSteps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / magnitude;
  
  let niceStep: number;
  if (normalizedStep <= 1) niceStep = 1;
  else if (normalizedStep <= 2) niceStep = 2;
  else if (normalizedStep <= 5) niceStep = 5;
  else niceStep = 10;
  
  return niceStep * magnitude;
}

export function drawGridY(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  width: number,
  height: number,
): void {
  const { minPrice, maxPrice } = viewport;
  const step = calculateNiceStep(minPrice, maxPrice, 6);
  const firstLevel = Math.floor(minPrice / step) * step;

  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistanceX = Math.max(centerX, width - centerX);
  const maxDistanceY = Math.max(centerY, height - centerY);
  
  ctx.lineWidth = 0.05;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let price = firstLevel; price <= maxPrice; price += step) {
    const y = priceToPixel(price, viewport, height);
    
    if (y < 0 || y > height) continue;
    
    ctx.strokeStyle = 'rgb(255, 255, 255)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillText(formatPrice(price), width - 10, y);
  }
}

function indexToTime(index: number, candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  
  const floorIdx = Math.max(0, Math.min(Math.floor(index), candles.length - 1));
  const ceilIdx = Math.max(0, Math.min(Math.ceil(index), candles.length - 1));
  
  if (floorIdx === ceilIdx) {
    return candles[floorIdx].openTime;
  }
  
  const floorCandle = candles[floorIdx];
  const ceilCandle = candles[ceilIdx];
  
  if (floorCandle.openTime === ceilCandle.openTime) {
    return floorCandle.openTime;
  }
  
  const timeDiff = ceilCandle.openTime - floorCandle.openTime;
  const ratio = index - floorIdx;
  return floorCandle.openTime + ratio * timeDiff;
}

function timeToIndex(time: number, candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  if (candles.length === 1) return 0;
  
  if (time <= candles[0].openTime) {
    const timeDiff = candles.length > 1 ? candles[1].openTime - candles[0].openTime : 0;
    if (timeDiff === 0) return 0;
    return (time - candles[0].openTime) / timeDiff;
  }
  
  if (time >= candles[candles.length - 1].openTime) {
    const lastIdx = candles.length - 1;
    const timeDiff = candles.length > 1 ? candles[lastIdx].openTime - candles[lastIdx - 1].openTime : 0;
    if (timeDiff === 0) return lastIdx;
    return lastIdx + (time - candles[lastIdx].openTime) / timeDiff;
  }
  
  for (let i = 0; i < candles.length - 1; i++) {
    const currTime = candles[i].openTime;
    const nextTime = candles[i + 1].openTime;
    
    if (time >= currTime && time <= nextTime) {
      if (nextTime === currTime) return i;
      const ratio = (time - currTime) / (nextTime - currTime);
      return i + ratio;
    }
  }
  
  return candles.length - 1;
}

export function drawGridX(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  timeframe: Timeframe,
  width: number,
  height: number,
  chartAreaHeight?: number,
  timeAxisY?: number,
): void {
  if (candles.length === 0) return;
  
  const effectiveChartHeight = chartAreaHeight !== undefined ? chartAreaHeight : height;
  const effectiveTimeAxisY = timeAxisY !== undefined ? timeAxisY : (chartAreaHeight !== undefined ? chartAreaHeight : height - 20);
  
  const fromIdx = Math.max(0, Math.floor(viewport.fromIndex));
  const toIdx = Math.min(candles.length - 1, Math.ceil(viewport.toIndex));
  const viewportFromIdx = viewport.fromIndex;
  const viewportToIdx = viewport.toIndex;
  
  if (fromIdx > toIdx && viewportToIdx <= candles.length - 1 && viewportFromIdx >= 0) return;

  const visibleCandlesCount = Math.max(1, toIdx - fromIdx + 1);
  const candlesPerScreen = viewport.candlesPerScreen;
  
  const isSmallTimeframe = timeframe === '15s' || timeframe === '30s';
  const showSeconds = isSmallTimeframe && candlesPerScreen < 12;
  
  // Вычисляем расстояние между свечами в пикселях
  const distanceBetweenCandles = width / candlesPerScreen;
  
  // При максимальном зуме (когда расстояние между свечами достаточно большое)
  // показываем сетку у каждой свечи
  // Если расстояние больше 30 пикселей, значит зум максимальный
  const isMaxZoom = distanceBetweenCandles >= 30;
  
  const minPixelDistance = 60;
  const maxLinesByWidth = Math.floor(width / minPixelDistance);
  
  let targetLines = 16;
  if (candlesPerScreen > 200) {
    targetLines = 6;
  } else if (candlesPerScreen > 100) {
    targetLines = 8;
  } else if (candlesPerScreen > 50) {
    targetLines = 12;
  } else if (candlesPerScreen > 20) {
    targetLines = 16;
  } else {
    targetLines = 20;
  }
  
  targetLines = Math.min(targetLines, maxLinesByWidth);
  let step = Math.max(1, Math.floor(visibleCandlesCount / targetLines));
  
  // При максимальном зуме сетка через одну свечу
  if (isMaxZoom) {
    step = 2;
  } else if (isSmallTimeframe && !showSeconds && candlesPerScreen >= 12) {
    const timeframeDurationMs = getTimeframeDurationMs(timeframe) ?? 60_000;
    const minTimeIntervalMs = 60 * 1000;
    const minCandlesStep = Math.ceil(minTimeIntervalMs / timeframeDurationMs);
    step = Math.max(step, minCandlesStep);
  }
  
  // Адаптивный минимальный отступ между метками в зависимости от ширины экрана
  let minTimeLabelSpacing = 80;
  if (width <= 320) {
    minTimeLabelSpacing = 55; // Для очень узких экранов
  } else if (width <= 480) {
    minTimeLabelSpacing = 65;
  } else if (width <= 640) {
    minTimeLabelSpacing = 70;
  } else if (width <= 768) {
    minTimeLabelSpacing = 75;
  }
  
  let timeLabelStep = 1;
  if (distanceBetweenCandles < minTimeLabelSpacing) {
    const calculatedStep = minTimeLabelSpacing / distanceBetweenCandles;
    if (calculatedStep <= 2) {
      timeLabelStep = 2;
    } else if (calculatedStep <= 3) {
      timeLabelStep = 3;
    } else if (calculatedStep <= 4) {
      timeLabelStep = 4;
    } else if (calculatedStep <= 5) {
      timeLabelStep = 5;
    } else if (calculatedStep <= 6) {
      timeLabelStep = 6;
    } else if (calculatedStep <= 8) {
      timeLabelStep = 8;
    } else {
      timeLabelStep = Math.ceil(calculatedStep);
    }
  }
  
  ctx.lineWidth = 0.05;
  // Адаптивный размер шрифта в зависимости от ширины экрана
  let fontSize = 12;
  if (width <= 320) {
    fontSize = 9;
  } else if (width <= 480) {
    fontSize = 10;
  } else if (width <= 640) {
    fontSize = 11;
  }
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (viewportFromIdx < 0 && candles.length > 0) {
    const firstCandleIdx = 0;
    const firstCandle = candles[firstCandleIdx];
    const nextCandle = candles.length > 1 ? candles[1] : firstCandle;
    const timeDiff = nextCandle.openTime - firstCandle.openTime;
    
    const remainingRange = Math.abs(viewportFromIdx);
    const additionalLines = Math.ceil(remainingRange / step);
    
    for (let i = 1; i <= additionalLines; i++) {
      const idx = -i * step;
      if (idx < viewportFromIdx) break;
      
      const x = xIndexToPixel(idx, viewport, width);
      if (x < 0 || x > width) continue;

      ctx.strokeStyle = 'rgb(255, 255, 255)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, effectiveChartHeight);
      ctx.stroke();
    }
    
    // Метки слева теперь обрабатываются в основном цикле
  }

  const gridStep = step;
  const timeStep = timeLabelStep;
  
  for (let i = fromIdx; i <= toIdx; i += gridStep) {
    if (i >= candles.length) break;
    
    const candle = candles[i];
    const x = xIndexToPixel(i, viewport, width);
    
    if (x < 0 || x > width) continue;

    ctx.strokeStyle = 'rgb(255, 255, 255)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, effectiveChartHeight);
    ctx.stroke();
  }
  
  const startIdx = Math.floor(fromIdx);
  const endIdx = Math.ceil(toIdx);
  const firstTimeIdx = Math.ceil(startIdx / timeStep) * timeStep;
  
  // Собираем все метки времени для проверки на перекрытие
  interface TimeLabel {
    x: number;
    text: string;
    idx: number;
  }
  
  const timeLabels: TimeLabel[] = [];
  
  // Добавляем метки слева от видимой области
  if (viewportFromIdx < 0 && candles.length > 0) {
    const firstCandleIdx = 0;
    const firstCandle = candles[firstCandleIdx];
    const nextCandle = candles.length > 1 ? candles[1] : firstCandle;
    const timeDiff = nextCandle.openTime - firstCandle.openTime;
    const remainingRange = Math.abs(viewportFromIdx);
    const additionalTimeLabels = Math.ceil(remainingRange / timeStep);
    
    for (let i = 1; i <= additionalTimeLabels; i++) {
      const idx = -i * timeStep;
      if (idx < viewportFromIdx) break;
      
      const x = Math.round(xIndexToPixel(idx, viewport, width));
      if (x < 0 || x > width) continue;
      
      const extrapolatedTime = firstCandle.openTime - (Math.abs(idx)) * timeDiff;
      const timeStr = formatTimeForTicks(extrapolatedTime, timeframe, viewport.candlesPerScreen);
      timeLabels.push({ x, text: timeStr, idx });
    }
  }
  
  // Добавляем метки в видимой области
  for (let i = firstTimeIdx; i <= endIdx; i += timeStep) {
    if (i < 0 || i >= candles.length) continue;
    
    const candle = candles[i];
    const x = Math.round(xIndexToPixel(i, viewport, width));
    
    if (x < 0 || x > width) continue;
    
    const timeStr = formatTimeForTicks(candle.openTime, timeframe, viewport.candlesPerScreen);
    timeLabels.push({ x, text: timeStr, idx: i });
  }
  
  // Добавляем метки справа от видимой области
  if (viewportToIdx > candles.length - 1 && candles.length > 0) {
    const lastCandleIdx = candles.length - 1;
    const lastCandle = candles[lastCandleIdx];
    const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
    const timeDiff = lastCandle.openTime - prevCandle.openTime;
    const remainingRange = viewportToIdx - lastCandleIdx;
    const additionalTimeLabels = Math.ceil(remainingRange / timeStep);
    
    for (let i = 1; i <= additionalTimeLabels; i++) {
      const idx = lastCandleIdx + i * timeStep;
      if (idx > viewportToIdx) break;
      
      const x = Math.round(xIndexToPixel(idx, viewport, width));
      if (x < 0 || x > width) continue;
      
      const extrapolatedTime = lastCandle.openTime + (idx - lastCandleIdx) * timeDiff;
      const timeStr = formatTimeForTicks(extrapolatedTime, timeframe, viewport.candlesPerScreen);
      timeLabels.push({ x, text: timeStr, idx });
    }
  }
  
  // Сортируем метки по X координате
  timeLabels.sort((a, b) => a.x - b.x);
  
  // Фильтруем метки, убирая те, которые перекрываются
  const filteredLabels: TimeLabel[] = [];
  let lastLabelRight = -Infinity;
  const padding = fontSize * 0.6; // Минимальный отступ между метками (60% от размера шрифта)
  
  for (const label of timeLabels) {
    const labelWidth = ctx.measureText(label.text).width;
    const labelLeft = label.x - labelWidth / 2;
    const labelRight = label.x + labelWidth / 2;
    
    // Проверяем, не перекрывается ли метка с предыдущей
    if (labelLeft >= lastLabelRight + padding) {
      filteredLabels.push(label);
      lastLabelRight = labelRight;
    }
  }
  
  // Рисуем отфильтрованные метки
  for (const label of filteredLabels) {
    ctx.fillText(label.text, label.x, effectiveTimeAxisY);
  }

  // Рисуем сетку справа от видимой области (без временных меток, они уже обработаны выше)
  if (viewportToIdx > candles.length - 1 && candles.length > 0) {
    const lastCandleIdx = candles.length - 1;
    const remainingRange = viewportToIdx - lastCandleIdx;
    const additionalLines = Math.ceil(remainingRange / step);
    
    for (let i = 1; i <= additionalLines; i++) {
      const idx = lastCandleIdx + i * step;
      if (idx > viewportToIdx) break;
      
      const x = xIndexToPixel(idx, viewport, width);
      if (x < 0 || x > width) continue;

      ctx.strokeStyle = 'rgb(255, 255, 255)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, effectiveChartHeight);
      ctx.stroke();
    }
  }
}

export function drawLineChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  hoverIndex: number | null = null,
): void {
  const fromIdx = Math.max(0, Math.floor(viewport.fromIndex));
  const toIdx = Math.min(candles.length - 1, Math.ceil(viewport.toIndex));
  
  if (fromIdx > toIdx || candles.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#4A9EFF';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Собираем все точки для сглаживания
  const points: Array<{ x: number; y: number }> = [];
  
  for (let i = fromIdx; i <= toIdx; i++) {
    if (i >= candles.length) break;
    
    const candle = candles[i];
    const x = xIndexToPixel(i, viewport, width);
    const y = priceToPixel(candle.close, viewport, height);
    
    if (x < 0 || x > width) continue;
    
    points.push({ x, y });
  }

  if (points.length === 0) {
    ctx.restore();
    return;
  }

  // Рисуем плавную линию с использованием кубических кривых Безье для создания дугообразных переходов
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    // Если только одна точка, рисуем её как маленький круг
    ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
  } else if (points.length === 2) {
    // Если две точки, рисуем прямую линию
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // Используем алгоритм сглаживания на основе кубических кривых Безье
    // Создаем плавные дуги с закругленными углами, проходящие через все точки
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
      
      // Вычисляем контрольные точки для кубической кривой Безье
      // Используем формулу Catmull-Rom для создания плавных переходов
      // Коэффициент 0.3 создает более плавные дуги с закругленными углами
      const smoothness = 0.3;
      
      // Первая контрольная точка - направлена к следующей точке
      const cp1x = p1.x + (p2.x - p0.x) * smoothness;
      const cp1y = p1.y + (p2.y - p0.y) * smoothness;
      
      // Вторая контрольная точка - направлена от предыдущей точки
      const cp2x = p2.x - (p3.x - p1.x) * smoothness;
      const cp2y = p2.y - (p3.y - p1.y) * smoothness;
      
      // Рисуем кубическую кривую Безье для плавного дугообразного перехода
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.stroke();

  if (hoverIndex !== null && hoverIndex >= fromIdx && hoverIndex <= toIdx && hoverIndex < candles.length) {
    const candle = candles[hoverIndex];
    const x = xIndexToPixel(hoverIndex, viewport, width);
    const y = priceToPixel(candle.close, viewport, height);
    
    ctx.fillStyle = '#4A9EFF';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawAreaChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  hoverIndex: number | null = null,
): void {
  const fromIdx = Math.max(0, Math.floor(viewport.fromIndex));
  const toIdx = Math.min(candles.length - 1, Math.ceil(viewport.toIndex));
  
  if (fromIdx > toIdx || candles.length === 0) return;

  const distanceBetweenCenters = width / viewport.candlesPerScreen;
  const barWidth = Math.max(3, distanceBetweenCenters - 2);

  ctx.save();

  // Сначала рисуем заливку (область волатильности)
  for (let i = fromIdx; i <= toIdx; i++) {
    if (i >= candles.length) break;
    
    const candle = candles[i];
    const x = xIndexToPixel(i, viewport, width);
    
    if (x < -barWidth || x > width + barWidth) continue;

    const openY = priceToPixel(candle.open, viewport, height);
    const closeY = priceToPixel(candle.close, viewport, height);
    const highY = priceToPixel(candle.high, viewport, height);
    const lowY = priceToPixel(candle.low, viewport, height);

    const priceDiff = Math.abs(candle.close - candle.open);
    const avgPrice = (candle.open + candle.close) / 2;
    const priceChangePercent = avgPrice > 0 ? (priceDiff / avgPrice) * 100 : 0;
    const isDoji = priceChangePercent < 0.0001 || priceDiff < 1e-8;
    // More strict check: green only if close is significantly greater than open
    // This prevents green candles that visually look like they're going down due to rounding errors
    const minChangeForColor = avgPrice * 0.0001; // 0.01% minimum change to determine color
    const isGreen = !isDoji && (candle.close - candle.open) > minChangeForColor;
    
    const isHovered = hoverIndex === i;
    const barLeft = x - barWidth / 2;
    const barRight = x + barWidth / 2;

    // Создаем градиент для заливки области волатильности
    const gradient = ctx.createLinearGradient(barLeft, highY, barLeft, lowY);
    
    if (isDoji) {
      gradient.addColorStop(0, 'rgba(136, 136, 136, 0.15)');
      gradient.addColorStop(0.5, 'rgba(136, 136, 136, 0.25)');
      gradient.addColorStop(1, 'rgba(136, 136, 136, 0.15)');
    } else if (isGreen) {
      // Зеленый градиент для роста: ярче в центре (close), тусклее к краям
      const openRatio = (openY - highY) / (lowY - highY);
      const closeRatio = (closeY - highY) / (lowY - highY);
      const minRatio = Math.min(openRatio, closeRatio);
      const maxRatio = Math.max(openRatio, closeRatio);
      
      gradient.addColorStop(0, 'rgba(16, 160, 85, 0.1)');
      if (minRatio > 0.01) {
        gradient.addColorStop(minRatio, 'rgba(16, 160, 85, 0.2)');
      }
      gradient.addColorStop((minRatio + maxRatio) / 2, 'rgba(16, 160, 85, 0.4)');
      if (maxRatio < 0.99) {
        gradient.addColorStop(maxRatio, 'rgba(16, 160, 85, 0.2)');
      }
      gradient.addColorStop(1, 'rgba(16, 160, 85, 0.1)');
    } else {
      // Красный градиент для падения
      const openRatio = (openY - highY) / (lowY - highY);
      const closeRatio = (closeY - highY) / (lowY - highY);
      const minRatio = Math.min(openRatio, closeRatio);
      const maxRatio = Math.max(openRatio, closeRatio);
      
      gradient.addColorStop(0, 'rgba(232, 91, 78, 0.1)');
      if (minRatio > 0.01) {
        gradient.addColorStop(minRatio, 'rgba(232, 91, 78, 0.2)');
      }
      gradient.addColorStop((minRatio + maxRatio) / 2, 'rgba(232, 91, 78, 0.4)');
      if (maxRatio < 0.99) {
        gradient.addColorStop(maxRatio, 'rgba(232, 91, 78, 0.2)');
      }
      gradient.addColorStop(1, 'rgba(232, 91, 78, 0.1)');
    }

    // Заливка области волатильности
    ctx.fillStyle = gradient;
    ctx.fillRect(barLeft, highY, barWidth, lowY - highY);

    // Обводка области
    const borderColor = isDoji ? 'rgba(136, 136, 136, 0.4)' : (isGreen ? 'rgba(16, 160, 85, 0.5)' : 'rgba(232, 91, 78, 0.5)');
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(barLeft, highY, barWidth, lowY - highY);

    // Линия Open-Close (более яркая)
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyColor = isDoji ? 'rgba(136, 136, 136, 0.8)' : (isGreen ? 'rgba(16, 160, 85, 0.9)' : 'rgba(232, 91, 78, 0.9)');
    
    ctx.fillStyle = bodyColor;
    ctx.fillRect(barLeft, bodyTop, barWidth, Math.max(bodyBottom - bodyTop, 1));

    // Подсветка при наведении
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(barLeft - 1, highY - 1, barWidth + 2, lowY - highY + 2);
    }
  }

  ctx.restore();
}

// Статическая переменная для ограничения частоты логирования в drawCandles
let drawCandlesLastLogTime = 0;

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  hoverIndex: number | null = null,
): void {
  const fromIdx = Math.max(0, Math.floor(viewport.fromIndex));
  const toIdx = Math.min(candles.length - 1, Math.ceil(viewport.toIndex));
  
  if (fromIdx > toIdx || candles.length === 0) return;
  
  // Логирование для диагностики проблем со свечами (не чаще раза в секунду)
  const now = Date.now();
  const visibilityState = typeof document !== 'undefined' ? document.visibilityState : 'unknown';
  if (!drawCandlesLastLogTime || now - drawCandlesLastLogTime > 1000) {
    const lastCandle = candles[candles.length - 1];
    
    // Проверяем пропуски во времени между видимыми свечами
    const gaps: Array<{ from: number; to: number; gapMs: number; gapCandles: number; expectedInterval: number }> = [];
    
    // Вычисляем средний интервал между свечами для определения ожидаемого интервала
    let averageInterval = 15000; // Значение по умолчанию для 15s
    if (candles.length >= 2) {
      // Вычисляем средний интервал на основе первых 10 пар свечей (или всех, если меньше 10)
      const samplesToCheck = Math.min(10, candles.length - 1);
      let totalInterval = 0;
      let validSamples = 0;
      for (let i = 0; i < samplesToCheck; i++) {
        const interval = candles[i + 1].openTime - candles[i].openTime;
        if (interval > 0 && interval < 300000) { // Игнорируем слишком большие интервалы (>5 минут)
          totalInterval += interval;
          validSamples++;
        }
      }
      if (validSamples > 0) {
        averageInterval = totalInterval / validSamples;
      }
    }
    
    // Проверяем весь массив свечей на пропуски (не только видимую область)
    for (let i = 0; i < candles.length - 1; i++) {
      const currentCandle = candles[i];
      const nextCandle = candles[i + 1];
      const timeDiff = nextCandle.openTime - currentCandle.openTime;
      // Если разница больше чем в 2 раза от среднего интервала, считаем это пропуском
      if (timeDiff > averageInterval * 2) {
        gaps.push({
          from: i,
          to: i + 1,
          gapMs: timeDiff,
          gapCandles: Math.floor(timeDiff / averageInterval) - 1,
          expectedInterval: averageInterval,
        });
      }
    }
    
    // Отдельно проверяем пропуски в видимой области
    const visibleGaps = gaps.filter(g => g.from >= fromIdx && g.to <= toIdx);
    
    // Отдельно логируем пропуски, если они есть (логирование отключено)
    if (false && gaps.length > 0) {
      console.warn('[drawCandles] ⚠️ ОБНАРУЖЕНЫ ПРОПУСКИ ВО ВРЕМЕНИ:', {
        totalGaps: gaps.length,
        visibleGaps: visibleGaps.length,
        averageInterval: averageInterval,
        averageIntervalSeconds: (averageInterval / 1000).toFixed(1),
        gaps: gaps.map(g => ({
          fromIdx: g.from,
          toIdx: g.to,
          gapMs: g.gapMs,
          gapSeconds: (g.gapMs / 1000).toFixed(1),
          missingCandles: g.gapCandles,
          expectedInterval: g.expectedInterval,
          fromTime: new Date(candles[g.from].openTime).toISOString(),
          toTime: new Date(candles[g.to].openTime).toISOString(),
          isVisible: g.from >= fromIdx && g.to <= toIdx,
        })),
      });
    }
    
    // Логирование отключено для уменьшения шума
    if (false) {
      console.log('[drawCandles] 🕯️ ОТРИСОВКА СВЕЧЕЙ', {
        timestamp: new Date(now).toISOString(),
        visibilityState,
        candlesCount: candles.length,
        fromIdx,
        toIdx,
        visibleCandlesCount: toIdx - fromIdx + 1,
        totalGapsCount: gaps.length,
      visibleGapsCount: visibleGaps.length,
      averageInterval: averageInterval,
      averageIntervalSeconds: (averageInterval / 1000).toFixed(1),
      allGaps: gaps.length > 0 ? gaps.map(g => ({
        fromIdx: g.from,
        toIdx: g.to,
        gapMs: g.gapMs,
        gapSeconds: (g.gapMs / 1000).toFixed(1),
        missingCandles: g.gapCandles,
        expectedInterval: g.expectedInterval,
        fromTime: new Date(candles[g.from].openTime).toISOString(),
        toTime: new Date(candles[g.to].openTime).toISOString(),
        isVisible: g.from >= fromIdx && g.to <= toIdx,
      })) : null,
      visibleGaps: visibleGaps.length > 0 ? visibleGaps.map(g => ({
        fromIdx: g.from,
        toIdx: g.to,
        gapMs: g.gapMs,
        gapSeconds: (g.gapMs / 1000).toFixed(1),
        missingCandles: g.gapCandles,
        fromTime: new Date(candles[g.from].openTime).toISOString(),
        toTime: new Date(candles[g.to].openTime).toISOString(),
      })) : null,
      lastCandle: lastCandle ? {
        openTime: new Date(lastCandle.openTime).toISOString(),
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      } : null,
      viewport: {
        fromIndex: viewport.fromIndex,
        toIndex: viewport.toIndex,
        candlesPerScreen: viewport.candlesPerScreen,
      },
      });
      drawCandlesLastLogTime = now;
    }
  }

  const distanceBetweenCenters = width / viewport.candlesPerScreen;
  const candleWidthPx = Math.max(1.2, distanceBetweenCenters - 5);

  // Логируем информацию о тонких свечах в видимой области
  const visibleThinCandles: Array<{ index: number; time: string; high: number; low: number; range: number; rangePercent: number; pixelHeight: number }> = [];
  
  ctx.save();

  for (let i = fromIdx; i <= toIdx; i++) {
    if (i >= candles.length) break;
    
    const candle = candles[i];
    const x = xIndexToPixel(i, viewport, width);
    
    if (x < -candleWidthPx || x > width + candleWidthPx) continue;

    const openY = priceToPixel(candle.open, viewport, height);
    const closeY = priceToPixel(candle.close, viewport, height);
    const highY = priceToPixel(candle.high, viewport, height);
    const lowY = priceToPixel(candle.low, viewport, height);

    const priceDiff = Math.abs(candle.close - candle.open);
    const avgPrice = (candle.open + candle.close) / 2;
    const priceChangePercent = avgPrice > 0 ? (priceDiff / avgPrice) * 100 : 0;
    const isDoji = priceChangePercent < 0.0001 || priceDiff < 1e-8;
    
    // Проверяем на очень тонкие свечи (диапазон меньше 0.0001% или визуально очень маленький)
    const range = candle.high - candle.low;
    const rangePercent = avgPrice > 0 ? (range / avgPrice) * 100 : 0;
    const pixelHeight = Math.abs(lowY - highY);
    
    if (rangePercent < 0.001 || pixelHeight < 1) {
      visibleThinCandles.push({
        index: i,
        time: new Date(candle.openTime).toISOString(),
        high: candle.high,
        low: candle.low,
        range,
        rangePercent,
        pixelHeight
      });
    }
    // More strict check: green only if close is significantly greater than open
    // This prevents green candles that visually look like they're going down due to rounding errors
    const minChangeForColor = avgPrice * 0.0001; // 0.01% minimum change to determine color
    const isGreen = !isDoji && (candle.close - candle.open) > minChangeForColor;
    
    // Аномальные свечи отображаются оранжевым цветом
    let color: string;
    if (candle.anomaly) {
      // Оранжевый цвет для аномальных свечей
      color = isGreen ? '#FF8C00' : '#FF6B35'; // Темно-оранжевый для роста, ярко-оранжевый для падения
    } else {
      color = isDoji ? '#888' : (isGreen ? '#2ECC71' : '#E74C3C');
    }
    
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

    const candleLeft = x - candleWidthPx / 2;
    const isHovered = hoverIndex === i;
    const isActiveCandle = i === candles.length - 1;

    // Тени свечей (wick) - используем цвет свечи
    // Для зеленых и красных свечей используем цвет из градиента
    let wickColor: string;
    if (!candle.anomaly && !isDoji && isGreen) {
      wickColor = '#60BE5E'; // Верхний цвет градиента для зеленых свечей
    } else if (!candle.anomaly && !isDoji && !isGreen) {
      wickColor = '#E85A50'; // Верхний цвет градиента для красных свечей
    } else {
      wickColor = color;
    }
    
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = isHovered ? 2 : 1;

    // Для активной свечи тени должны синхронизироваться с анимацией тела
    // Тени не должны появляться быстрее, чем тело свечи достигает соответствующих точек
    if (isActiveCandle) {
      // Для активной свечи ограничиваем тени так, чтобы они показывали только те экстремумы,
      // которые уже "достигнуты" телом свечи во время анимации
      // Верхняя тень: от high до верха тела, но только если high выше текущего максимума open/close
      const topOfBodyPrice = Math.min(candle.open, candle.close);
      const bottomOfBodyPrice = Math.max(candle.open, candle.close);
      
      // Верхняя тень рисуется только если high действительно выше верха тела
      // Это гарантирует, что тень появляется синхронно с телом
      if (candle.high > topOfBodyPrice && highY < bodyTop) {
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, bodyTop);
        ctx.stroke();
      }
      
      // Нижняя тень: от низа тела до low, но только если low ниже низа тела
      // Это гарантирует, что тень появляется синхронно с телом
      if (candle.low < bottomOfBodyPrice && lowY > bodyBottom) {
        ctx.beginPath();
        ctx.moveTo(x, bodyBottom);
        ctx.lineTo(x, lowY);
        ctx.stroke();
      }
    } else {
      // Для неактивных свечей тени рисуются стандартно: от high до верха тела и от низа тела до low
      // Верхняя тень: от high до верха тела свечи
      // Проверяем в пикселях: highY должна быть выше bodyTop (меньше по Y)
      if (highY < bodyTop) {
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, bodyTop);
        ctx.stroke();
      }
      
      // Нижняя тень: от низа тела свечи до low
      // Проверяем в пикселях: lowY должна быть ниже bodyBottom (больше по Y)
      // И проверяем в ценах: low должен быть ниже максимума из open и close
      // Это гарантирует, что тень рисуется только когда low действительно ниже тела
      const bottomOfBodyPrice = Math.max(candle.open, candle.close);
      if (lowY > bodyBottom && candle.low < bottomOfBodyPrice) {
        ctx.beginPath();
        ctx.moveTo(x, bodyBottom);
        ctx.lineTo(x, lowY);
        ctx.stroke();
      }
    }

    // Градиент для зеленых и красных свечей
    if (!candle.anomaly && !isDoji && isGreen) {
      const gradient = ctx.createLinearGradient(
        candleLeft,
        bodyTop,
        candleLeft,
        bodyBottom
      );
      gradient.addColorStop(0, '#45B734');
      gradient.addColorStop(1, '#45B734');
      ctx.fillStyle = gradient;
    } else if (!candle.anomaly && !isDoji && !isGreen) {
      const gradient = ctx.createLinearGradient(
        candleLeft,
        bodyTop,
        candleLeft,
        bodyBottom
      );
      gradient.addColorStop(0, '#FF3E1F');
      gradient.addColorStop(1, '#FF3E1F');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color;
    }
    
    ctx.fillRect(candleLeft, bodyTop, candleWidthPx, bodyHeight);
    
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(candleLeft, bodyTop, candleWidthPx, bodyHeight);
    }
  }

  // Логируем тонкие свечи (не чаще раза в 5 секунд)
  if (visibleThinCandles.length > 0 && (!drawCandlesLastLogTime || now - drawCandlesLastLogTime > 5000)) {
    console.warn(`[drawCandles] ⚠️ Обнаружено тонких свечей в видимой области: ${visibleThinCandles.length}`, {
      totalVisible: toIdx - fromIdx + 1,
      thinCandles: visibleThinCandles.slice(0, 20),
      viewport: {
        fromIndex: fromIdx,
        toIndex: toIdx,
        candlesPerScreen: viewport.candlesPerScreen
      }
    });
    drawCandlesLastLogTime = now;
  }

  ctx.restore();
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  hoverIndex: number | null,
  hoverCandle: Candle | null,
  hoverX: number | null,
  hoverY: number | null,
  viewport: ViewportState,
  width: number,
  fullHeight: number,
  topPadding: number,
  chartAreaHeight: number,
  timeframe: Timeframe,
): void {
  if (hoverIndex === null || hoverCandle === null || hoverX === null) return;

  ctx.save();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  // Вертикальная линия от верха до низа canvas
  ctx.beginPath();
  ctx.moveTo(hoverX, 0);
  ctx.lineTo(hoverX, fullHeight);
  ctx.stroke();

  if (hoverY !== null) {
    // Горизонтальная линия от левого до правого края canvas
    // hoverY уже в абсолютных координатах canvas (после restore)
    ctx.beginPath();
    ctx.moveTo(0, hoverY);
    ctx.lineTo(width, hoverY);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function formatTimeWithSeconds(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Статическая переменная для ограничения частоты логирования
const drawTimeLineLastLogTime = 0;

// Статическая переменная для хранения последнего серверного времени и локального времени для интерполяции
let lastServerTimeSnapshot: number | null = null;
let lastLocalTimeSnapshot: number | null = null;

// Состояние для плавной анимации линии времени (как CSS transition 0.6s)
// Храним анимированный timeIndex вместо пикселей, чтобы при скроллинге линия не отрывалась
let currentAnimatedTimeIndex: number | null = null; // Текущий анимированный индекс времени (плавно изменяется)
let targetTimeIndex: number | null = null; // Целевой индекс времени (на основе серверного времени)
let lastAnimationTime: number | null = null; // Время последнего кадра анимации
// Отслеживаем первую свечу для определения смены валютной пары
let lastFirstCandleTime: number | null = null; // Время открытия первой свечи из предыдущего вызова
// Отслеживаем предыдущий viewport для определения скроллинга
let lastViewportFromIndex: number | null = null; // Предыдущий fromIndex viewport
const TIME_LINE_ANIMATION_DURATION = 600; // Длительность анимации в мс (0.6s)
// Максимальная скорость движения линии в индексах времени в секунду для плавности
// Установлена достаточно высокой, чтобы линия могла быстро догнать целевую позицию
// при синхронизации времени, но достаточно низкой для плавного движения
const MAX_TIME_INDEX_PER_SECOND = 1.0;

/**
 * Сбрасывает состояние анимации временной линии
 * Используется при смене валютной пары для мгновенного отображения линии в правильной позиции
 */
export function resetTimeLineAnimation(): void {
  currentAnimatedTimeIndex = null;
  targetTimeIndex = null;
  lastAnimationTime = null;
  lastFirstCandleTime = null;
  lastServerTimeSnapshot = null;
  lastLocalTimeSnapshot = null;
  lastViewportFromIndex = null;
}

export function drawTimeLine(
  ctx: CanvasRenderingContext2D,
  currentTime: number | undefined,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  timeframe: Timeframe,
): void {
  if (candles.length === 0) return;
  
  // Получаем текущее локальное время для плавной интерполяции
  const now = Date.now();
  
  // Получаем серверное время из Redux (переданное через currentTime) или fallback
  // getServerTime() уже интерполирует время, но мы делаем дополнительную интерполяцию для плавности
  const serverTime = currentTime !== undefined ? currentTime : getServerTime();
  
  // Инициализируем снимки времени при первом вызове
  if (lastServerTimeSnapshot === null || lastLocalTimeSnapshot === null) {
    lastServerTimeSnapshot = serverTime;
    lastLocalTimeSnapshot = now;
  }
  
  // Вычисляем текущее интерполированное время на основе последнего снимка
  const timeDelta = now - lastLocalTimeSnapshot;
  const currentInterpolatedTime = lastServerTimeSnapshot + timeDelta;
  
  // Плавная синхронизация серверного времени для предотвращения моргания
  // Используем более мягкий порог и плавную коррекцию вместо резкой
  const timeDiff = serverTime - currentInterpolatedTime;
  if (Math.abs(timeDiff) > 200 && lastServerTimeSnapshot !== null) {
    // Плавно корректируем снимок серверного времени, используя интерполяцию
    // Это предотвращает резкие скачки, которые вызывают моргание
    const correctionFactor = 0.2; // Коэффициент плавной коррекции (20% за кадр)
    lastServerTimeSnapshot = lastServerTimeSnapshot + timeDiff * correctionFactor;
    // Если разница стала очень маленькой, устанавливаем точно
    const newInterpolatedTime = lastServerTimeSnapshot + timeDelta;
    if (Math.abs(serverTime - newInterpolatedTime) < 20) {
      lastServerTimeSnapshot = serverTime;
    }
  }
  
  // Вычисляем плавное время: последний снимок серверного времени + дельта локального времени
  // Это позволяет линии плавно "плыть" между обновлениями серверного времени
  const rawTime = lastServerTimeSnapshot + timeDelta;
  
  // Обновляем локальное время для следующего вызова
  // Это создает непрерывную интерполяцию между кадрами
  lastLocalTimeSnapshot = now;
  
  const timeframeDurationMs = getTimeframeDurationMs(timeframe) ?? 60_000;
  const timeToDisplay = rawTime;
  const timeToUse = rawTime;
  
  // Логирование отключено для производительности
  // Анимация линии времени теперь работает через плавную интерполяцию позиции

  let timeIndex: number | null = null;

  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const lastCandleEndTime = lastCandle.openTime + timeframeDurationMs;
    const timeUntilNewCandle = lastCandleEndTime - rawTime;
    
    if (rawTime >= lastCandle.openTime && rawTime <= lastCandleEndTime) {
      const timeSinceLastCandle = rawTime - lastCandle.openTime;
      timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
    } else if (rawTime > lastCandleEndTime) {
      if (candles.length > 1) {
        const prevCandle = candles[candles.length - 2];
        const timeDiff = lastCandle.openTime - prevCandle.openTime;
        if (timeDiff > 0) {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeDiff);
        } else {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
        }
      } else {
        const timeSinceLastCandle = rawTime - lastCandle.openTime;
        timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
      }
    } else {
      timeIndex = timeToIndex(rawTime, candles);
      if (timeIndex === null) {
        timeIndex = candles.length - 1;
      }
    }
  }

  if (timeIndex === null) return;

  // Проверяем, изменилась ли первая свеча (это означает смену валютной пары)
  const firstCandle = candles[0];
  const firstCandleTime = firstCandle?.openTime ?? null;
  
  // Проверяем, произошел ли скроллинг графика (изменение viewport)
  const viewportChanged = lastViewportFromIndex !== null && 
    Math.abs(viewport.fromIndex - lastViewportFromIndex) > 0.001;
  
  if (lastFirstCandleTime !== null && firstCandleTime !== null && firstCandleTime !== lastFirstCandleTime) {
    // Первая свеча изменилась - это означает смену валютной пары
    // Сбрасываем состояние анимации для мгновенного отображения линии в правильной позиции
    currentAnimatedTimeIndex = timeIndex;
    targetTimeIndex = timeIndex;
    lastAnimationTime = now;
    lastFirstCandleTime = firstCandleTime;
    lastViewportFromIndex = viewport.fromIndex;
  } else {
    // Обновляем время первой свечи для следующей проверки
    if (firstCandleTime !== null) {
      lastFirstCandleTime = firstCandleTime;
    }
    
    // Инициализируем позиции при первом вызове
    if (currentAnimatedTimeIndex === null || targetTimeIndex === null || lastAnimationTime === null) {
      currentAnimatedTimeIndex = timeIndex;
      targetTimeIndex = timeIndex;
      lastAnimationTime = now;
      lastViewportFromIndex = viewport.fromIndex;
    } else {
      // Если произошел скроллинг, корректируем currentAnimatedTimeIndex так,
      // чтобы временная линия оставалась на своем времени, а не двигалась к целевому
      if (viewportChanged && currentAnimatedTimeIndex !== null) {
        // При скроллинге временная линия должна оставаться на своем времени
        // Обновляем currentAnimatedTimeIndex на основе текущего времени, чтобы линия не двигалась
        currentAnimatedTimeIndex = timeIndex;
        targetTimeIndex = timeIndex;
      } else {
        // Обновляем целевой индекс времени на основе серверного времени
        targetTimeIndex = timeIndex;
      }
      lastViewportFromIndex = viewport.fromIndex;
    }
  }

  // Плавная интерполяция текущего индекса времени к целевому (как CSS transition 0.6s)
  // lastAnimationTime уже обновлен выше при сбросе/инициализации, поэтому вычисляем deltaTime
  const deltaTime = lastAnimationTime !== null ? now - lastAnimationTime : 0;
  lastAnimationTime = now;

  if (currentAnimatedTimeIndex !== null && Math.abs(currentAnimatedTimeIndex - targetTimeIndex) > 0.0001) {
    // Вычисляем расстояние до цели в индексах времени
    const distance = targetTimeIndex - currentAnimatedTimeIndex;
    const absDistance = Math.abs(distance);
    
    // Вычисляем скорость движения на основе расстояния и длительности анимации
    // Но ограничиваем максимальной скоростью для плавности
    const idealSpeed = absDistance / TIME_LINE_ANIMATION_DURATION; // индексов в мс
    const maxSpeed = MAX_TIME_INDEX_PER_SECOND / 1000; // индексов в мс
    const speed = Math.min(idealSpeed, maxSpeed);
    
    // Вычисляем шаг для этого кадра (в индексах времени)
    const step = speed * deltaTime;
    
    // Двигаемся к цели
    if (absDistance <= step) {
      // Если осталось меньше шага, устанавливаем точно
      currentAnimatedTimeIndex = targetTimeIndex;
    } else {
      // Плавно двигаемся к цели с постоянной скоростью
      currentAnimatedTimeIndex += distance > 0 ? step : -step;
    }
  } else {
    // Если уже на месте или очень близко, устанавливаем точно
    currentAnimatedTimeIndex = targetTimeIndex;
  }

  // Вычисляем пиксельную позицию на основе анимированного индекса времени и текущего viewport
  // Это позволяет линии плавно двигаться даже при скроллинге
  const currentX = xIndexToPixel(currentAnimatedTimeIndex, viewport, width);
  
  // Проверяем, видна ли линия на экране
  if (currentX < -10 || currentX > width + 10) {
    return;
  }

  ctx.save();
  
  // Используем интерполированную позицию для плавного движения
  // Sub-pixel rendering обеспечит плавное движение линии без пропуска пикселей
  const roundedX = currentX;

  const timeStr = formatTimeWithSeconds(timeToUse);
  // Прижимаем маркер к верху с отступом 1px
  const topOffset = 1;

  ctx.font = '12px monospace';
  const textMetrics = ctx.measureText(timeStr);
  const textWidth = textMetrics.width;
  const textHeight = 16;
  const paddingX = 8;
  const paddingY = 4;
  const rectWidth = textWidth + paddingX * 2;
  const rectHeight = textHeight + paddingY * 2;
  const rectY = topOffset + paddingY; // Прижимаем к верху с отступом 1px
  
  // Центрируем маркер относительно линии времени
  // Используем плавную позицию для плавного движения маркера
  let rectX = roundedX - rectWidth / 2;
  
  // Проверяем границы и корректируем позицию при необходимости
  if (rectX < 0) {
    rectX = 0;
  } else if (rectX + rectWidth > width) {
    rectX = width - rectWidth;
  }
  
  const bgGradient = ctx.createLinearGradient(rectX, rectY, rectX + rectWidth, rectY + rectHeight);
  bgGradient.addColorStop(0, 'rgba(221, 187, 115, 0.95)');
  bgGradient.addColorStop(1, 'rgba(221, 187, 115, 0.95)');
  ctx.fillStyle = bgGradient;
  
  const borderRadius = 6;
  fillRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, borderRadius);
  
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeStr, rectX + rectWidth / 2, rectY + rectHeight / 2);

  // Параметры треугольника: настройка через высоту и ширину (проще для широкого и низкого треугольника)
  // ИЛИ через длины всех трех сторон (для точной настройки)
  
  // СПОСОБ 1: Через высоту и ширину (рекомендуется для широкого и низкого треугольника)
  const useHeightAndWidth = true; // true = использовать высоту и ширину, false = использовать длины сторон
  const triangleHeight = 6; // Высота треугольника (небольшая для низкого треугольника)
  const triangleBaseWidth = 20; // Ширина основания (большая для широкого треугольника)
  
  // СПОСОБ 2: Через длины всех трех сторон (для точной настройки)
  const leftSideLength = 10; // Длина левой стороны (от верхней точки до левой нижней)
  const rightSideLength = 10; // Длина правой стороны (от верхней точки до правой нижней)
  const baseSideLength = 20; // Длина основания (от левой нижней до правой нижней точки)
  // ВАЖНО: baseSideLength должно быть меньше суммы leftSideLength + rightSideLength (неравенство треугольника)
  
  // Расстояние от маркера до треугольника (можно настроить, в пикселях)
  const triangleOffsetFromMarker = 6; // Отступ треугольника от нижнего края маркера
  
  // Позиция верхней точки треугольника с учетом отступа от маркера
  const triangleTopY = rectY + rectHeight + triangleOffsetFromMarker;
  
  // Расстояние от треугольника до кружка (будет использовано для вычисления начала линии)
  const triangleToCircleDistance = 4; // Расстояние от нижней точки треугольника до верхней точки кружка
  const circleRadius = 3;
  // Нижняя точка треугольника: triangleTopY + triangleHeight
  // Верхняя точка кружка: circleY - circleRadius
  // Расстояние между ними: triangleToCircleDistance
  // Поэтому: circleY - circleRadius = triangleTopY + triangleHeight + triangleToCircleDistance
  const circleY = triangleTopY + triangleHeight + triangleToCircleDistance + circleRadius;
  
  // Вычисляем начало линии: такое же расстояние от нижней точки кружка до начала линии
  const circleToLineDistance = 4; // Расстояние от нижней точки кружка до начала линии времени
  // Нижняя точка кружка: circleY + circleRadius
  // Начало линии: lineStartY
  // Расстояние между ними: circleToLineDistance
  const lineStartY = circleY + circleRadius + circleToLineDistance;
  
  // Рисуем линию времени снизу вверх, заканчивается до кружка сверху
  const lineEndY = circleY - circleRadius; // Линия заканчивается до верхней точки кружка
  ctx.strokeStyle = '#DDBB73';
  ctx.lineWidth = 2 / 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(roundedX, height); // Начинаем снизу графика
  ctx.lineTo(roundedX, lineEndY); // Заканчиваем до кружка сверху
  ctx.stroke();
  
  // Угол левой стороны от вертикали (используется только если useHeightAndWidth = false)
  const leftAngle = -45; // Угол левой стороны от вертикали (отрицательный = влево)
  
  // Общий угол поворота треугольника (можно настроить, в градусах)
  const triangleRotationAngle = 180; // 0 = вниз, 90 = вправо, -90 = влево, 180 = вверх
  
  // Центр вращения треугольника (точка прижатия к маркеру + отступ)
  // Используем плавную позицию для плавного движения треугольника
  const rotationCenterX = roundedX;
  const rotationCenterY = triangleTopY;
  
  // Конвертируем угол поворота из градусов в радианы
  const rotationRad = (triangleRotationAngle * Math.PI) / 180;
  
  // Вычисляем точки треугольника
  const topPoint = { x: 0, y: 0 };
  let leftPoint, rightPoint;
  
  if (useHeightAndWidth) {
    // СПОСОБ 1: Через высоту и ширину (проще для широкого и низкого треугольника)
    leftPoint = {
      x: -triangleBaseWidth / 2,
      y: triangleHeight,
    };
    rightPoint = {
      x: triangleBaseWidth / 2,
      y: triangleHeight,
    };
  } else {
    // СПОСОБ 2: Через длины всех трех сторон
    const leftAngleRad = (leftAngle * Math.PI) / 180;
    
    // Левая нижняя точка (вычисляется через длину и угол)
    leftPoint = {
      x: leftSideLength * Math.sin(leftAngleRad),
      y: leftSideLength * Math.cos(leftAngleRad),
    };
    
    // Правая нижняя точка вычисляется через закон косинусов
    const cosAngle = (leftSideLength ** 2 + rightSideLength ** 2 - baseSideLength ** 2) / 
                     (2 * leftSideLength * rightSideLength);
    const angleBetweenSides = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const rightAngleRad = leftAngleRad + angleBetweenSides;
    
    // Правая нижняя точка (вычисляется через длину и угол)
    rightPoint = {
      x: rightSideLength * Math.sin(rightAngleRad),
      y: rightSideLength * Math.cos(rightAngleRad),
    };
  }
  
  const trianglePoints = [topPoint, leftPoint, rightPoint];
  
  // Применяем общий поворот к точкам треугольника
  const rotatedPoints = trianglePoints.map(point => {
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    return {
      x: rotationCenterX + point.x * cos - point.y * sin,
      y: rotationCenterY + point.x * sin + point.y * cos,
    };
  });
  
  // Рисуем треугольник с поворотом
  ctx.fillStyle = 'rgba(221, 187, 115, 0.95)';
  ctx.strokeStyle = 'rgba(221, 187, 115, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);
  ctx.lineTo(rotatedPoints[1].x, rotatedPoints[1].y);
  ctx.lineTo(rotatedPoints[2].x, rotatedPoints[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(221, 187, 115, 0.9)';
  ctx.strokeStyle = 'rgba(221, 187, 115, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(roundedX, circleY, circleRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawHoveredButtonGradient(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  topPadding: number,
  chartAreaHeight: number,
  hoveredButton: 'buy' | 'sell' | null,
  realCandles?: Candle[],
  animatedPrice?: number | null,
): void {
  if (!hoveredButton || candles.length === 0) return;

  let price: number;
  
  if (animatedPrice !== null && animatedPrice !== undefined) {
    price = animatedPrice;
  } else if (realCandles && realCandles.length > 0) {
    const lastRealCandle = realCandles[realCandles.length - 1];
    price = lastRealCandle.close;
  } else {
    const lastCandle = candles[candles.length - 1];
    price = lastCandle.close;
  }
  
  // Рассчитываем Y координату цены относительно области свечей (chartAreaHeight)
  // Затем добавляем topPadding, чтобы получить координату относительно полной высоты
  const priceYInChartArea = priceToPixel(price, viewport, chartAreaHeight);
  const priceY = priceYInChartArea + topPadding;

  if (priceY < 0 || priceY > height) return;

  ctx.save();
  
  let gradient: CanvasGradient;
  
  if (hoveredButton === 'buy') {
    // Градиент выше линии цены (от цены до верха)
    gradient = ctx.createLinearGradient(0, priceY, 0, 0);
    gradient.addColorStop(0, 'rgba(50, 172, 65, 0.075)');
    gradient.addColorStop(1, 'rgba(50, 172, 65, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, priceY);
  } else {
    // Градиент ниже линии цены (от цены до низа)
    gradient = ctx.createLinearGradient(0, priceY, 0, height);
    gradient.addColorStop(0, 'rgba(247, 82, 95, 0.075)');
    gradient.addColorStop(1, 'rgba(247, 82, 95, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, priceY, width, height - priceY);
  }
  
  ctx.restore();
}

export function drawHoveredButtonArrow(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  hoveredButton: 'buy' | 'sell' | null,
  realCandles?: Candle[],
  animatedPrice?: number | null,
  currentTime?: number,
  timeframe?: Timeframe,
): void {
  if (!hoveredButton || candles.length === 0) return;

  let price: number;
  
  if (animatedPrice !== null && animatedPrice !== undefined) {
    price = animatedPrice;
  } else if (realCandles && realCandles.length > 0) {
    const lastRealCandle = realCandles[realCandles.length - 1];
    price = lastRealCandle.close;
  } else {
    const lastCandle = candles[candles.length - 1];
    price = lastCandle.close;
  }
  
  const priceY = priceToPixel(price, viewport, height);

  if (priceY < 0 || priceY > height) return;

  let markerX = width - 100;
  
  if (currentTime !== undefined && timeframe) {
    const rawTime = currentTime;
    const timeframeDurationMs = getTimeframeDurationMs(timeframe) ?? 60_000;
    const lastCandle = candles[candles.length - 1];
    let timeIndex: number | null = null;
    
    const lastCandleEndTime = lastCandle.openTime + timeframeDurationMs;
    
    if (rawTime >= lastCandle.openTime && rawTime <= lastCandleEndTime) {
      const timeSinceLastCandle = rawTime - lastCandle.openTime;
      timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
    } else if (rawTime > lastCandleEndTime) {
      if (candles.length > 1) {
        const prevCandle = candles[candles.length - 2];
        const timeDiff = lastCandle.openTime - prevCandle.openTime;
        if (timeDiff > 0) {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeDiff);
        } else {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
        }
      } else {
        const timeSinceLastCandle = rawTime - lastCandle.openTime;
        timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
      }
    } else {
      timeIndex = candles.length - 1;
    }
    
    if (timeIndex !== null) {
      const timeX = xIndexToPixel(timeIndex, viewport, width);
      const markerSize = 8 / 3;
      const textPadding = 8;
      const textX = timeX + markerSize + textPadding;
      
      ctx.font = '11px monospace';
      const nextCandleTime = lastCandle.openTime + timeframeDurationMs;
      const timeRemaining = nextCandleTime - rawTime;
      const countdownStr = formatCountdown(timeRemaining);
      const textMetrics = ctx.measureText(countdownStr);
      const textWidth = textMetrics.width;
      
      markerX = textX + textWidth + 20;
    }
  }
  
  if (markerX < 0 || markerX > width) return;

  ctx.save();
  
  const arrowLength = 48;
  const arrowWidth = 6;
  const triangleSize = 16 * 0.8;
  const triangleWidth = 14;
  
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = hoveredButton === 'buy' ? '#32AC41' : '#F7525F';
  ctx.strokeStyle = hoveredButton === 'buy' ? '#32AC41' : '#F7525F';
  ctx.lineWidth = 1;
  
  const arrowAngle = hoveredButton === 'buy' ? -Math.PI / 4 : Math.PI / 4;
  const priceOffset = hoveredButton === 'buy' ? -10 : 10;
  const startX = markerX;
  const startY = priceY + priceOffset;
  
  const cosAngle = Math.cos(arrowAngle);
  const sinAngle = Math.sin(arrowAngle);
  const perpCos = -sinAngle;
  const perpSin = cosAngle;
  
  const bodyLength = (arrowLength - triangleSize) * 0.8;
  const bodyEndX = startX + bodyLength * cosAngle;
  const bodyEndY = startY + bodyLength * sinAngle;
  
  const halfWidth = arrowWidth / 2;
  const p1x = startX + halfWidth * perpCos;
  const p1y = startY + halfWidth * perpSin;
  const p2x = bodyEndX + halfWidth * perpCos;
  const p2y = bodyEndY + halfWidth * perpSin;
  const p3x = bodyEndX - halfWidth * perpCos;
  const p3y = bodyEndY - halfWidth * perpSin;
  const p4x = startX - halfWidth * perpCos;
  const p4y = startY - halfWidth * perpSin;
  
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.lineTo(p3x, p3y);
  ctx.lineTo(p4x, p4y);
  ctx.closePath();
  ctx.fill();
  
  const triangleTipX = startX + arrowLength * cosAngle;
  const triangleTipY = startY + arrowLength * sinAngle;
  const triangleHalfWidth = triangleWidth / 2;
  
  ctx.beginPath();
  ctx.moveTo(bodyEndX, bodyEndY);
  ctx.lineTo(triangleTipX, triangleTipY);
  ctx.lineTo(bodyEndX + triangleHalfWidth * perpCos, bodyEndY + triangleHalfWidth * perpSin);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(bodyEndX, bodyEndY);
  ctx.lineTo(triangleTipX, triangleTipY);
  ctx.lineTo(bodyEndX - triangleHalfWidth * perpCos, bodyEndY - triangleHalfWidth * perpSin);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// Статическая переменная для ограничения частоты логирования в drawActiveCandlePriceLine
const drawActiveCandlePriceLineLastLogTime = 0;

export function drawActiveCandlePriceLine(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  chartAreaHeight: number,
  fullHeight: number,
  topPadding: number,
  realCandles?: Candle[],
  animatedPrice?: number | null,
): void {
  if (candles.length === 0) return;

  let price: number;
  let priceSource: string;
  
  if (animatedPrice !== null && animatedPrice !== undefined) {
    price = animatedPrice;
    priceSource = 'animatedPrice';
  } else if (realCandles && realCandles.length > 0) {
    const lastRealCandle = realCandles[realCandles.length - 1];
    price = lastRealCandle.close;
    priceSource = 'realCandles';
  } else {
    const lastCandle = candles[candles.length - 1];
    price = lastCandle.close;
    priceSource = 'candles';
  }
  
  // Вычисляем Y координату относительно chartAreaHeight, затем добавляем topPadding для абсолютных координат canvas
  const yRelative = priceToPixel(price, viewport, chartAreaHeight);
  const y = yRelative + topPadding;
  
  // Логирование для диагностики проблем с линией цены (не чаще раза в секунду)
  const now = Date.now();
  // Логирование отключено для уменьшения шума
  // const visibilityState = typeof document !== 'undefined' ? document.visibilityState : 'unknown';
  // if (!drawActiveCandlePriceLineLastLogTime || now - drawActiveCandlePriceLineLastLogTime > 1000) {
  //   console.log('[drawActiveCandlePriceLine] 💰 ЛИНИЯ ЦЕНЫ', {...});
  //   drawActiveCandlePriceLineLastLogTime = now;
  // }

  // Разрешаем отрисовку линии даже если она немного вне видимой области
  if (y < -50 || y > fullHeight + 50) return;

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();

  const priceText = formatPrice(price);
  const textPadding = 8;
  const textX = width - 10;
  const textY = y;

  ctx.font = '12px monospace';
  const textMetrics = ctx.measureText(priceText);
  const textWidth = textMetrics.width;
  const textHeight = 16;
  const paddingX = 6;
  const paddingY = 3;
  const rectX = textX - textWidth - paddingX * 2;
  const rectY = textY - textHeight / 2 - paddingY;
  const rectWidth = textWidth + paddingX * 2;
  const rectHeight = textHeight + paddingY * 2;
  
  const bgGradient = ctx.createLinearGradient(rectX, rectY, rectX + rectWidth, rectY + rectHeight);
  bgGradient.addColorStop(0, 'rgba(74, 158, 255, 0.95)');
  bgGradient.addColorStop(1, 'rgba(74, 158, 255, 0.95)');
  ctx.fillStyle = bgGradient;
  
  const borderRadius = 6;
  fillRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, borderRadius);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(priceText, textX - paddingX, textY);

  ctx.setLineDash([]);
  ctx.restore();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function drawPriceTimeIntersectionMarker(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  currentTime: number | undefined,
  width: number,
  height: number,
  timeframe: Timeframe,
  realCandles?: Candle[],
  animatedPrice?: number | null,
  topPadding?: number,
): void {
  if (candles.length === 0) return;

  const lastCandle = candles[candles.length - 1];
  
  let price: number;
  
  if (animatedPrice !== null && animatedPrice !== undefined) {
    price = animatedPrice;
  } else if (realCandles && realCandles.length > 0) {
    const lastRealCandle = realCandles[realCandles.length - 1];
    price = lastRealCandle.close;
  } else {
    price = lastCandle.close;
  }
  
  // Вычисляем priceY относительно chartAreaHeight (без topPadding)
  // Используем ту же логику, что и drawActiveCandlePriceLine
  // height уже должен быть chartAreaHeightForCandles + topPadding, поэтому вычитаем topPadding
  const chartAreaHeight = height - (topPadding || 0);
  const priceY = priceToPixel(price, viewport, chartAreaHeight);
  
  // Разрешаем отрисовку маркера даже если он немного вне видимой области
  if (priceY < -50 || priceY > chartAreaHeight + 50) return;

  // ВСЕГДА используем серверное время из Redux (переданное через currentTime), а не локальное время
  // Если currentTime не передан, используем getServerTime() как fallback
  // Это гарантирует, что все пользователи видят одинаковое время окончания активной свечи
  const rawTime = currentTime !== undefined ? currentTime : getServerTime();
  const timeframeDurationMs = getTimeframeDurationMs(timeframe) ?? 60_000;
  
  let timeIndex: number | null = null;

  if (candles.length > 0) {
    const lastCandleEndTime = lastCandle.openTime + timeframeDurationMs;
    
    if (rawTime >= lastCandle.openTime && rawTime <= lastCandleEndTime) {
      const timeSinceLastCandle = rawTime - lastCandle.openTime;
      timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
    } else if (rawTime > lastCandleEndTime) {
      if (candles.length > 1) {
        const prevCandle = candles[candles.length - 2];
        const timeDiff = lastCandle.openTime - prevCandle.openTime;
        if (timeDiff > 0) {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeDiff);
        } else {
          const timeSinceLastCandle = rawTime - lastCandle.openTime;
          timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
        }
      } else {
        const timeSinceLastCandle = rawTime - lastCandle.openTime;
        timeIndex = candles.length - 1 + (timeSinceLastCandle / timeframeDurationMs);
      }
    } else {
      timeIndex = timeToIndex(rawTime, candles);
      if (timeIndex === null) {
        timeIndex = candles.length - 1;
      }
    }
  }

  if (timeIndex === null) return;

  const timeX = xIndexToPixel(timeIndex, viewport, width);
  
  // Разрешаем отрисовку маркера даже если он немного вне видимой области
  if (timeX < -100 || timeX > width + 100) return;

  const nextCandleTime = lastCandle.openTime + timeframeDurationMs;
  const timeRemaining = nextCandleTime - rawTime;
  const countdownStr = formatCountdown(timeRemaining);

  ctx.save();

  const markerSize = 8 / 3;
  // Округляем координату X до целого пикселя для точного центрирования на линии времени
  const markerX = Math.round(timeX);
  // Добавляем topPadding к Y координате, так как маркер рисуется после ctx.restore()
  const markerY = priceY + (topPadding || 0);

  ctx.fillStyle = 'rgba(74, 158, 255, 0.9)';
  ctx.strokeStyle = 'rgba(74, 158, 255, 0.8)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.arc(markerX, markerY, markerSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const textPadding = 8;
  const textX = markerX + markerSize + textPadding;
  const textY = markerY;

  ctx.font = '11px monospace';
  const textMetrics = ctx.measureText(countdownStr);
  const textWidth = textMetrics.width;
  const textHeight = 14;
  const paddingX = 6;
  const paddingY = 3;
  const rectX = textX - paddingX;
  const rectY = textY - textHeight / 2 - paddingY;
  const rectWidth = textWidth + paddingX * 2;
  const rectHeight = textHeight + paddingY * 2;

  if (textX + rectWidth > width) {
    const adjustedTextX = markerX - markerSize - textPadding;
    const adjustedRectX = adjustedTextX - textWidth - paddingX;
    
    const bgGradient = ctx.createLinearGradient(adjustedRectX, rectY, adjustedRectX + rectWidth, rectY + rectHeight);
    bgGradient.addColorStop(0, 'rgba(74, 158, 255, 0.95)');
    bgGradient.addColorStop(1, 'rgba(74, 158, 255, 0.95)');
    ctx.fillStyle = bgGradient;
    
    const borderRadius = 6;
    ctx.beginPath();
    ctx.roundRect(adjustedRectX, rectY, rectWidth, rectHeight, borderRadius);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(countdownStr, adjustedTextX, textY);
  } else {
    const bgGradient = ctx.createLinearGradient(rectX, rectY, rectX + rectWidth, rectY + rectHeight);
    bgGradient.addColorStop(0, 'rgba(74, 158, 255, 0.95)');
    bgGradient.addColorStop(1, 'rgba(74, 158, 255, 0.95)');
    ctx.fillStyle = bgGradient;
    
    const borderRadius = 6;
    ctx.beginPath();
    ctx.roundRect(rectX, rectY, rectWidth, rectHeight, borderRadius);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(countdownStr, textX, textY);
  }

  ctx.restore();
}

function drawOCHLInfo(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  timeframe: Timeframe,
  width: number,
  height: number,
  hoverCandle: Candle | null = null,
): void {
  // Показываем OCHL только при наведении мыши на график
  if (hoverCandle === null) return;
  
  if (candles.length === 0) return;

  if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
    return;
  }

  const candleToShow = hoverCandle;
  const padding = 10;
  const lineHeight = 18; // Увеличен для лучшей читаемости
  const toolbarHeight = 40; // Высота toolbar
  const toolbarBottom = 25; // Toolbar находится на bottom: 25px
  const ochlToolbarGap = 10; // Отступ между OCHL и toolbar
  // Toolbar находится от height - 65 до height - 25
  // OCHL должен заканчиваться выше toolbar, на height - 75px (height - toolbarBottom - toolbarHeight - gap)
  // OCHL начинается на height - 75 - (lineHeight * 5) - padding = height - 175px (5 строк: O, H, L, C, timeframe)
  const startY = height - toolbarBottom - toolbarHeight - ochlToolbarGap - (lineHeight * 5) - padding;

  ctx.save();
  ctx.font = '14px monospace'; // Увеличен размер шрифта для лучшей читаемости
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Серый цвет вместо белого
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillText(`O: ${formatPrice(candleToShow.open)}`, padding, startY);
  ctx.fillText(`H: ${formatPrice(candleToShow.high)}`, padding, startY + lineHeight);
  ctx.fillText(`L: ${formatPrice(candleToShow.low)}`, padding, startY + lineHeight * 2);
  ctx.fillText(`C: ${formatPrice(candleToShow.close)}`, padding, startY + lineHeight * 3);
  ctx.fillText(`${timeframe}`, padding, startY + lineHeight * 4);

  ctx.restore();
}

function convertCandlesForIndicators(candles: Candle[]): IndicatorCandle[] {
  return candles.map(c => ({
    x: c.openTime,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
  }));
}

function createIndicatorContext(
  ctx: CanvasRenderingContext2D,
  candles: IndicatorCandle[],
  viewport: ViewportState,
  width: number,
  height: number,
): IndicatorRenderContext {
  const fromIdx = Math.max(0, Math.floor(viewport.fromIndex));
  const toIdx = Math.min(candles.length - 1, Math.ceil(viewport.toIndex));
  const visibleCandles = candles.slice(fromIdx, toIdx + 1);

  const timestampToIndexMap = new Map<number, number>();
  candles.forEach((candle, index) => {
    timestampToIndexMap.set(candle.x, index);
  });

  const xScale = {
    min: viewport.fromIndex,
    max: viewport.toIndex,
    getPixelForValue: (timestamp: number): number => {
      let index = timestampToIndexMap.get(timestamp);
      
      if (index === undefined) {
        for (let i = 0; i < candles.length; i++) {
          if (Math.abs(candles[i].x - timestamp) < 1000) {
            index = i;
            break;
          }
        }
      }
      
      if (index === undefined) {
        for (let i = 0; i < candles.length - 1; i++) {
          if (candles[i].x <= timestamp && candles[i + 1].x >= timestamp) {
            const timeDiff = candles[i + 1].x - candles[i].x;
            if (timeDiff > 0) {
              const ratio = (timestamp - candles[i].x) / timeDiff;
              index = i + ratio;
              break;
            }
          }
        }
      }
      
      if (index === undefined) {
        if (candles.length === 0) {
          return 0;
        }
        if (timestamp < candles[0].x) {
          index = 0;
        } else if (timestamp > candles[candles.length - 1].x) {
          index = candles.length - 1;
        } else {
          return 0;
        }
      }
      
      return xIndexToPixel(index, viewport, width);
    },
  };

  const yScale = {
    min: viewport.minPrice,
    max: viewport.maxPrice,
    getPixelForValue: (price: number): number => {
      if (!Number.isFinite(price)) {
        return height / 2;
      }
      return priceToPixel(price, viewport, height);
    },
  };

  return {
    ctx,
    chartArea: {
      left: 0,
      top: 0,
      right: width,
      bottom: height,
    },
    xScale,
    yScale,
    candles,
    visibleCandles,
  };
}

export function drawIndicators(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  viewport: ViewportState,
  width: number,
  height: number,
  activeIndicators: string[],
): void {
  if (!activeIndicators || activeIndicators.length === 0) {
    return;
  }

  if (candles.length === 0) {
    return;
  }

  const indicatorCandles = convertCandlesForIndicators(candles);
  
  if (indicatorCandles.length === 0) {
    return;
  }

  const context = createIndicatorContext(ctx, indicatorCandles, viewport, width, height);

  for (const indicatorId of activeIndicators) {
    try {
      const renderer = getIndicatorRenderer(indicatorId);
      if (!renderer) {
        continue;
      }

      if (candles.length < renderer.minCandles) {
        continue;
      }

      ctx.save();
      renderer.render(context);
      ctx.restore();
    } catch (error) {

    }
  }
}

function drawDrawings(
  ctx: CanvasRenderingContext2D,
  drawingState: DrawingState | undefined,
  timestampToPixel: ((timestamp: number) => number | null) | undefined,
  priceToPixel: ((price: number) => number | null) | undefined,
  width: number,
  height: number,
): void {
  if (!drawingState || !drawingState.lines || drawingState.lines.length === 0) {
    if (!drawingState || !drawingState.startPoint || !drawingState.currentPoint || !drawingState.mode) {
      return;
    }
  }

  if (!timestampToPixel || !priceToPixel) {
    return;
  }

  for (const line of drawingState.lines || []) {
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.fillStyle = line.fillColor || line.color;
    ctx.lineWidth = 2;

    if (line.type === 'straight' || line.type === 'arrow') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);

      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (line.type === 'arrow') {
          const angle = Math.atan2(endY - startY, endX - startX);
          const arrowLength = 10;
          const arrowAngle = Math.PI / 6;
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle - arrowAngle),
            endY - arrowLength * Math.sin(angle - arrowAngle)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle + arrowAngle),
            endY - arrowLength * Math.sin(angle + arrowAngle)
          );
          ctx.stroke();
        }
      }
    } else if (line.type === 'horizontal') {
      const y = priceToPixel(line.startPrice);
      if (y !== null) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (line.type === 'vertical') {
      const x = timestampToPixel(line.startTime);
      if (x !== null) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    } else if (line.type === 'freehand' && line.points && line.points.length > 0) {
      ctx.beginPath();
      let firstPoint = true;
      for (const point of line.points) {
        const x = timestampToPixel(point.time);
        const y = priceToPixel(point.price);
        if (x !== null && y !== null) {
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    } else if (line.type === 'rectangle') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);

      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);

        if (line.filled && line.fillColor) {
          ctx.fillStyle = line.fillColor;
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      }
    } else if (line.type === 'circle') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);

      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radius = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        if (line.filled && line.fillColor) {
          ctx.fillStyle = line.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      }
    } else if (line.type === 'text' && line.text) {
      const x = timestampToPixel(line.startTime);
      const y = priceToPixel(line.startPrice);
      if (x !== null && y !== null) {
        ctx.font = '14px monospace';
        ctx.fillStyle = line.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(line.text, x, y);
      }
    } else if (line.type === 'parallel') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const dx = endX - startX;
        const dy = endY - startY;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.moveTo(startX + dx * 0.3, startY + dy * 0.3);
        ctx.lineTo(endX + dx * 0.3, endY + dy * 0.3);
        ctx.stroke();
      }
    } else if (line.type === 'fibonacci') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const priceRange = Math.abs(line.endPrice - line.startPrice);
        const isUp = line.endPrice > line.startPrice;
        const basePrice = isUp ? line.startPrice : line.endPrice;
        const levels = line.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        levels.forEach((level) => {
          const price = basePrice + priceRange * level;
          const y = priceToPixel(price);
          if (y !== null) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
            ctx.fillText(`${(level * 100).toFixed(1)}%`, startX - 5, y);
          }
        });
      }
    } else if (line.type === 'channel') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const dx = endX - startX;
        const dy = endY - startY;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.moveTo(startX, startY + dy);
        ctx.lineTo(endX, endY + dy);
        ctx.moveTo(startX, startY - dy);
        ctx.lineTo(endX, endY - dy);
        ctx.stroke();
      }
    } else if (line.type === 'trendline') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (line.type === 'zone') {
      const startX = timestampToPixel(line.startTime);
      const startY = priceToPixel(line.startPrice);
      const endX = timestampToPixel(line.endTime);
      const endY = priceToPixel(line.endPrice);
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = line.color;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        ctx.globalAlpha = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      }
    }

    ctx.restore();
  }

  if (drawingState.startPoint && drawingState.currentPoint && drawingState.mode) {
    ctx.save();
    ctx.strokeStyle = drawingState.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (drawingState.mode === 'line' || drawingState.mode === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
      ctx.stroke();
    } else if (drawingState.mode === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, drawingState.startPoint.y);
      ctx.lineTo(width, drawingState.startPoint.y);
      ctx.stroke();
    } else if (drawingState.mode === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(drawingState.startPoint.x, 0);
      ctx.lineTo(drawingState.startPoint.x, height);
      ctx.stroke();
    } else if (drawingState.mode === 'freehand' && drawingState.currentPath && drawingState.currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(drawingState.currentPath[0].x, drawingState.currentPath[0].y);
      for (let i = 1; i < drawingState.currentPath.length; i++) {
        ctx.lineTo(drawingState.currentPath[i].x, drawingState.currentPath[i].y);
      }
      ctx.stroke();
    } else if (drawingState.mode === 'rectangle') {
      const rectX = Math.min(drawingState.startPoint.x, drawingState.currentPoint.x);
      const rectY = Math.min(drawingState.startPoint.y, drawingState.currentPoint.y);
      const rectWidth = Math.abs(drawingState.currentPoint.x - drawingState.startPoint.x);
      const rectHeight = Math.abs(drawingState.currentPoint.y - drawingState.startPoint.y);
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    } else if (drawingState.mode === 'circle') {
      const centerX = (drawingState.startPoint.x + drawingState.currentPoint.x) / 2;
      const centerY = (drawingState.startPoint.y + drawingState.currentPoint.y) / 2;
      const radius = Math.sqrt(
        (drawingState.currentPoint.x - drawingState.startPoint.x) ** 2 +
        (drawingState.currentPoint.y - drawingState.startPoint.y) ** 2
      ) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (drawingState.mode === 'parallel') {
      const dx = drawingState.currentPoint.x - drawingState.startPoint.x;
      const dy = drawingState.currentPoint.y - drawingState.startPoint.y;
      ctx.beginPath();
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
      ctx.moveTo(drawingState.startPoint.x + dx * 0.3, drawingState.startPoint.y + dy * 0.3);
      ctx.lineTo(drawingState.currentPoint.x + dx * 0.3, drawingState.currentPoint.y + dy * 0.3);
      ctx.stroke();
    } else if (drawingState.mode === 'fibonacci') {
      const priceRange = Math.abs(drawingState.currentPoint.y - drawingState.startPoint.y);
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
      levels.forEach((level) => {
        const y = drawingState.startPoint.y + priceRange * level;
        ctx.beginPath();
        ctx.moveTo(drawingState.startPoint.x, y);
        ctx.lineTo(drawingState.currentPoint.x, y);
        ctx.stroke();
      });
    } else if (drawingState.mode === 'channel') {
      const dx = drawingState.currentPoint.x - drawingState.startPoint.x;
      const dy = drawingState.currentPoint.y - drawingState.startPoint.y;
      ctx.beginPath();
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y + dy);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y + dy);
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y - dy);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y - dy);
      ctx.stroke();
    } else if (drawingState.mode === 'trendline') {
      ctx.beginPath();
      ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y);
      ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
      ctx.stroke();
    } else if (drawingState.mode === 'zone') {
      const rectX = Math.min(drawingState.startPoint.x, drawingState.currentPoint.x);
      const rectY = Math.min(drawingState.startPoint.y, drawingState.currentPoint.y);
      const rectWidth = Math.abs(drawingState.currentPoint.x - drawingState.startPoint.x);
      const rectHeight = Math.abs(drawingState.currentPoint.y - drawingState.startPoint.y);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = drawingState.color;
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
      ctx.globalAlpha = 1;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }
}

// Статическая переменная для ограничения частоты логирования в renderChart
export function renderChart(params: RenderParams): void {
  const { ctx, width, height, candles, viewport, timeframe, hoverIndex, hoverCandle, hoverX, hoverY, backgroundImage, currentTime, activeIndicators, drawingState, timestampToPixel, priceToPixel, chartView = 'candles', realCandles, animatedPrice, bottomPadding = 0 } = params;
  

  // Вычисляем высоту области графика
  // Активная область свечей должна заканчиваться ровно над OCHL
  // Toolbar на bottom: 25px, высотой 40px (toolbar от height - 65 до height - 25)
  // OCHL начинается на height - ~143px (height - 25 - 40 - 10 - 57.6 - 10)
  // Область свечей должна заканчиваться выше OCHL, примерно на height - 145px
  const ochlBottomPadding = 145;
  const topPadding = 110; // Верхний отступ такой же как нижний
  const chartAreaHeight = height - bottomPadding - ochlBottomPadding - topPadding;
  // Сетка должна идти до самого низа (полная высота)
  const gridHeight = height;
  // Временная шкала должна быть видна под интерфейсом ставок
  const mobileBottomMenuHeight = +14; // Высота нижнего меню навигации
  const timeAxisY = bottomPadding > 0 ? height - mobileBottomMenuHeight - 5 : height - 20;

  clearCanvas(ctx, width, height);
  drawBackground(ctx, width, height, backgroundImage);
  
  // Сетка рисуется ПЕРЕД свечами, чтобы быть под ними
  // Сетка рисуется на полную высоту
  drawGridY(ctx, viewport, width, gridHeight);
  drawGridX(ctx, candles, viewport, timeframe, width, height, gridHeight, timeAxisY);
  
  // Рисуем свечи и элементы графика с учетом верхнего отступа (поверх сетки)
  ctx.save();
  ctx.translate(0, topPadding);
  
  if (chartView === 'line') {
    drawLineChart(ctx, candles, viewport, width, chartAreaHeight, hoverIndex);
  } else if (chartView === 'area') {
    drawAreaChart(ctx, candles, viewport, width, chartAreaHeight, hoverIndex);
  } else {
    drawCandles(ctx, candles, viewport, width, chartAreaHeight, hoverIndex);
  }
  
  if (activeIndicators && activeIndicators.length > 0) {
    drawIndicators(ctx, candles, viewport, width, chartAreaHeight, activeIndicators);
  }
  
  if (drawingState) {
    drawDrawings(ctx, drawingState, timestampToPixel, priceToPixel, width, chartAreaHeight);
  }
  
  drawPriceTimeIntersectionMarker(ctx, candles, viewport, currentTime, width, chartAreaHeight, timeframe, realCandles, params.animatedPrice);
  drawHoveredButtonArrow(ctx, candles, viewport, width, chartAreaHeight, params.hoveredButton, realCandles, params.animatedPrice, currentTime, timeframe);
  
  ctx.restore();
  
  // Линии перекрестия и цены рисуются на полную высоту canvas (после restore, чтобы не учитывать translate)
  // Ластик тоже рисуем после restore, чтобы использовать абсолютные координаты canvas
  drawEraserArea(ctx, drawingState, params.eraserPosition, width, height);
  drawActiveCandlePriceLine(ctx, candles, viewport, width, chartAreaHeight, height, topPadding, realCandles, params.animatedPrice);
  drawCrosshair(ctx, hoverIndex, hoverCandle, hoverX, hoverY, viewport, width, height, topPadding, chartAreaHeight, timeframe);
  drawTimeLine(ctx, currentTime, candles, viewport, width, height, timeframe);
  
  // Градиент при наведении на buy/sell рисуется на всю высоту графика
  drawHoveredButtonGradient(ctx, candles, viewport, width, height, topPadding, chartAreaHeight, params.hoveredButton, realCandles, params.animatedPrice);
  // OCHL рисуется в полной высоте, а не в chartAreaHeight
  drawOCHLInfo(ctx, candles, timeframe, width, height, hoverCandle);
}

function drawEraserArea(
  ctx: CanvasRenderingContext2D,
  drawingState: DrawingState | undefined,
  eraserPosition: { x: number; y: number } | null | undefined,
  width: number,
  height: number,
): void {
  if (!drawingState || drawingState.mode !== 'eraser' || !eraserPosition) {
    return;
  }

  const eraserRadius = drawingState.eraserRadius || 10;
  
  ctx.save();
  
  // Создаем белый полупрозрачный круг с эффектом блюра
  // Рисуем несколько слоев с разной прозрачностью для создания эффекта размытия
  
  // Внешний слой - самый прозрачный и большой (эффект блюра)
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, eraserRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Средний слой
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, eraserRadius * 1.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Основной слой - более видимый
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, eraserRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Внутренний слой для лучшей видимости
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, eraserRadius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  
  // Видимая обводка для четкого обозначения границ
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, eraserRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Центральная точка для лучшей видимости
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eraserPosition.x, eraserPosition.y, 2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

