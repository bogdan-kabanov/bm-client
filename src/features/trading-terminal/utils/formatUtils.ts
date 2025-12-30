export const formatPrice = (price: number | string | null | undefined, selectedBase: string): string => {
  if (price === null || price === undefined) {
    return '...';
  }
  const numeric = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(numeric)) {
    return '...';
  }
  
  const getTickSizeForSymbol = (base: string): number => {
    const upper = (base || '').toUpperCase();
    if (upper === 'BTC' || upper === 'ETH') return 0.01;
    if (upper === 'BNB' || upper === 'SOL' || upper === 'XRP') return 0.001;
    return 0.01;
  };
  
  const tick = getTickSizeForSymbol(selectedBase);
  const rounded = Math.round(numeric / tick) * tick;
  const decimals = tick >= 0.01 ? 2 : tick >= 0.001 ? 3 : 6;
  return rounded.toFixed(decimals);
};

export const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized)) {
    return '—';
  }
  const decimals = Math.abs(normalized) >= 10 ? 0 : 2;
  const prefix = normalized > 0 ? '+' : normalized < 0 ? '' : '';
  return `${prefix}${normalized.toFixed(decimals)}%`;
};

export const formatHMS = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

export const normalizeNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

