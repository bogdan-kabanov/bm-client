import { formatPrice, getPriceDecimals } from '../utils/priceFormatter';

const LINE_COLOR = '#FFFFFF';
const LINE_WIDTH = 2;

interface PriceLineRendererParams {
  currentPrice: number | null;
  lastCandleRef: React.MutableRefObject<{ c?: number; y?: number } | null>;
  currentPriceRef: React.MutableRefObject<number | null>;
}

/**
 * Класс для отрисовки линии текущей цены без конфликтов с другими плагинами
 */
export class PriceLineRenderer {
  private currentPrice: number | null;
  private lastCandleRef: React.MutableRefObject<{ c?: number; y?: number } | null>;
  private currentPriceRef: React.MutableRefObject<number | null>;
  private lastDrawnPrice: number | null = null;
  private animationFrameId: number | null = null;
  private isDrawing: boolean = false;
  private animatedPrice: number | null = null; // Плавно анимируемая цена
  private targetPrice: number | null = null; // Целевая цена для анимации
  private smoothingFactor: number = 0.05; // Коэффициент сглаживания (максимально плавная анимация, синхронизирован с анимацией свечи)
  private priceThreshold: number = 0.0001; // Порог минимальной разницы
  private lastUpdateTime: number = 0; // Время последнего обновления для дебаунсинга
  private isAnimating: boolean = false; // Флаг активности анимации
  private fixedLabelWidth: number | null = null; // Фиксированная ширина плашки для предотвращения дергания

  constructor(params: PriceLineRendererParams) {
    this.currentPrice = params.currentPrice;
    this.lastCandleRef = params.lastCandleRef;
    this.currentPriceRef = params.currentPriceRef;
  }

  /**
   * Обновить текущую цену
   */
  updatePrice(price: number | null, skipSmoothing: boolean = false) {
    this.currentPrice = price;
    
    // Если нужно пропустить сглаживание (например, при резком изменении), сразу устанавливаем целевую цену
    if (skipSmoothing && price !== null && Number.isFinite(price)) {
      if (this.animatedPrice === null) {
        this.animatedPrice = price;
      }
      this.targetPrice = price;
    }
  }

  /**
   * Получить текущую цену с приоритетом
   * ВАЖНО: Используем цену из последней свечи напрямую для синхронизации
   */
  private getCurrentPrice(): number | null {
    // Приоритет: цена из последней свечи (синхронизирована с графиком)
    const datasetPrice = this.lastCandleRef.current?.c ?? this.lastCandleRef.current?.y ?? null;
    if (datasetPrice !== null && Number.isFinite(datasetPrice)) {
      return datasetPrice;
    }
    // Fallback: используем currentPriceRef или currentPrice
    return this.currentPriceRef.current ?? this.currentPrice;
  }

  /**
   * Получить цену для отрисовки (синхронизированную со свечой)
   * Линия цены должна точно следовать за ценой закрытия последней свечи
   */
  private getAnimatedPrice(): number | null {
    const candlePrice = this.lastCandleRef.current?.c ?? this.lastCandleRef.current?.y ?? null;
    
    if (candlePrice !== null && Number.isFinite(candlePrice)) {
      this.animatedPrice = candlePrice;
      this.targetPrice = candlePrice;
      this.isAnimating = false;
      return candlePrice;
    }
    
    const refPrice = this.currentPriceRef.current;
    if (refPrice !== null && Number.isFinite(refPrice)) {
      this.animatedPrice = refPrice;
      this.targetPrice = refPrice;
      return refPrice;
    }
    
    // Fallback: если нет цены из свечи, используем currentPriceRef
    const targetPrice = this.currentPriceRef.current ?? this.getCurrentPrice();
    if (!targetPrice || !Number.isFinite(targetPrice)) {
      return null;
    }
    
    // Инициализируем анимируемую цену при первом вызове
    if (this.animatedPrice === null) {
      this.animatedPrice = targetPrice;
      this.targetPrice = targetPrice;
      return targetPrice;
    }
    
    // Обновляем целевую цену
    this.targetPrice = targetPrice;
    
    // Вычисляем разницу
    const diff = this.targetPrice - this.animatedPrice;
    
    // Если разница меньше порога, устанавливаем точное значение
    if (Math.abs(diff) < this.priceThreshold) {
      this.animatedPrice = this.targetPrice;
      this.isAnimating = false;
      return this.animatedPrice;
    }
    
    // Адаптивное сглаживание в зависимости от величины изменения
    const absDiff = Math.abs(diff);
    const priceScale = Math.max(1e-12, Math.abs(this.targetPrice || 1));
    const relDiff = absDiff / priceScale;
    
    // Для маленьких изменений - более плавное сглаживание (меньше дерганий)
    // Для больших изменений - быстрее реагируем
    let smoothingFactor: number;
    if (relDiff < 0.0001) {
      // Очень маленькие изменения - очень плавное сглаживание
      smoothingFactor = 0.15;
    } else if (relDiff < 0.001) {
      // Маленькие изменения - плавное сглаживание
      smoothingFactor = 0.20;
    } else {
      // Большие изменения - быстрее реагируем
      smoothingFactor = 0.30;
    }
    
    this.isAnimating = true;
    this.animatedPrice += diff * smoothingFactor;
    return this.animatedPrice;

  }

