import React from 'react';

// Интерфейс для позиции мыши
export interface MousePosition {
  x: number;
  y: number;
}

// Интерфейс для параметров CrosshairManager
export interface CrosshairManagerParams {
  chartRef: React.MutableRefObject<any>;
  appendDebugLog?: (message: string) => void;
  onMousePositionChange?: (position: MousePosition | null) => void;
}

/**
 * Класс для управления перекрестием (crosshair) на графике
 */
export class CrosshairManager {
  private chartRef: React.MutableRefObject<any>;
  private appendDebugLog?: (message: string) => void;
  private onMousePositionChange?: (position: MousePosition | null) => void;
  
  private mousePositionRef: React.MutableRefObject<MousePosition | null>;
  private lastMouseEventRef: React.MutableRefObject<MouseEvent | null>;
  
  private canvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private listenersAttached: boolean = false;
  
  // Обработчики событий (сохраняем для удаления)
  private handlePointerMove: ((event: PointerEvent) => void) | null = null;
  private handlePointerDown: ((event: PointerEvent) => void) | null = null;
  private handlePointerUp: ((event: PointerEvent) => void) | null = null;
  private handlePointerLeave: (() => void) | null = null;
  private handleDocumentPointerUp: ((event: PointerEvent) => void) | null = null;

  constructor(params: CrosshairManagerParams) {
    this.chartRef = params.chartRef;
    this.appendDebugLog = params.appendDebugLog;
    this.onMousePositionChange = params.onMousePositionChange;
    
    // Создаем ref'ы для позиции мыши (используем объекты с current свойством)
    this.mousePositionRef = { current: null };
    this.lastMouseEventRef = { current: null };
  }

  /**
   * Получить ref для позиции мыши
   */
  getMousePositionRef(): React.MutableRefObject<MousePosition | null> {
    return this.mousePositionRef;
  }

  /**
   * Получить ref для последнего события мыши
   */
  getLastMouseEventRef(): React.MutableRefObject<MouseEvent | null> {
    return this.lastMouseEventRef;
  }

  /**
   * Проверить, является ли событие похожим на PointerEvent
   */
  private isPointerLikeEvent(evt: MouseEvent | PointerEvent | null): evt is PointerEvent {
    return !!evt && typeof evt === 'object' && 'clientX' in evt && 'clientY' in evt && 'pointerType' in evt;
  }

  /**
   * Очистить позицию мыши
   */
  clearMousePosition(reason?: string): void {
    const chart = this.chartRef.current;
    if (!chart) {
      return;
    }
    
    if (!this.mousePositionRef.current) {
      return;
    }
    
    this.mousePositionRef.current = null;
    this.lastMouseEventRef.current = null;
    this.onMousePositionChange?.(null);
    
    // CanvasChart не имеет метода draw(), только redraw()
    if (typeof chart.draw === 'function') {
      chart.draw();
    } else if (typeof chart.redraw === 'function') {
      // Для CanvasChart не вызываем redraw при очистке позиции мыши,
      // так как CanvasChart сам обрабатывает мышь через handleMouseMove
      // chart.redraw();
    }
  }

