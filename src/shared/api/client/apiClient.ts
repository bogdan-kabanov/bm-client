import type { RequestOptions } from './types';

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return '/api';
  }

  const envApiBase = import.meta.env.VITE_API_BASE;
  
  // Если в env указан полный URL, всегда используем его
  if (envApiBase && envApiBase.trim().length > 0 && envApiBase.includes('://')) {
    let url = envApiBase.trim();
    // Для localhost заменяем https на http
    const urlLower = url.toLowerCase();
    if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1')) {
      url = url.replace(/^https:\/\//i, 'http://');
    }
    return url;
  }
  
  // Если указан относительный путь, используем его
  if (envApiBase && envApiBase.trim().length > 0 && !envApiBase.includes('://')) {
    return envApiBase.trim();
  }
  
  // If VITE_API_BASE is not specified, require it to be set
  throw new Error('VITE_API_BASE must be specified in .env file');
};

const getApiBaseUrlValue = (): string => {
  return getApiBaseUrl();
};

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

const tryRefreshToken = async (): Promise<boolean> => {
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return !!localStorage.getItem('token');
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // Не удаляем токены здесь - это должно обрабатываться централизованно
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${getApiBaseUrlValue()}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
          return;
        }
        throw fetchError;
      }

      if (response.ok) {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty refresh response');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error('Invalid JSON in refresh response');
        }

        const newToken = data.token || data.data?.token;
        const newRefreshToken = data.refresh_token || data.data?.refresh_token;
        
        if (newToken) {
          localStorage.setItem('token', newToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }
        } else {
          throw new Error('No token in refresh response');
        }
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NETWORK_ERROR') {
          return;
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('Failed to fetch')) {
        return;
      }
      // Не удаляем токены здесь при ошибке refresh - это должно обрабатываться
      // централизованно в authCheck.tsx
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  await refreshPromise;
  return !!localStorage.getItem('token');
};

