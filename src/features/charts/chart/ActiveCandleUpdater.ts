import { Candle, Timeframe } from './types';
import { getTimeframeDurationMs } from '../ui/utils';

/**
 * Результат обновления активной свечи
 */
export interface ActiveCandleUpdateResult {
  /** Была ли обновлена свеча */
  wasUpdated: boolean;
  /** Обновленная свеча (если была обновлена) */
  updatedCandle: Candle | null;
  /** Индекс обновленной свечи (всегда последний) */
  updatedIndex: number | null;
  /** Нужно ли создать новую свечу */
  shouldCreateNew: boolean;
}

/**
 * Модуль для обновления только активной (последней) свечи.
 * Независим от остального кода и гарантирует обновление только последней свечи.
 */
export class ActiveCandleUpdater {
  /**
   * Определяет, является ли свеча активной (последней в массиве)
   */
  static isActiveCandle(candle: Candle, candles: Candle[], timeframe: Timeframe): boolean {
    if (candles.length === 0) {
      return false;
    }

    const lastCandle = candles[candles.length - 1];
    const timeframeDuration = getTimeframeDurationMs(timeframe) ?? 60_000;
    const lastCandleEndTime = lastCandle.openTime + timeframeDuration;

    // Свеча активна, если её openTime находится в диапазоне последней свечи
    return candle.openTime >= lastCandle.openTime && candle.openTime < lastCandleEndTime;
  }

  /**
   * Обновляет только активную (последнюю) свечу.
   * Гарантирует, что обновляется только последняя свеча в массиве.
   * 
   * @param newCandle - Новая свеча для обновления
   * @param candles - Массив существующих свечей
   * @param timeframe - Таймфрейм
   * @returns Результат обновления
   */
  static updateActiveCandle(
    newCandle: Candle,
    candles: Candle[],
    timeframe: Timeframe
  ): ActiveCandleUpdateResult {
    // Если массив пуст, нужно создать новую свечу
    if (candles.length === 0) {
      return {
        wasUpdated: false,
        updatedCandle: null,
        updatedIndex: null,
        shouldCreateNew: true,
      };
    }

    const lastIndex = candles.length - 1;
    const lastCandle = candles[lastIndex];
    const timeframeDuration = getTimeframeDurationMs(timeframe) ?? 60_000;
    const lastCandleEndTime = lastCandle.openTime + timeframeDuration;

    // Проверяем, является ли новая свеча обновлением активной свечи
    const isActiveUpdate = newCandle.openTime >= lastCandle.openTime && 
                          newCandle.openTime < lastCandleEndTime;

    if (!isActiveUpdate) {
      // Это не обновление активной свечи - возможно, это новая свеча
      return {
        wasUpdated: false,
        updatedCandle: null,
        updatedIndex: null,
        shouldCreateNew: newCandle.openTime >= lastCandleEndTime,
      };
    }

    // Обновляем только последнюю свечу
    const updatedCandle: Candle = {
      openTime: lastCandle.openTime, // openTime не меняется
      open: lastCandle.open, // open не меняется
      high: Math.max(newCandle.high, lastCandle.high),
      low: Math.min(newCandle.low, lastCandle.low),
      close: newCandle.close,
    };

    return {
      wasUpdated: true,
      updatedCandle,
      updatedIndex: lastIndex,
      shouldCreateNew: false,
    };
  }

  /**
   * Проверяет, нужно ли обновить активную свечу, и возвращает обновленную версию массива свечей.
   * Гарантирует, что обновляется только последняя свеча.
   * 
   * @param newCandle - Новая свеча для обновления
   * @param candles - Массив существующих свечей (будет скопирован)
   * @param timeframe - Таймфрейм
   * @returns Новый массив свечей с обновленной активной свечой (если нужно)
   */
  static updateActiveCandleInArray(
    newCandle: Candle,
    candles: Candle[],
    timeframe: Timeframe
  ): Candle[] {
    const result = this.updateActiveCandle(newCandle, candles, timeframe);

    if (result.wasUpdated && result.updatedCandle && result.updatedIndex !== null) {
      // Создаем новый массив с обновленной последней свечой
      const updatedCandles = [...candles];
      updatedCandles[result.updatedIndex] = result.updatedCandle;
      return updatedCandles;
    }

    // Если нужно создать новую свечу
    if (result.shouldCreateNew) {
      return [...candles, newCandle];
    }

    // Ничего не изменилось
    return candles;
  }
}