  /**
   * Обновить позицию мыши
   */
  updateMousePosition(
    x: number,
    y: number,
    options?: { event?: MouseEvent | PointerEvent | null; allowOutside?: boolean; reason?: string }
  ): void {
    const chart = this.chartRef.current;
    if (!chart) {
      return;
    }
    
    const chartArea = chart.chartArea;
    if (!chartArea) {
      return;
    }

    const inside =
      typeof x === 'number' &&
      typeof y === 'number' &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= chartArea.left &&
      x <= chartArea.right &&
      y >= chartArea.top &&
      y <= chartArea.bottom;

    if (inside || options?.allowOutside) {
      const prev = this.mousePositionRef.current;
      const changed = !prev || prev.x !== x || prev.y !== y;
      
      this.mousePositionRef.current = { x, y };
      this.onMousePositionChange?.(this.mousePositionRef.current);

      if (options?.event) {
        const evt = options.event;
        if (evt instanceof MouseEvent) {
          this.lastMouseEventRef.current = evt;
        } else if (this.isPointerLikeEvent(evt)) {
          const pointerEvt = evt as PointerEvent;
          this.lastMouseEventRef.current = new MouseEvent('mousemove', {
            clientX: pointerEvt.clientX,
            clientY: pointerEvt.clientY,
            bubbles: true,
            cancelable: true,
          });
        }
      }

      if (changed) {
        // CanvasChart не имеет метода draw(), только redraw()
        // И CanvasChart сам обрабатывает мышь через handleMouseMove,
        // поэтому не вызываем draw() для CanvasChart
        if (typeof chart.draw === 'function') {
          вызван, reason=${options?.reason || 'unknown'}, x=${x.toFixed(2)}, y=${y.toFixed(2)}, changed=${changed}`);
          chart.draw();
        }
        // Для CanvasChart не вызываем redraw, так как он сам обрабатывает мышь
      }
    } else if (this.mousePositionRef.current) {
      this.mousePositionRef.current = null;
      this.lastMouseEventRef.current = null;
      this.onMousePositionChange?.(null);
      
      // CanvasChart не имеет метода draw(), только redraw()
      // И CanvasChart сам обрабатывает мышь через handleMouseMove,
      // поэтому не вызываем draw() для CanvasChart
      if (typeof chart.draw === 'function') {
        вызван, reason=${options?.reason || 'outside'}`);
        chart.draw();
      }
      // Для CanvasChart не вызываем redraw, так как он сам обрабатывает мышь
    }
  }

