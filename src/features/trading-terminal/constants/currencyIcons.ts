const currencyIconModules = import.meta.glob('@src/assets/currency/*.{png,svg,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const normalizeKey = (filePath: string): string | null => {
  const fileName = filePath.split('/').pop();
  if (!fileName) {
    return null;
  }
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt.replace(/[^A-Za-z0-9]/g, '');
  if (!sanitized) {
    return null;
  }
  return sanitized.toUpperCase();
};

const iconCache: Record<string, string> = {};

Object.entries(currencyIconModules).forEach(([path, url]) => {
  const key = normalizeKey(path);
  if (key) {
    iconCache[key] = url;
  }
});

export const preloadCurrencyIcon = async (currency: string): Promise<string | null> => {
  const key = currency.toUpperCase();
  return iconCache[key] ?? null;
};

export const LOCAL_CURRENCY_ICONS: Record<string, string | null> = new Proxy({} as Record<string, string | null>, {
  get(target, prop: string) {
    if (typeof prop !== 'string') return undefined;
    
    const key = prop.toUpperCase();
    
    return iconCache[key] ?? null;
  },
  has(target, prop: string) {
    if (typeof prop !== 'string') return false;
    const key = prop.toUpperCase();
    return key in iconCache;
  }
});
