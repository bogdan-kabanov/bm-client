import { ViewportState } from './types';

export interface PanZoomConfig {
  minCandlesPerScreen: number;
  maxCandlesPerScreen: number;
  overshootCandles: number;
}



export function panViewport(
  state: ViewportState,
  deltaPixels: number,
  canvasWidth: number,
  candlesCount: number,
  config: PanZoomConfig,
): ViewportState {
  const candlesPerPixel = state.candlesPerScreen / canvasWidth;
  const deltaIndex = deltaPixels * candlesPerPixel * -1;

  const newFromIndex = state.fromIndex + deltaIndex;
  const newToIndex = newFromIndex + state.candlesPerScreen;
  const newCenterIndex = (newFromIndex + newToIndex) / 2;

  return {
    ...state,
    fromIndex: newFromIndex,
    toIndex: newToIndex,
    centerIndex: newCenterIndex,
  };
}

export function zoomViewport(
  state: ViewportState,
  zoomFactor: number,
  anchorPixelX: number,
  canvasWidth: number,
  candlesCount: number,
  config: PanZoomConfig,
): ViewportState {
  const anchorRatio = anchorPixelX / canvasWidth;
  const anchorIndex = state.fromIndex + state.candlesPerScreen * anchorRatio;

  let newCandlesPerScreen = state.candlesPerScreen / zoomFactor;
  newCandlesPerScreen = Math.max(config.minCandlesPerScreen, Math.min(config.maxCandlesPerScreen, newCandlesPerScreen));

  const newFromIndex = anchorIndex - newCandlesPerScreen * anchorRatio;
  const newToIndex = newFromIndex + newCandlesPerScreen;
  const newCenterIndex = (newFromIndex + newToIndex) / 2;

  return {
    ...state,
    candlesPerScreen: newCandlesPerScreen,
    fromIndex: newFromIndex,
    toIndex: newToIndex,
    centerIndex: newCenterIndex,
  };
}

export function clampViewport(
  state: ViewportState,
  candlesCount: number,
  config: PanZoomConfig,
): ViewportState {
  if (candlesCount === 0) {
    return state;
  }

  const width = state.candlesPerScreen;
  const lastIndex = Math.max(0, candlesCount - 1);
  const o = config.overshootCandles;

  const minLeft = -o * width;
  const maxLeft = lastIndex + o * width - width;

  let from = state.fromIndex;
  if (from < minLeft) from = minLeft;
  if (from > maxLeft) from = maxLeft;

  const to = from + width;

  return {
    ...state,
    fromIndex: from,
    toIndex: to,
    centerIndex: (from + to) / 2,
  };
}