  /**
   * Прикрепить обработчики событий к canvas
   */
  attachListeners(): void {
    // Сначала открепляем старые обработчики, если они были
    this.detachListeners();

    // Обработчики событий
    this.handlePointerMove = (event: PointerEvent) => {
      if (!this.canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      // Тачпад генерирует события с pointerType === 'mouse'
      if (event.pointerType === 'touch') {
        return;
      }
      // Проверяем, что canvas все еще актуален
      const currentCanvas = this.chartRef.current?.canvas;
      if (currentCanvas !== this.canvas) {
        // Canvas был пересоздан, переприкрепляем слушатели
        this.canvas = currentCanvas;
        if (this.canvas && this.handlePointerMove) {
          this.canvas.addEventListener('pointermove', this.handlePointerMove, { passive: true });
        }
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.updateMousePosition(event.clientX - rect.left, event.clientY - rect.top, {
        event,
        reason: event.buttons ? `pointermove buttons:${event.buttons}` : 'pointermove',
      });
    };

    this.handlePointerDown = (event: PointerEvent) => {
      if (!this.canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      if (event.pointerType === 'touch') {
        return;
      }
      // Проверяем, что canvas все еще актуален
      const currentCanvas = this.chartRef.current?.canvas;
      if (currentCanvas !== this.canvas) {
        this.canvas = currentCanvas;
        if (this.canvas && this.handlePointerDown) {
          this.canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
        }
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.updateMousePosition(event.clientX - rect.left, event.clientY - rect.top, {
        event,
        reason: 'pointerdown',
      });
    };

    this.handlePointerUp = (event: PointerEvent) => {
      if (!this.canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      if (event.pointerType === 'touch') {
        return;
      }
      // Проверяем, что canvas все еще актуален
      const currentCanvas = this.chartRef.current?.canvas;
      if (currentCanvas !== this.canvas) {
        this.canvas = currentCanvas;
        if (this.canvas && this.handlePointerUp) {
          this.canvas.addEventListener('pointerup', this.handlePointerUp, { passive: true });
        }
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.updateMousePosition(x, y, {
        event,
        reason: 'pointerup',
        allowOutside: true,
      });

      if (event.buttons === 0) {
        const chart = this.chartRef.current;
        const chartArea = chart?.chartArea;
        if (!chartArea || x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
          this.clearMousePosition('pointerup outside');
        }
      }
    };

    this.handlePointerLeave = () => {
      this.clearMousePosition('pointerleave');
    };

    this.handleDocumentPointerUp = (event: PointerEvent) => {
      if (!this.canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      if (event.pointerType === 'touch') {
        return;
      }
      // Обрабатываем только если событие произошло вне canvas
      if (event.target !== this.canvas && !this.canvas.contains(event.target as Node)) {
        this.clearMousePosition('document pointerup');
      }
    };

    // Функция для прикрепления слушателей с периодической проверкой canvas
    const attach = () => {
      const chart = this.chartRef.current;
      const currentCanvas = chart?.canvas ?? null;
      
      if (!currentCanvas) {
        // Продолжаем пытаться прикрепить слушатели, пока canvas не будет готов
        this.rafId = window.requestAnimationFrame(attach);
        return;
      }

      // Если canvas изменился, обновляем ссылку
      if (this.canvas !== currentCanvas) {
        // Открепляем старые слушатели от старого canvas
        if (this.canvas && this.listenersAttached) {
          if (this.handlePointerMove) {
            this.canvas.removeEventListener('pointermove', this.handlePointerMove);
          }
          if (this.handlePointerDown) {
            this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
          }
          if (this.handlePointerUp) {
            this.canvas.removeEventListener('pointerup', this.handlePointerUp);
          }
          if (this.handlePointerLeave) {
            this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
          }
          this.listenersAttached = false;
        }
        
        // Обновляем ссылку на canvas
        this.canvas = currentCanvas;
      }

      // Отменяем ожидание, если оно было
      if (this.rafId !== null) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      // Прикрепляем обработчики только если они не были прикреплены
      if (!this.listenersAttached && this.canvas && this.handlePointerMove && this.handlePointerDown && 
          this.handlePointerUp && this.handlePointerLeave && this.handleDocumentPointerUp) {
        this.canvas.addEventListener('pointermove', this.handlePointerMove, { passive: true });
        this.canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
        this.canvas.addEventListener('pointerup', this.handlePointerUp, { passive: true });
        this.canvas.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
        this.listenersAttached = true;
        //     this.attachListeners();
        //   } else if (this.listenersAttached) {
        //     // Продолжаем проверять
        //     setTimeout(checkCanvas, 100);
        //   }
        // };
        // setTimeout(checkCanvas, 100);
      }
    };

    attach();
  }

  /**
   * Открепить обработчики событий от canvas
   */
  detachListeners(): void {
    // Отменяем ожидание, если оно было
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Удаляем обработчики только если они были прикреплены
    if (this.listenersAttached) {
      if (this.canvas && this.handlePointerMove) {
        this.canvas.removeEventListener('pointermove', this.handlePointerMove);
      }
      if (this.canvas && this.handlePointerDown) {
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      }
      if (this.canvas && this.handlePointerUp) {
        this.canvas.removeEventListener('pointerup', this.handlePointerUp);
      }
      if (this.canvas && this.handlePointerLeave) {
        this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
      }
      if (this.handleDocumentPointerUp) {
        document.removeEventListener('pointerup', this.handleDocumentPointerUp);
      }
      
      this.listenersAttached = false;
    }
    
    // Не очищаем canvas, так как он может быть нужен для повторного прикрепления
  }

  /**
   * Очистить состояние перекрестия (при смене валютной пары и т.д.)
   */
  reset(): void {
    this.clearMousePosition('reset');
    this.detachListeners();
    // Сбрасываем canvas, чтобы он был найден заново
    this.canvas = null;
    // Сбрасываем флаг, чтобы слушатели могли быть переприкреплены
    this.listenersAttached = false;
    // Прикрепляем слушатели заново
    // attachListeners() сам будет ждать, пока canvas будет готов через requestAnimationFrame
    this.attachListeners();
  }

  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    this.detachListeners();
    this.clearMousePosition('cleanup');
    this.mousePositionRef.current = null;
    this.lastMouseEventRef.current = null;
  }
}

