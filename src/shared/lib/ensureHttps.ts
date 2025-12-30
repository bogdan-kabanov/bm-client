export const ensureHttps = (url?: string | null): string | null => {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.toLowerCase().startsWith('http://')) {
    return `https://${trimmed.slice(7)}`;
  }

  return trimmed;
};

