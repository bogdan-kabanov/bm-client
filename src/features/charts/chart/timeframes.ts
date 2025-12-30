import { Timeframe } from './types';

export function formatTimeForTicks(timestamp: number, timeframe: Timeframe, candlesPerScreen?: number): string {
  const date = new Date(timestamp);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');

  const isSmallTimeframe = timeframe === '15s' || timeframe === '30s';
  
  if (isSmallTimeframe) {
    return `${hours}:${minutes}:${seconds}`;
  } else {
    return `${hours}:${minutes}`;
  }
}

export function formatPrice(value: number): string {
  return value.toFixed(5);
}

