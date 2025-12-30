/**
 * Утилиты для разбиения длительных задач на более мелкие части
 * Помогает избежать блокировки UI при выполнении тяжелых операций
 */

interface TimeSliceOptions {
  maxTime?: number; // Максимальное время выполнения в мс (по умолчанию 5мс для 60fps)
  onProgress?: (progress: number) => void; // Колбэк для отслеживания прогресса
}

/**
 * Выполняет задачу частями, не блокируя UI
 * Разбивает длительную операцию на мелкие части
 */
export async function timeSlice<T>(
  task: (yieldPoint: () => Promise<void>) => Promise<T>,
  options: TimeSliceOptions = {}
): Promise<T> {
  const { maxTime = 5 } = options; // 5мс - достаточно для 60fps (16.67мс на кадр)

  let result: T;
  let isComplete = false;
  let error: Error | null = null;

  // Создаем функцию для приостановки выполнения
  const yieldPoint = (): Promise<void> => {
    return new Promise((resolve) => {
      // Используем requestIdleCallback если доступен
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          // Используем setTimeout с нулевой задержкой для следующего тика
          setTimeout(resolve, 0);
        }, { timeout: maxTime });
      } else {
        // Fallback на setTimeout
        setTimeout(resolve, 0);
      }
    });
  };

  // Запускаем задачу
  task(yieldPoint)
    .then((res) => {
      result = res;
      isComplete = true;
    })
    .catch((err) => {
      error = err;
      isComplete = true;
    });

  // Ждем завершения
  while (!isComplete) {
    await yieldPoint();
  }

  if (error) {
    throw error;
  }

  return result!;
}

/**
 * Обрабатывает массив частями, не блокируя UI
 */
export async function processArrayInChunks<T, R>(
  array: T[],
  processor: (item: T, index: number) => R,
  options: TimeSliceOptions & { chunkSize?: number } = {}
): Promise<R[]> {
  const { chunkSize = 10, maxTime = 5, onProgress } = options;
  const results: R[] = [];
  const total = array.length;
  let processed = 0;

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const startTime = performance.now();

    // Обрабатываем чанк
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const result = processor(item, i + j);
      results.push(result);
      processed++;
    }

    // Отчитываемся о прогрессе
    if (onProgress) {
      onProgress(processed / total);
    }

    // Проверяем время и приостанавливаемся если нужно
    const elapsed = performance.now() - startTime;
    if (elapsed > maxTime) {
      await new Promise((resolve) => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => setTimeout(resolve, 0), { timeout: maxTime });
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
  }

  return results;
}

/**
 * Дебаунсинг с разбиением на части
 */
export function debounceWithTimeSlice<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: TimeSliceOptions = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastArgs = args;

    return new Promise((resolve) => {
      resolvePromise = resolve;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (lastArgs && resolvePromise) {
          const result = await timeSlice(
            async (yieldPoint) => {
              await yieldPoint();
              return func(...lastArgs!);
            },
            options
          );
          resolvePromise(result);
          resolvePromise = null;
          lastArgs = null;
        }
      }, wait);
    });
  };
}

/**
 * Троттлинг с разбиением на части
 */
export function throttleWithTimeSlice<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
  options: TimeSliceOptions = {}
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let inThrottle: boolean = false;
  let lastResult: ReturnType<T> | undefined = undefined;

  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (!inThrottle) {
      inThrottle = true;

      lastResult = await timeSlice(
        async (yieldPoint) => {
          await yieldPoint();
          return func(...args);
        },
        options
      );

      setTimeout(() => {
        inThrottle = false;
      }, limit);

      return lastResult;
    }

    return lastResult;
  };
}

/**
 * Batch обработка обновлений Redux
 */
export function batchReduxUpdates<T>(
  updates: (() => void)[],
  dispatch: (action: any) => void,
  options: TimeSliceOptions = {}
): Promise<void> {
  return timeSlice(
    async (yieldPoint) => {
      const { chunkSize = 5 } = options as { chunkSize?: number };
      
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        
        // Выполняем обновления в чанке
        chunk.forEach((update) => update());
        
        // Приостанавливаемся после каждого чанка
        if (i + chunkSize < updates.length) {
          await yieldPoint();
        }
      }
    },
    options
  );
}

