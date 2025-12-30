export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  noAuth?: boolean;
  timeout?: number; // Таймаут запроса в миллисекундах (по умолчанию 10000)
}
