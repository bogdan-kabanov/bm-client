export const getTimeframeDurationMs = (tf: string): number | undefined => {
  const timeframeDurationsMs: Record<string, number> = {
    '15s': 15_000,
    '30s': 30_000,
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h': 60 * 60_000,
  };
  return timeframeDurationsMs[tf];
};

export const padTwo = (value: number) => Math.max(0, Math.min(99, value)).toString().padStart(2, '0');

export const isPointerLikeEvent = (evt: MouseEvent | PointerEvent | null): evt is PointerEvent =>
  !!evt && typeof evt === 'object' && typeof evt.clientX === 'number' && typeof evt.clientY === 'number';

// Функция для рисования закругленного прямоугольника (полифилл для roundRect)
export const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    // Полифилл для старых браузеров
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
  }
};

