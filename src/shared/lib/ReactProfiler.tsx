/**
 * Компонент для отслеживания ререндеров React компонентов
 * Использует встроенный React.Profiler, который работает в любом режиме (dev/production)
 */

import { Profiler, ProfilerOnRenderCallback, ReactNode } from 'react';

interface ReactProfilerProps {
  id: string;
  children: ReactNode;
  onRender?: ProfilerOnRenderCallback;
  logToConsole?: boolean;
  threshold?: number; // Порог времени рендера в мс для логирования
}

interface RenderInfo {
  id: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

const renderHistory: RenderInfo[] = [];
const renderCounts = new Map<string, number>();

export function ReactProfiler({
  id,
  children,
  onRender,
  logToConsole = import.meta.env.DEV,
  threshold = 16, // 60fps threshold
}: ReactProfilerProps) {
  const handleRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  ) => {
    const count = (renderCounts.get(id) || 0) + 1;
    renderCounts.set(id, count);

    const renderInfo: RenderInfo = {
      id,
      phase: phase === 'mount' ? 'mount' : 'update',
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };

    renderHistory.push(renderInfo);

    // Ограничиваем историю последними 100 записями
    if (renderHistory.length > 100) {
      renderHistory.shift();
    }

    if (logToConsole) {
      const isSlow = actualDuration > threshold;
      const prefix = isSlow ? '🐌' : '⚡';
      const style = isSlow
        ? 'color: #ff6b6b; font-weight: bold;'
        : 'color: #51cf66;';

      console.groupCollapsed(
        `${prefix} Profiler [${id}] - ${phase} (${count})`,
      );
      console.log(`%cВремя рендера: ${actualDuration.toFixed(2)}ms`, style);
      console.log(`Базовое время: ${baseDuration.toFixed(2)}ms`);
      console.log(`Время коммита: ${commitTime.toFixed(2)}ms`);
      if (actualDuration > threshold) {
        console.warn(
          `%c⚠️ Медленный рендер! Превышен порог ${threshold}ms`,
          'color: #ff6b6b; font-weight: bold;',
        );
      }
      console.groupEnd();
    }

    // Вызываем пользовательский callback, если он предоставлен
    if (onRender) {
      onRender(
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        [],
      );
    }
  };

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}

/**
 * Получить статистику по ререндерам
 */
export function getProfilerStats() {
  return {
    history: [...renderHistory],
    counts: Object.fromEntries(renderCounts),
    totalRenders: renderHistory.length,
    slowRenders: renderHistory.filter((r) => r.actualDuration > 16).length,
  };
}

/**
 * Очистить историю профилирования
 */
export function clearProfilerStats() {
  renderHistory.length = 0;
  renderCounts.clear();
}

// Экспортируем в window для доступа из консоли
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__reactProfiler = {
    getStats: getProfilerStats,
    clear: clearProfilerStats,
  };
}
