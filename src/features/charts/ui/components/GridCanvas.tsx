import React, { useEffect, useRef } from 'react';

interface GridCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({ 
  width, 
  height,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    const updateCanvas = () => {
      const rect = container.getBoundingClientRect();
      const canvasWidth = width || rect.width;
      const canvasHeight = height || rect.height;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Очищаем canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Настройки для сетки
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1;

      // Вертикальные линии (ось X)
      const verticalLinesCount = 20;
      const verticalStep = canvasWidth / (verticalLinesCount + 1);
      for (let i = 1; i <= verticalLinesCount; i++) {
        const x = i * verticalStep;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      // Горизонтальные линии (ось Y)
      const horizontalLinesCount = 15;
      const horizontalStep = canvasHeight / (horizontalLinesCount + 1);
      for (let i = 1; i <= horizontalLinesCount; i++) {
        const y = i * horizontalStep;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    };

    updateCanvas();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvas();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
};

