import { useRef, useCallback, useEffect } from 'react';

interface UseChartMouseParams {
  chartRef: React.MutableRefObject<any>;
  selectedBase: string;
  currencySymbol?: string | null;
  appendDebugLog: (message: string) => void;
}

export const useChartMouse = ({
  chartRef,
  selectedBase,
  currencySymbol,
  appendDebugLog,
}: UseChartMouseParams) => {
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);

  const clearMousePosition = useCallback((reason?: string) => {
    const chart = chartRef.current;
    if (!chart || !mousePositionRef.current) {
      return;
    }
    mousePositionRef.current = null;
    lastMouseEventRef.current = null;
    chart.draw();
  }, [chartRef]);

  const updateMousePosition = useCallback(
    (x: number, y: number, options?: { event?: MouseEvent | PointerEvent | null; allowOutside?: boolean; reason?: string }) => {
      const chart = chartRef.current;
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
        const prev = mousePositionRef.current;
        const changed = !prev || prev.x !== x || prev.y !== y;
        
        if (changed) {
          mousePositionRef.current = { x, y };

          if (options?.event) {
            const evt = options.event;
            if (evt instanceof MouseEvent) {
              lastMouseEventRef.current = evt;
            } else if (evt && 'clientX' in evt && 'clientY' in evt) {
              lastMouseEventRef.current = new MouseEvent('mousemove', {
                clientX: evt.clientX,
                clientY: evt.clientY,
              });
            }
          }

          chart.draw();
        }
      } else if (mousePositionRef.current) {
        mousePositionRef.current = null;
        lastMouseEventRef.current = null;
        chart.draw();
      }
    },
    [chartRef]
  );

  useEffect(() => {
    let canvas: HTMLCanvasElement | null = null;
    let rafId: number | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      if (!canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      // Тачпад генерирует события с pointerType === 'mouse'
      if (event.pointerType === 'touch') {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      updateMousePosition(event.clientX - rect.left, event.clientY - rect.top, {
        event,
        reason: event.buttons ? `pointermove buttons:${event.buttons}` : 'pointermove',
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      if (event.pointerType === 'touch') {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      updateMousePosition(event.clientX - rect.left, event.clientY - rect.top, {
        event,
        reason: 'pointerdown',
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!canvas) {
        return;
      }
      // Блокируем только реальные touch события (от пальцев), но не события от тачпада
      if (event.pointerType === 'touch') {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      updateMousePosition(x, y, {
        event,
        reason: 'pointerup',
        allowOutside: true,
      });

      if (event.buttons === 0) {
        const chart = chartRef.current;
        const chartArea = chart?.chartArea;
        if (!chartArea || x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
          clearMousePosition('pointerup outside');
        }
      }
    };

    const handlePointerLeave = () => {
      clearMousePosition('pointerleave');
    };

    const attachListeners = () => {
      canvas = chartRef.current?.canvas ?? null;
      if (!canvas) {
        rafId = window.requestAnimationFrame(attachListeners);
        return;
      }

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
      canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });
      canvas.addEventListener('pointerup', handlePointerUp, { passive: true });
      canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    };

    attachListeners();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (canvas) {
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointerleave', handlePointerLeave);
      }
    };
  }, [clearMousePosition, updateMousePosition, selectedBase, currencySymbol, chartRef]);

  return {
    mousePositionRef,
    lastMouseEventRef,
    clearMousePosition,
    updateMousePosition,
  };
};

