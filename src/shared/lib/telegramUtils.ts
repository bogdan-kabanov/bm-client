import { decodeReferralHash } from './referralHashUtils';

interface TelegramUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
    allows_write_to_pm?: boolean;
}

interface TelegramWebApp {
    ready: () => void;
    initData?: string;
    initDataUnsafe?: {
        user?: TelegramUser;
        start_param?: string;
        [key: string]: any;
    };
    expand: () => void;
    enableClosingConfirmation: () => void;
    disableClosingConfirmation: () => void;
    isExpanded: boolean;
    MainButton: {
        show: () => void;
        hide: () => void;
        setText: (text: string) => void;
        onClick: (callback: () => void) => void;
        showProgress: (show: boolean) => void;
        isVisible: boolean;
        text: string;
    };
    BackButton: {
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        isVisible: boolean;
    };
    disableVerticalSwipes: () => void;
    enableVerticalSwipes: () => void;
    version: string;
    platform: string;
    colorScheme: string;
    themeParams: {
        [key: string]: string;
    };
    isVersionAtLeast: (version: string) => boolean;
    setHeaderColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: TelegramWebApp;
        };
    }
}

export const initializeTelegramWebApp = (): boolean => {
    // Проверяем, есть ли Telegram данные в URL
    const hash = window.location.hash;
    const hasUrlData = hash && hash.includes('tgWebAppData=');
    
    if (hasUrlData) {
        // Даже если window.Telegram.WebApp недоступен, мы можем авторизовать пользователя
        return true;
    }
    
    if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;

        try {
            if (webApp.disableVerticalSwipes) webApp.disableVerticalSwipes();
            if (webApp.enableClosingConfirmation) webApp.enableClosingConfirmation();
            if (webApp.expand) webApp.expand();
            webApp.ready();
            return true;
        } catch (error) {

            return false;
        }
    }
    return false;
};

export const getTelegramInitData = (): string | null => {
    // Сначала пробуем получить из window.Telegram.WebApp
    if (window.Telegram?.WebApp?.initData) {
        return window.Telegram.WebApp.initData;
    }
    
    // Если не получилось, пробуем извлечь из URL (hash параметры)
    const hash = window.location.hash;
    if (hash && hash.includes('tgWebAppData=')) {
        try {
            // Извлекаем tgWebAppData из hash
            const hashParams = new URLSearchParams(hash.substring(1)); // убираем #
            const tgWebAppData = hashParams.get('tgWebAppData');
            
            if (tgWebAppData) {
                // URLSearchParams уже декодирует значения, не нужно делать decodeURIComponent
                return tgWebAppData;
            }
        } catch (error) {

        }
    }
    
    // Также проверяем query параметры (на всякий случай)
    const searchParams = new URLSearchParams(window.location.search);
    const tgWebAppData = searchParams.get('tgWebAppData');
    if (tgWebAppData) {
        return tgWebAppData;
    }
    
    return null;
};

export const getTelegramUser = (): TelegramUser | null => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        return window.Telegram.WebApp.initDataUnsafe.user;
    }
    
    // Если не получилось, пробуем извлечь из initData в URL
    const initData = getTelegramInitData();
    if (initData) {
        try {
            const params = new URLSearchParams(initData);
            const userStr = params.get('user');
            if (userStr) {
                return JSON.parse(userStr) as TelegramUser;
            }
        } catch (error) {

        }
    }
    
    return null;
};

export const getReferralId = (): string | null => {
  if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
    return window.Telegram.WebApp.initDataUnsafe.start_param;
  }

  // Проверяем initData из window.Telegram.WebApp или из URL
  const initData = getTelegramInitData();
  if (initData) {
    const params = new URLSearchParams(initData);
    const startParam = params.get('start_param');
    if (startParam) {
      return startParam;
    }
  }

  // Проверяем URL параметры для веб-версии
  const urlParams = new URLSearchParams(window.location.search);
  // Проверяем новый параметр invite (приоритет) и старый ref (для обратной совместимости)
  const inviteParam = urlParams.get('invite');
  const refParam = urlParams.get('ref');
  
  if (inviteParam) {
    // Декодируем хеш из нового формата
    const refIdNum = decodeReferralHash(inviteParam);
    if (refIdNum) {
      return `ref_${refIdNum}`;
    }
  }
  
  if (refParam) {
    return refParam.startsWith('ref_') ? refParam : `ref_${refParam}`;
  }

  return null;
};

// Добавим хелпер функцию для безопасного получения значения
export const getSafeReferralId = (): string | null => {
  const referralId = getReferralId();
  return referralId || null;
};

export const enablePullToClose = (): void => {
    if (window.Telegram?.WebApp?.enableVerticalSwipes) {
        window.Telegram.WebApp.enableVerticalSwipes();
    }
};

export const disablePullToClose = (): void => {
    if (window.Telegram?.WebApp?.disableVerticalSwipes) {
        window.Telegram.WebApp.disableVerticalSwipes();
    }
};

export const showMainButton = (text: string = 'Продолжить'): void => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.MainButton) {
        webApp.MainButton.setText(text);
        webApp.MainButton.show();
    }
};

export const hideMainButton = (): void => {
    if (window.Telegram?.WebApp?.MainButton?.hide) {
        window.Telegram.WebApp.MainButton.hide();
    }
};

export const isWebAppVersionSupported = (minVersion: string): boolean => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.isVersionAtLeast) {
        return webApp.isVersionAtLeast(minVersion);
    }
    return false;
};