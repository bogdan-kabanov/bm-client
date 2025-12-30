import { ChartTimeframe } from '../types';

// Интерфейс для параметров GridManager
export interface GridManagerParams {
  timeframe: ChartTimeframe;
}

// Интерфейс для настроек сетки
export interface GridConfig {
  // Вертикальные линии (ось X)
  verticalLines: {
    display: boolean;
    color: string;
    lineWidth: number;
  };
  // Горизонтальные линии (ось Y)
  horizontalLines: {
    display: boolean;
    color: string;
    lineWidth: number;
  };
  // Временные метки
  timeLabels: {
    display: boolean;
    color: string;
    font: {
      size: number;
      family: string;
      weight: string | number;
    };
  };
}

/**
 * Класс для управления сеткой графика
 */
export class GridManager {
  private timeframe: ChartTimeframe;
  private config: GridConfig;

  constructor(params: GridManagerParams, config?: Partial<GridConfig>) {
    this.timeframe = params.timeframe;
    this.config = {
      verticalLines: {
        display: true,
        color: 'rgba(255, 255, 255, 0.09)',
        lineWidth: 1,
        ...config?.verticalLines,
      },
      horizontalLines: {
        display: true,
        color: 'rgba(255, 255, 255, 0.09)',
        lineWidth: 1,
        ...config?.horizontalLines,
      },
      timeLabels: {
        display: true,
        color: 'rgba(255, 255, 255, 0.55)',
        font: {
          size: 11,
          family: '"Inter", -apple-system, sans-serif',
          weight: 500,
        },
        ...config?.timeLabels,
      },
    };
  }

  /**
   * Получить интервал свечи в миллисекундах
   */
  private getCandleInterval(): number {
    const intervalMs: Record<string, number> = {
      '15s': 15 * 1000,
      '30s': 30 * 1000,
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
    };
    return intervalMs[this.timeframe] || 60 * 1000;
  }

  /**
   * Вычислить оптимальный интервал между метками времени
   */
  private calculateTickSpacing(
    visibleRange: number,
    chartPixelWidth: number,
    candleInterval: number
  ): number {
    // При максимальном зуме (видно примерно 5 свечей) показываем сетку у каждой свечи
    // minRange = candleSpacing * 5, поэтому если visibleRange <= candleInterval * 6,
    // считаем это максимальным зумом и используем интервал свечи
    const maxZoomThreshold = candleInterval * 6;
    
    if (visibleRange <= maxZoomThreshold) {
      return candleInterval;
    }

    const fontSize = this.config.timeLabels.font.size;
    const estimatedMaxLabelWidth = fontSize * 8;
    const MIN_LABEL_SPACING_PX = Math.max(100, estimatedMaxLabelWidth * 1.5);
    const maxTickCount = Math.max(1, Math.floor(chartPixelWidth / MIN_LABEL_SPACING_PX));
    const rawSpacing = Math.max(candleInterval, visibleRange / maxTickCount);

    const baseTickCandidates = [
      30 * 1000,
      60 * 1000,
      2 * 60 * 1000,
      3 * 60 * 1000,
      5 * 60 * 1000,
      10 * 60 * 1000,
      15 * 60 * 1000,
      30 * 60 * 1000,
      45 * 60 * 1000,
      60 * 60 * 1000,
      2 * 60 * 60 * 1000,
      3 * 60 * 60 * 1000,
      4 * 60 * 60 * 1000,
      6 * 60 * 60 * 1000,
      8 * 60 * 60 * 1000,
      12 * 60 * 60 * 1000,
      24 * 60 * 60 * 1000,
      2 * 24 * 60 * 60 * 1000,
      3 * 24 * 60 * 60 * 1000,
      7 * 24 * 60 * 60 * 1000,
      14 * 24 * 60 * 60 * 1000,
      30 * 24 * 60 * 60 * 1000,
      60 * 24 * 60 * 60 * 1000,
      90 * 24 * 60 * 60 * 1000,
      180 * 24 * 60 * 60 * 1000,
      365 * 24 * 60 * 60 * 1000,
    ];

    const tickCandidates = baseTickCandidates
      .filter((value) => value >= candleInterval)
      .sort((a, b) => a - b);

    let tickSpacing = tickCandidates.find((value) => value >= rawSpacing) ?? tickCandidates[tickCandidates.length - 1] ?? rawSpacing;

    if (tickSpacing < rawSpacing) {
      const multiplier = Math.ceil(rawSpacing / tickSpacing);
      tickSpacing *= multiplier;
    }

    const pixelsPerMs = chartPixelWidth / visibleRange;
    const tickSpacingPx = tickSpacing * pixelsPerMs;
    
    if (tickSpacingPx < MIN_LABEL_SPACING_PX && tickCandidates.length > 0) {
      const currentIndex = tickCandidates.findIndex(v => v >= tickSpacing);
      if (currentIndex < tickCandidates.length - 1) {
        const nextTickSpacing = tickCandidates[currentIndex + 1];
        const nextTickSpacingPx = nextTickSpacing * pixelsPerMs;
        if (nextTickSpacingPx >= MIN_LABEL_SPACING_PX) {
          tickSpacing = nextTickSpacing;
        } else {
          const multiplier = Math.ceil(MIN_LABEL_SPACING_PX / tickSpacingPx);
          tickSpacing *= multiplier;
        }
      } else {
        const multiplier = Math.ceil(MIN_LABEL_SPACING_PX / tickSpacingPx);
        tickSpacing *= multiplier;
      }
    }

    return tickSpacing;
  }