  /**
   * Отрисовка линии цены
   */
  draw(chart: any): void {
    // Используем плавно анимируемую цену вместо прямой
    const price = this.getAnimatedPrice();
    if (!price || !Number.isFinite(price)) return;

    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;

    const yScale = chart.scales.y;
    if (!yScale) return;

    const priceY = yScale.getPixelForValue(price);
    
    // Проверяем, что линия цены находится в пределах графика
    if (priceY < chartArea.top || priceY > chartArea.bottom) {
      return;
    }

    // Отрисовываем сразу без requestAnimationFrame, чтобы избежать конфликтов
    ctx.save();
    
    // Устанавливаем область отсечения для ограничения отрисовки пределами графика
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.clip();

    // Рисуем сплошную линию цены
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    const priceLineGradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    priceLineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    priceLineGradient.addColorStop(0.5, LINE_COLOR);
    priceLineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = priceLineGradient;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 10;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, priceY);
    ctx.lineTo(chartArea.right, priceY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Отрисовка метки с ценой
    this.drawPriceLabel(ctx, chart, price, priceY);

    this.lastDrawnPrice = price;
  }

  /**
   * Отрисовка метки с ценой
   */
  private drawPriceLabel(ctx: CanvasRenderingContext2D, chart: any, price: number, priceY: number): void {
    const chartArea = chart.chartArea;
    const labelBg = '#0E9AFF';
    const labelStroke = 'rgba(14, 154, 255, 0.85)';
    const labelText = '#FFFFFF';

    ctx.font = 'bold 12px "Inter", -apple-system, sans-serif';

    const priceLabel = Number.isFinite(price)
      ? formatPrice(price, '')
      : '--';

    const labelPaddingX = 12;
    const labelHeight = 24;
    const canvasWidth = chart.width;
    
    // ВАЖНО: Фиксируем ширину плашки, чтобы она не менялась при изменении цены
    // Это предотвращает дергание плашки влево-вправо
    if (this.fixedLabelWidth === null) {
      // Инициализируем фиксированную ширину при первом отображении
      // Используем максимально возможную ширину для разных форматов цен
      // Для мелких валют может быть до 8 знаков после запятой (например, $0.12345678)
      const maxPriceText = price < 0.01 ? '$0.12345678' : price < 1 ? '$0.123456' : '$99999.999';
      this.fixedLabelWidth = Math.max(68, ctx.measureText(maxPriceText).width + labelPaddingX * 2);
    }
    const labelWidth = this.fixedLabelWidth;
    
    // ВАЖНО: Прижимаем маркер цены к правому краю canvas без отступа
    const labelX = canvasWidth - labelWidth;
    
    // Позиция Y зависит только от цены (вертикальное движение)
    const labelY = priceY - labelHeight / 2;

    // Фон плашки
    ctx.fillStyle = labelBg;
    ctx.strokeStyle = labelStroke;
    ctx.lineWidth = 1;
    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(labelX + radius, labelY);
    ctx.lineTo(labelX + labelWidth - radius, labelY);
    ctx.quadraticCurveTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + radius);
    ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
    ctx.quadraticCurveTo(labelX + labelWidth, labelY + labelHeight, labelX + labelWidth - radius, labelY + labelHeight);
    ctx.lineTo(labelX + radius, labelY + labelHeight);
    ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - radius);
    ctx.lineTo(labelX, labelY + radius);
    ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Текст цены
    ctx.fillStyle = labelText;
    ctx.font = 'bold 12px "Inter", -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${priceLabel}`, labelX + labelPaddingX, labelY + labelHeight / 2);
  }

  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isDrawing = false;
  }

  /**
   * Создать плагин (не используется с новым CanvasChart)
   */
  createPlugin(): any {
    const self = this;
    return {
      id: 'priceLineRenderer',
      afterDraw: (chart) => {
        self.draw(chart);
      }
    };
  }
}

