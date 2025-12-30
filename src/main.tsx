import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { StoreProvider } from '@src/app/providers/StoreProvider.tsx';
import { AuthWrapper } from './AuthWrapper.tsx';
import { LanguageProvider } from './app/providers/LanguageProvider.tsx';
import { TradeNotificationProvider } from '@src/widgets/trade-notification/TradeNotificationContainer';
import { NotificationProvider } from '@src/shared/ui/notification/NotificationProvider';
import { ErrorBoundary } from '@src/shared/ui/ErrorBoundary';
import logoIcon from '@src/assets/logo-icon.ico';
import fullLogo from '@src/assets/full-logo.png';
import { ReactProfiler } from '@src/shared/lib/ReactProfiler';

if (import.meta.hot) {
    let reconnectIndicator: HTMLElement | null = null;
    let reconnectTimeout: number | null = null;
    let hideIndicatorTimeout: number | null = null;
    let isReconnecting = false;
    let connectionCheckInterval: number | null = null;
    let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

    const showReconnectIndicator = () => {
        if (reconnectIndicator) return;
        
        reconnectIndicator = document.createElement('div');
        reconnectIndicator.id = 'vite-reconnect-indicator';
        reconnectIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 99999;
            font-family: 'Roboto', sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: vite-spin 0.8s linear infinite;
        `;
        
        let style = document.getElementById('vite-reconnect-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'vite-reconnect-style';
            style.textContent = `
                @keyframes vite-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        const text = document.createElement('span');
        text.textContent = 'Подключение...';
        
        reconnectIndicator.appendChild(spinner);
        reconnectIndicator.appendChild(text);
        document.body.appendChild(reconnectIndicator);
    };

    const hideReconnectIndicator = () => {
        if (reconnectIndicator) {
            reconnectIndicator.remove();
            reconnectIndicator = null;
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        if (hideIndicatorTimeout) {
            clearTimeout(hideIndicatorTimeout);
            hideIndicatorTimeout = null;
        }
        isReconnecting = false;
    };

    const updateIndicatorText = (text: string) => {
        if (reconnectIndicator) {
            const textElement = reconnectIndicator.querySelector('span');
            if (textElement) {
                textElement.textContent = text;
            }
        }
    };

    const cleanup = () => {
        if (connectionCheckInterval !== null) {
            clearInterval(connectionCheckInterval);
            connectionCheckInterval = null;
        }
        if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            beforeUnloadHandler = null;
        }
        hideReconnectIndicator();
    };

    import.meta.hot.on('vite:beforeUpdate', () => {
        hideReconnectIndicator();
    });

    import.meta.hot.on('vite:beforeFullReload', (payload: any) => {
        if (isReconnecting) {
            try {
                if (payload && typeof payload.preventDefault === 'function') {
                    payload.preventDefault();
                }
            } catch (e) {
            }
            return false;
        }
        
        const error = payload?.err || payload?.error;
        if (error) {
            const errorMessage = error.message || String(error);
            const isNetworkError = 
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('CORS') ||
                errorMessage.includes('NetworkError') ||
                errorMessage.includes('NETWORK_ERROR') ||
                errorMessage.includes('WebSocket');
            
            if (isNetworkError) {
                try {
                    if (payload && typeof payload.preventDefault === 'function') {
                        payload.preventDefault();
                    }
                } catch (e) {
                }
                return false;
            }
        }
    });

    import.meta.hot.on('vite:error', (err) => {
        if (err.err?.message?.includes('WebSocket') || err.err?.message?.includes('connection')) {
            if (!isReconnecting) {
                isReconnecting = true;
                showReconnectIndicator();
            }
        }
    });

    import.meta.hot.on('vite:invalidate', () => {
        if (isReconnecting) {
            return;
        }
    });

    if (typeof window !== 'undefined') {
        beforeUnloadHandler = (e: BeforeUnloadEvent) => {
            cleanup();
            if (isReconnecting) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', beforeUnloadHandler);
        let lastConnectionState: boolean | null = null;
        
        const checkViteConnection = () => {
            try {
                const viteClient = (window as any).__vite_client__;
                if (viteClient && viteClient.ws) {
                    const ws = viteClient.ws;
                    const isConnected = ws.readyState === WebSocket.OPEN;
                    
                    if (lastConnectionState === null) {
                        lastConnectionState = isConnected;
                        if (!isConnected) {
                            isReconnecting = true;
                            showReconnectIndicator();
                        }
                    } else if (lastConnectionState !== isConnected) {
                        if (!isConnected && !isReconnecting) {
                            isReconnecting = true;
                            showReconnectIndicator();
                            if (reconnectTimeout) {
                                clearTimeout(reconnectTimeout);
                            }
                            reconnectTimeout = window.setTimeout(() => {
                                updateIndicatorText('Переподключение...');
                            }, 2000);
                        } else if (isConnected && isReconnecting) {
                            updateIndicatorText('Подключено');
                            if (hideIndicatorTimeout) {
                                clearTimeout(hideIndicatorTimeout);
                            }
                            hideIndicatorTimeout = window.setTimeout(() => {
                                hideReconnectIndicator();
                                hideIndicatorTimeout = null;
                            }, 1000);
                        }
                        lastConnectionState = isConnected;
                    }
                }
            } catch (e) {
            }
        };
        


    }
}

const updateBrandingAssets = () => {
    try {
        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (favicon) {
            favicon.href = logoIcon;
        }

        const appleTouch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        if (appleTouch) {
            appleTouch.href = logoIcon;
        }

        const ogImageMeta = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
        if (ogImageMeta) {
            ogImageMeta.content = fullLogo;
        }

        const twitterImageMeta = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
        if (twitterImageMeta) {
            twitterImageMeta.content = fullLogo;
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [main] error updating branding assets:`, error);
    }
};

updateBrandingAssets();

// Глобальный обработчик необработанных отклонений промисов для подавления CORS ошибок
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const errorMessage = error?.message || String(error);
    
    // Подавляем ошибки CORS и "unknown address space" в консоли
    if (
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('CORS') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('unknown address space') ||
      errorMessage.includes('Permission was denied') ||
      errorMessage.includes('blocked by CORS policy') ||
      (error instanceof TypeError && errorMessage.includes('fetch'))
    ) {
      event.preventDefault(); // Предотвращаем вывод ошибки в консоль
      // Ошибка уже обрабатывается в apiClient, просто подавляем вывод в консоль
    }
    
    // Подавляем ошибки от расширений браузера (React DevTools и другие)
    if (error && error instanceof Error) {
      if (errorMessage.includes('showPopover') || 
          errorMessage.includes('popover') ||
          errorMessage.includes('InvalidStateError') ||
          errorMessage.includes('disconnected popover')) {
        event.preventDefault(); // Предотвращаем вывод ошибки в консоль
      }
    }
  });
}

// Включить профилирование через localStorage: localStorage.setItem('enableReactProfiler', 'true')
const enableReactProfiler =
  typeof window !== 'undefined' &&
  localStorage.getItem('enableReactProfiler') === 'true';

const AppRoot = (
  <ErrorBoundary>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <LanguageProvider>
        <StoreProvider>
          <NotificationProvider>
            <TradeNotificationProvider>
              <AuthWrapper>
                {enableReactProfiler ? (
                  <ReactProfiler id="App" logToConsole={true} threshold={16}>
                    <App />
                  </ReactProfiler>
                ) : (
                  <App />
                )}
              </AuthWrapper>
            </TradeNotificationProvider>
          </NotificationProvider>
        </StoreProvider>
      </LanguageProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

// Обработка ошибок при инициализации приложения
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Добавляем обработчик ошибок для предотвращения полного краша
  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // Игнорируем ошибки от расширений браузера (React DevTools и другие)
    if (source && typeof source === 'string') {
      // Игнорируем ошибки от chrome-extension://
      if (source.startsWith('chrome-extension://') || 
          source.startsWith('moz-extension://') ||
          source.startsWith('safari-extension://')) {
        return false; // Подавляем ошибку
      }
      
      // Игнорируем ошибки связанные с popover от React DevTools
      if (error && error instanceof Error) {
        const errorMessage = error.message || String(message);
        if (errorMessage.includes('showPopover') || 
            errorMessage.includes('popover') ||
            errorMessage.includes('InvalidStateError')) {
          return false; // Подавляем ошибку
        }
      }
    }
    
    console.error('Global error:', { message, source, lineno, colno, error });
    // Не блокируем выполнение, только логируем
    if (originalError) {
      return originalError(message, source, lineno, colno, error);
    }
    return false;
  };

  createRoot(rootElement).render(
    import.meta.env.DEV ? AppRoot : <StrictMode>{AppRoot}</StrictMode>
  );
} catch (error) {
  console.error('Failed to initialize application:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: 'Roboto', sans-serif; padding: 20px; text-align: center;">
        <h1 style="color: #ff4444; margin-bottom: 20px;">Ошибка загрузки приложения</h1>
        <p style="color: #666; margin-bottom: 20px;">Не удалось загрузить приложение. Пожалуйста, обновите страницу.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #4a9eff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
          Обновить страницу
        </button>
        <details style="margin-top: 20px; text-align: left; max-width: 600px;">
          <summary style="cursor: pointer; color: #666;">Детали ошибки</summary>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; margin-top: 10px; font-size: 12px;">${error instanceof Error ? error.stack : String(error)}</pre>
        </details>
      </div>
    `;
  }
}