  /**
   * Форматировать метку времени
   */
  private formatTimeLabel(time: number, tickSpacing: number): string {
    const date = new Date(time);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear()).slice(-2);

    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;

    if (tickSpacing < 6 * HOUR) {
      return `${hours}:${minutes}`;
    }

    if (tickSpacing < DAY) {
      return `${day}/${month} ${hours}:${minutes}`;
    }

    if (tickSpacing < MONTH) {
      return `${day}/${month}`;
    }

    return `${month}/${year}`;
  }

  /**
   * Создать плагин для отрисовки сетки
   */
  createGridPlugin(): Plugin<'line'> {
    // Сохраняем ссылку на this для использования в обработчике
    const self = this;
    
    return {
      id: 'extendedGrid',
      beforeDatasetsDraw: (chart) => {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!chartArea || !xScale || !yScale) return;

        const maxTime = xScale.max;
        const minTime = xScale.min;

        if (!isFinite(minTime) || !isFinite(maxTime) || maxTime <= minTime) {
          return;
        }

        const candleInterval = self.getCandleInterval();
        const visibleRange = maxTime - minTime;
        const chartPixelWidth = chartArea.right - chartArea.left;
        
        if (chartPixelWidth <= 0) {
          return;
        }

        const tickSpacing = self.calculateTickSpacing(visibleRange, chartPixelWidth, candleInterval);

        if (!Number.isFinite(tickSpacing) || tickSpacing <= 0) {
          return;
        }

        const rightPixel = chartArea.right;
        const rightTimeValue = xScale.getValueForPixel(rightPixel);
        const targetMaxTime = rightTimeValue || maxTime;

        let firstTickTime = Math.floor(minTime / tickSpacing) * tickSpacing;
        if (firstTickTime > minTime) {
          firstTickTime -= tickSpacing;
        }

        const ticks: Array<{ x: number; time: number }> = [];

        // Создаем градиенты для плавного затухания
        const verticalGradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        verticalGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        verticalGradient.addColorStop(0.5, self.config.verticalLines.color);
        verticalGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        const horizontalGradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        horizontalGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        horizontalGradient.addColorStop(0.5, self.config.horizontalLines.color);
        horizontalGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.clip();
        ctx.lineWidth = self.config.verticalLines.lineWidth;

        // Рисуем вертикальные линии
        if (self.config.verticalLines.display) {
          let currentTime = firstTickTime;
          let guardCounter = 0;
          const guardLimit = 2000;

          while (currentTime <= targetMaxTime + tickSpacing && guardCounter < guardLimit) {
            const x = xScale.getPixelForValue(currentTime);

            if (x >= chartArea.left && x <= chartArea.right) {
              ctx.strokeStyle = verticalGradient;
              ctx.beginPath();
              ctx.moveTo(x, chartArea.top);
              ctx.lineTo(x, chartArea.bottom);
              ctx.stroke();
              ticks.push({ x, time: currentTime });
            }

            currentTime += tickSpacing;
            guardCounter += 1;
          }
        }

        ctx.restore();

        // Рисуем горизонтальные линии (ось Y)
        if (self.config.horizontalLines.display) {
          const yTicksSource =
            typeof (yScale as any)?.getTicks === 'function'
              ? (yScale as any).getTicks()
              : (yScale as any)?.ticks ?? [];

          if (Array.isArray(yTicksSource) && yTicksSource.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            ctx.clip();
            ctx.lineWidth = self.config.horizontalLines.lineWidth;
            ctx.strokeStyle = horizontalGradient;

            yTicksSource.forEach((tick: any) => {
              const rawValue =
                typeof tick === 'number'
                  ? tick
                  : typeof tick?.value === 'number'
                  ? tick.value
                  : typeof tick?.tickValue === 'number'
                  ? tick.tickValue
                  : null;

              if (rawValue === null) {
                return;
              }

              const y = yScale.getPixelForValue(rawValue);

              if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) {
                return;
              }

              ctx.beginPath();
              ctx.moveTo(chartArea.left, y);
              ctx.lineTo(chartArea.right, y);
              ctx.stroke();
            });

            ctx.restore();
          }
        }

        // Рисуем временные метки
        if (self.config.timeLabels.display && ticks.length > 0) {
          ctx.save();
          ctx.fillStyle = self.config.timeLabels.color;
          ctx.font = `${self.config.timeLabels.font.weight} ${self.config.timeLabels.font.size}px ${self.config.timeLabels.font.family}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const labelY = chartArea.bottom - 6;
          const fontSize = self.config.timeLabels.font.size;
          const estimatedMaxLabelWidth = fontSize * 8;
          let MIN_LABEL_DISTANCE_PX = Math.max(100, estimatedMaxLabelWidth * 1.5);

          const visibleTicks: Array<{ x: number; time: number; label: string; width: number }> = [];

          ticks.forEach((tick) => {
            if (tick.x < chartArea.left - 40 || tick.x > chartArea.right + 40) {
              return;
            }

            const label = self.formatTimeLabel(tick.time, tickSpacing);
            const labelWidth = ctx.measureText(label).width;
            visibleTicks.push({ x: tick.x, time: tick.time, label, width: labelWidth });
          });

          if (visibleTicks.length === 0) {
            ctx.restore();
            return;
          }

          const chartWidth = chartArea.right - chartArea.left;
          const maxLabels = Math.floor(chartWidth / MIN_LABEL_DISTANCE_PX);
          
          if (visibleTicks.length > maxLabels) {
            MIN_LABEL_DISTANCE_PX = chartWidth / maxLabels;
          }

          const filteredTicks: typeof visibleTicks = [];
          let lastDrawnRightEdge = chartArea.left - MIN_LABEL_DISTANCE_PX;

          visibleTicks.forEach((tick) => {
            const clampedX = Math.min(Math.max(tick.x, chartArea.left + 2), chartArea.right - 2);
            const halfWidth = tick.width / 2;
            const leftEdge = clampedX - halfWidth;
            const rightEdge = clampedX + halfWidth;

            if (leftEdge >= lastDrawnRightEdge + MIN_LABEL_DISTANCE_PX) {
              filteredTicks.push(tick);
              lastDrawnRightEdge = rightEdge;
            }
          });

          filteredTicks.forEach((tick) => {
            const clampedX = Math.min(Math.max(tick.x, chartArea.left + 2), chartArea.right - 2);
            ctx.fillText(tick.label, clampedX, labelY);
          });

          ctx.restore();
        }
      },
    };
  }

  /**
   * Получить настройки сетки для оси X
   */
  getXAxisGridConfig() {
    return {
      color: this.config.verticalLines.color,
      lineWidth: this.config.verticalLines.lineWidth,
      // Отключаем стандартные вертикальные линии - они рисуются через плагин
      display: false,
    };
  }

  /**
   * Получить настройки сетки для оси Y
   */
  getYAxisGridConfig() {
    return {
      display: false, // Отключаем стандартные горизонтальные линии - они рисуются через плагин
    };
  }

  /**
   * Обновить таймфрейм
   */
  setTimeframe(timeframe: ChartTimeframe): void {
    this.timeframe = timeframe;
  }

  /**
   * Обновить конфигурацию
   */
  updateConfig(config: Partial<GridConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      verticalLines: {
        ...this.config.verticalLines,
        ...config.verticalLines,
      },
      horizontalLines: {
        ...this.config.horizontalLines,
        ...config.horizontalLines,
      },
      timeLabels: {
        ...this.config.timeLabels,
        ...config.timeLabels,
        font: {
          ...this.config.timeLabels.font,
          ...config.timeLabels?.font,
        },
      },
    };
  }
}