export const apiClient = async <T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, headers = {}, noAuth = false } = options;
  const requestStartTime = Date.now();
  

  try {
    const token = localStorage.getItem('token');

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const hasBody = body !== undefined && body !== null;

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (isFormData) {
      delete requestHeaders['Content-Type'];
    } else if (hasBody && method !== 'GET') {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    }

    if (!noAuth && token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
      // Временное логирование для диагностики 401 ошибки
      if (endpoint.includes('/users/me')) {
        console.log('[API-CLIENT] Запрос /users/me:', {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'нет',
          fullUrl: `${getApiBaseUrlValue()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
        });
      }
    } else if (!noAuth && !token) {
      // Временное логирование для диагностики отсутствия токена
      if (endpoint.includes('/users/me')) {
        console.warn('[API-CLIENT] ⚠️ Токен отсутствует для запроса /users/me');
      }
    }

    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;
    const fullUrl = `${getApiBaseUrlValue()}${normalizedEndpoint}`;
    
    // Логирование отключено для уменьшения спама в консоли
    
    try {
      const requestBody = isFormData
        ? (body as FormData)
        : body
          ? JSON.stringify(body)
          : undefined;

      let response: Response;
      try {
        const fetchStartTime = Date.now();
        const isAuthEndpoint = endpoint.includes('/auth/') || endpoint.includes('/login');
        
        // Логирование отключено для уменьшения спама в консоли
        
        const controller = new AbortController();
        // Оптимизация: уменьшаем таймаут для большинства запросов до 10 секунд
        // Для длительных операций (загрузка истории, экспорт) можно передать больший таймаут через options
        const timeout = options.timeout || 10000; // 10 секунд по умолчанию вместо 30
        const timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        }, timeout);
        
        // Логирование отключено для уменьшения спама в консоли
        
        let fetchCompleted = false;
        try {
          // Логирование отключено для уменьшения спама в консоли
          
          response = await fetch(fullUrl, {
            method,
            headers: requestHeaders,
            body: requestBody as BodyInit | undefined,
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit', // Не отправляем cookies для CORS запросов
          });
          
          fetchCompleted = true;
          clearTimeout(timeoutId);
          
          // Логирование отключено для уменьшения спама в консоли
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          
          if (fetchErr instanceof Error && (fetchErr.name === 'AbortError' || fetchErr.message.includes('aborted') || controller.signal.aborted)) {

            throw new Error('NETWORK_ERROR: Request timeout');
          }
          
          // Обработка ошибок CORS и "unknown address space"
          if (fetchErr instanceof TypeError || fetchErr instanceof DOMException) {
            const errorMessage = fetchErr.message || String(fetchErr);
            const isNetworkError = 
              errorMessage.includes('Failed to fetch') ||
              errorMessage.includes('NetworkError') ||
              errorMessage.includes('Network request failed') ||
              errorMessage.includes('CORS') ||
              errorMessage.includes('Load failed') ||
              errorMessage.includes('unknown address space') ||
              errorMessage.includes('Permission was denied') ||
              fetchErr.name === 'NetworkError' ||
              fetchErr.name === 'TypeError';
            
            if (isNetworkError) {
              throw new Error('NETWORK_ERROR');
            }
          }
          
          throw fetchErr;
        }
        
        const fetchDuration = Date.now() - fetchStartTime;
        
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        // Логирование отключено для уменьшения спама в консоли
      } catch (fetchError) {
        const fetchDuration = Date.now() - requestStartTime;
        
        const isTimeoutError = fetchError instanceof Error && (
          fetchError.message.includes('Request timeout') ||
          fetchError.message.includes('timeout') ||
          fetchError.name === 'AbortError'
        );
        
        if (isTimeoutError) {

          throw new Error('NETWORK_ERROR: Request timeout');
        }
        
        // Обработка различных типов сетевых ошибок
        if (fetchError instanceof TypeError || fetchError instanceof DOMException) {
          const errorMessage = fetchError.message || String(fetchError);
          const isNetworkError = 
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('Network request failed') ||
            errorMessage.includes('CORS') ||
            errorMessage.includes('Load failed') ||
            errorMessage.includes('unknown address space') ||
            errorMessage.includes('Permission was denied') ||
            errorMessage.includes('blocked by CORS policy') ||
            fetchError.name === 'NetworkError' ||
            fetchError.name === 'TypeError';
          
          if (isNetworkError) {
            throw new Error('NETWORK_ERROR');
          }
        }
        
        // Дополнительная проверка для строковых ошибок
        if (typeof fetchError === 'string') {
          const isNetworkError = 
            fetchError.includes('Failed to fetch') ||
            fetchError.includes('CORS') ||
            fetchError.includes('unknown address space') ||
            fetchError.includes('Permission was denied');
          
          if (isNetworkError) {
            throw new Error('NETWORK_ERROR');
          }
        }
        
        throw fetchError;
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Логирование отключено для уменьшения спама в консоли

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          // Логирование для диагностики 401 ошибки
          console.error('[API-CLIENT] ❌ 401 Unauthorized:', {
            endpoint,
            fullUrl,
            hasToken: !!token,
            noAuth,
            tokenPreview: token ? token.substring(0, 30) + '...' : 'нет',
            errorText: errorText.substring(0, 200),
          });
          
          if (errorText.includes('Пользователь не найден') || errorText.toLowerCase().includes('пользователь не найден')) {
            console.log('[API-CLIENT] Бросаем USER_NOT_FOUND');
            throw new Error('USER_NOT_FOUND');
          }
          
          if (errorText.includes('Неверный пароль') || errorText.toLowerCase().includes('неверный пароль')) {
            console.log('[API-CLIENT] Бросаем INVALID_PASSWORD');
            throw new Error('INVALID_PASSWORD');
          }
          
          if (errorText.includes('неверные') || errorText.includes('invalid') || errorText.includes('credentials')) {
            console.log('[API-CLIENT] Бросаем INVALID_CREDENTIALS');
            throw new Error('INVALID_CREDENTIALS');
          }
          
          if (!noAuth && token) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
              const newToken = localStorage.getItem('token');
              if (newToken) {
                const retryHeaders = {
                  ...requestHeaders,
                  'Authorization': `Bearer ${newToken}`,
                };
                
                try {
                  const retryResponse = await fetch(fullUrl, {
                    method,
                    headers: retryHeaders,
                    body: requestBody as BodyInit | undefined,
                    mode: 'cors',
                    credentials: 'omit',
                  });
                  
                  if (retryResponse.ok) {
                    const retryResponseText = await retryResponse.text();
                    if (!retryResponseText) {
                      return {} as T;
                    }
                    let retryData;
                    try {
                      retryData = JSON.parse(retryResponseText);
                    } catch {
                      throw new Error('INVALID_JSON_RESPONSE');
                    }
                    if (retryData && retryData.success === true) {
                      return retryData.data ? retryData.data as T : retryData as T;
                    } else if (retryData && retryData.token && retryData.user) {
                      return retryData as T;
                    } else if (Array.isArray(retryData)) {
                      return retryData as T;
                    } else if (retryData && typeof retryData === 'object') {
                      return retryData as T;
                    }
                  } else {
                    const retryErrorText = await retryResponse.text();

                    // Если после обновления токена retry всё равно возвращает 401,
                    // это означает, что refresh token невалидный или токен не был обновлен
                    // Бросаем SESSION_EXPIRED, чтобы authCheck.tsx мог обработать это централизованно
                    if (retryResponse.status === 401) {
                      throw new Error('SESSION_EXPIRED');
                    }
                    throw new Error(`HTTP_ERROR: ${retryResponse.status}, ${retryErrorText}`);
                  }
                } catch (retryError) {
                  throw retryError;
                }
              }
            }
          }
          
          if (noAuth) {
            // Для эндпоинтов без авторизации (login, register) пробрасываем более детальную ошибку
            if (errorText.includes('Неверный пароль') || errorText.toLowerCase().includes('неверный пароль') || errorText.includes('Invalid password')) {
              throw new Error('INVALID_PASSWORD');
            }
            if (errorText.includes('неверные') || errorText.includes('invalid') || errorText.includes('credentials')) {
              throw new Error('INVALID_CREDENTIALS');
            }
            if (errorText.includes('Пользователь не найден') || errorText.includes('User not found')) {
              throw new Error('USER_NOT_FOUND');
            }
            throw new Error('INVALID_CREDENTIALS');
          }
          
          // Не делаем автоматический logout здесь - это должно обрабатываться
          // централизованно в authCheck.tsx через checkAndRegisterUser
          // Если токен не обновился после попытки refresh, бросаем SESSION_EXPIRED
          const tokenAfterRefresh = localStorage.getItem('token');
          if (!tokenAfterRefresh) {
            throw new Error('SESSION_EXPIRED');
          }
          
          // Если токен есть, но всё равно получили 401, это может означать,
          // что токен невалидный или сессия истекла. Бросаем SESSION_EXPIRED
          // чтобы authCheck.tsx мог попробовать обновить токен или сделать logout
          throw new Error('SESSION_EXPIRED');
        }

        if (response.status === 500) {
          // Обработка 500 ошибки - может означать, что аккаунт удален или произошла серверная ошибка
          // Для эндпоинтов, связанных с пользователем, это может означать, что аккаунт удален
          if (endpoint.includes('/users/me') || endpoint.includes('/users/profile')) {
            // Если это запрос профиля пользователя и получили 500, вероятно аккаунт удален
            throw new Error('ACCOUNT_DELETED');
          }
          // Для эндпоинта удаления аккаунта, даже при ошибке 500, считаем что аккаунт удален
          // (возможно, произошла ошибка при удалении связанных записей, но пользователь уже удален)
          if (endpoint.includes('/users/account/delete')) {
            // Проверяем, содержит ли ответ информацию об успешном удалении
            if (errorText.includes('successfully deleted') || errorText.includes('Account successfully deleted')) {
              throw new Error('ACCOUNT_DELETED');
            }
            // Если это ошибка при удалении, но пользователь мог быть удален, считаем удаленным
            throw new Error('ACCOUNT_DELETED_OR_ERROR');
          }
          throw new Error(`SERVER_ERROR: ${errorText.substring(0, 200)}`);
        }

        if (response.status === 404) {
          if (errorText.includes('Пользователь не найден') || errorText.includes('User not found')) {
            throw new Error('USER_NOT_FOUND');
          }
          // Для эндпоинтов synthetic-quotes возвращаем пустой ответ вместо ошибки
          if (endpoint.includes('/synthetic-quotes/generation-tasks')) {
            // Для getGenerationTasks возвращаем пустой массив
            return { success: true, data: [] } as T;
          }
          throw new Error(`NOT_FOUND: ${endpoint}`);
        }

        if (response.status === 400) {
          if (errorText.includes('неверные') || errorText.includes('invalid') || errorText.includes('credentials')) {
            throw new Error('INVALID_CREDENTIALS');
          }
          if (errorText.includes('пароль') || errorText.includes('password')) {
            throw new Error('INVALID_PASSWORD');
          }
        }

        try {
          const errorData = JSON.parse(errorText);
          const errorMessage = errorData.message || errorText;
          const errorDetails = errorData.errors && errorData.errors.length > 0 
            ? ` ${errorData.errors.join(', ')}` 
            : '';
          throw new Error(`HTTP_ERROR: ${response.status}, ${JSON.stringify({ message: errorMessage, errors: errorData.errors || [] })}`);
        } catch {
          throw new Error(`HTTP_ERROR: ${response.status}, ${errorText}`);
        }
      }

      const responseText = await response.text();

      if (!responseText) {
        console.warn('[API-CLIENT] ⚠️ Пустой ответ от сервера:', { endpoint, status: response.status });
        return {} as T;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[API-CLIENT] ❌ Ошибка парсинга JSON:', { endpoint, responseText: responseText.substring(0, 200), parseError });
        throw new Error('INVALID_JSON_RESPONSE');
      }

      // Логирование для регистрации, чтобы понять структуру ответа
      if (endpoint.includes('/auth/email/register')) {
        console.log('[API-CLIENT] 📥 Ответ от регистрации:', {
          endpoint,
          status: response.status,
          hasSuccess: !!data.success,
          success: data.success,
          hasData: !!data.data,
          hasToken: !!data.data?.token,
          hasUser: !!data.data?.user,
          dataStructure: Object.keys(data),
          fullData: data
        });
      }

      if (data && data.success === true) {
        // Если есть meta, возвращаем весь объект data (чтобы сохранить meta)
        if (data.meta) {
          return data as T;
        }
        // Иначе возвращаем только data.data для обратной совместимости
        if (data.data) {
          return data.data as T;
        } else {
          return data as T;
        }
      } else if (data && data.token && data.user) {
        return data as T;
      } else if (Array.isArray(data)) {
        return data as T;
      } else if (data && typeof data === 'object') {
        // Если успешный ответ, но нет поля success, все равно возвращаем данные
        if (response.ok && response.status === 200) {
          return data as T;
        }
        throw new Error('UNEXPECTED_RESPONSE_FORMAT');
      } else {
        console.error('[API-CLIENT] ❌ Неожиданный формат ответа:', { endpoint, status: response.status, data });
        throw new Error('UNEXPECTED_RESPONSE_FORMAT');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'SESSION_EXPIRED') {
          throw error;
        }
        
        if (error.message === 'NETWORK_ERROR') {
          throw error;
        }
        
        if (error.message === 'ACCOUNT_DELETED' || error.message === 'ACCOUNT_DELETED_OR_ERROR') {
          throw error;
        }
        
        if (error instanceof TypeError && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed')
        )) {
          throw new Error('NETWORK_ERROR');
        }
        
        if (!['INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'SESSION_EXPIRED', 'NETWORK_ERROR', 'ACCOUNT_DELETED', 'ACCOUNT_DELETED_OR_ERROR'].includes(error.message)) {
          if (import.meta.env.DEV) {

          }
        }
        
        throw new Error(error.message);
      }
      throw new Error('NETWORK_ERROR');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('NETWORK_ERROR');
  }
};
