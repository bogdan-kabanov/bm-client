import { CanvasChartHandle, KlineServerMessage, Candle } from './types';

export function handleKlineMessage(
  chart: CanvasChartHandle,
  msg: KlineServerMessage,
): void {
  // Функция работы со свечами удалена
  // Преобразуем сообщение в формат свечей напрямую
  const candles: Candle[] = msg.data.map((kline) => ({
    openTime: kline.start,
    open: parseFloat(kline.open),
    high: parseFloat(kline.high),
    low: parseFloat(kline.low),
    close: parseFloat(kline.close),
  }));

  for (const c of candles) {
    chart.upsertCandle(c);
  }
}





