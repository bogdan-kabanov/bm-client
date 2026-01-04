// features/auth/authCheck.tsx
import { authApi, userApi } from "@src/shared/api";
import { User } from "@src/entities/user/model/types.ts";
import { createAsyncThunk } from "@reduxjs/toolkit";

interface AuthResponse {
  user: User;
  token: string;
  refresh_token?: string;
}

export const checkAndRegisterUser = createAsyncThunk<
  AuthResponse,
  void,
  { rejectValue: string }
>(
  'auth/checkAndRegisterUser',
  async (_, { rejectWithValue }) => {
    const startTime = Date.now();
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            const response = await authApi.refreshToken(refreshToken);
            if (response.token) {
              localStorage.setItem('token', response.token);
              if (response.refresh_token) {
                localStorage.setItem('refresh_token', response.refresh_token);
              }
              const user = await userApi.getProfile();
              return { user, token: response.token, refresh_token: response.refresh_token };
            }
          } catch (refreshError) {
            const errorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
            if (errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('Failed to fetch')) {
              throw new Error('NETWORK_ERROR');
            }
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            if (window.location.pathname !== '/') {
              window.location.href = '/';
            }
            throw new Error('SESSION_EXPIRED');
          }
        }
        throw new Error('NO_TOKEN_PLEASE_LOGIN');
      }

      try {
        const user = await userApi.getProfile();
        return { user, token };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Если это сетевая ошибка, НЕ удаляем токен - это временная проблема
        // Пользователь останется залогиненным, просто данные не загрузятся
        if (errorMessage.includes('NETWORK_ERROR') || 
            errorMessage.includes('Failed to fetch') || 
            errorMessage.includes('504') ||
            errorMessage.includes('Gateway Timeout') ||
            errorMessage.includes('timeout')) {
          console.warn('[authCheck] Сетевая ошибка при проверке токена, сохраняем токен:', errorMessage);
          throw new Error('NETWORK_ERROR');
        }
        
        // Если apiClient уже попытался обновить токен и вернул SESSION_EXPIRED или UNAUTHORIZED,
        // проверяем, есть ли refresh_token для повторной попытки обновления
        const isSessionExpired = errorMessage.includes('SESSION_EXPIRED') || errorMessage.includes('UNAUTHORIZED');
        
        if (isSessionExpired) {
          // Пробуем обновить токен еще раз, если есть refresh_token
          // (apiClient уже попробовал один раз, но может быть проблема с тем, как он это сделал)
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const response = await authApi.refreshToken(refreshToken);
              if (response.token) {
                localStorage.setItem('token', response.token);
                if (response.refresh_token) {
                  localStorage.setItem('refresh_token', response.refresh_token);
                }
                // Пробуем получить профиль с новым токеном
                const user = await userApi.getProfile();
                return { user, token: response.token, refresh_token: response.refresh_token };
              }
            } catch (refreshError) {
              const refreshErrorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
              if (refreshErrorMessage.includes('NETWORK_ERROR') || 
                  refreshErrorMessage.includes('Failed to fetch') ||
                  refreshErrorMessage.includes('504') ||
                  refreshErrorMessage.includes('timeout')) {
                // Сетевая ошибка при refresh - не удаляем токен
                throw new Error('NETWORK_ERROR');
              }
              // Если refresh не удался из-за истекшей сессии - делаем logout
              localStorage.removeItem('token');
              localStorage.removeItem('refresh_token');
              if (window.location.pathname !== '/') {
                window.location.href = '/';
              }
              throw new Error('SESSION_EXPIRED');
            }
          }
          
          // Если refresh_token нет или обновление не удалось - делаем logout
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          throw new Error('SESSION_EXPIRED');
        }
        
        // Для других ошибок также пробуем обновить токен, если возможно
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            const response = await authApi.refreshToken(refreshToken);
            if (response.token) {
              localStorage.setItem('token', response.token);
              if (response.refresh_token) {
                localStorage.setItem('refresh_token', response.refresh_token);
              }
              const user = await userApi.getProfile();
              return { user, token: response.token, refresh_token: response.refresh_token };
            }
          } catch (refreshError) {
            // Игнорируем ошибку refresh для других типов ошибок
          }
        }
        
        // Если ничего не помогло и это не сетевая ошибка - делаем logout
        // Но только если это действительно ошибка авторизации
        if (!errorMessage.includes('NETWORK') && !errorMessage.includes('timeout') && !errorMessage.includes('504')) {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          throw new Error('SESSION_EXPIRED');
        }
        
        // Для сетевых ошибок просто пробрасываем дальше, не удаляя токен
        throw new Error('NETWORK_ERROR');
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      const elapsedTime = Date.now() - startTime;
      
      if (errorMessage === 'NETWORK_ERROR') {
        return rejectWithValue('Network error. Please check your internet connection');
      }
      
      if (errorMessage === 'SESSION_EXPIRED') {
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
        return rejectWithValue('');
      }
      if (errorMessage === 'NO_TOKEN_PLEASE_LOGIN') {
        return rejectWithValue('');
      }
      
      return rejectWithValue('');
    }
  }
);

export const loginWithEmail = createAsyncThunk<
  AuthResponse,
  { email: string; password: string },
  { rejectValue: string }
>(
  'auth/loginWithEmail',
  async ({ email, password }, { rejectWithValue, signal }) => {
    try {
      const loginStartTime = Date.now();
      
      const loginPromise = authApi.login(email, password);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('NETWORK_ERROR: Request timeout'));
        }, 30000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });
      
      const response = await Promise.race([loginPromise, timeoutPromise]);
      
      localStorage.setItem('token', response.token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      
      return response;
    } catch (error: unknown) {
      console.error('[authCheck] loginWithEmail ошибка:', error);
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      console.log('[authCheck] loginWithEmail errorMessage:', errorMessage);
      
      if (errorMessage.includes('Request timeout') || errorMessage.includes('timeout')) {
        const msg = 'Network error. Request timeout. Please check your internet connection';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      
      if (errorMessage.includes('USER_NOT_FOUND') || errorMessage.toLowerCase().includes('пользователь не найден') || errorMessage.includes('user not found')) {
        const msg = 'User not found';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      
      if (errorMessage.includes('INVALID_PASSWORD') || errorMessage.toLowerCase().includes('неверный пароль') || errorMessage.includes('Invalid password')) {
        const msg = 'Invalid password';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      
      if (errorMessage.includes('INVALID_CREDENTIALS') || errorMessage.includes('неверные') || errorMessage.includes('invalid credentials') || errorMessage === 'UNAUTHORIZED') {
        const msg = 'Invalid email or password';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      if (errorMessage === 'SESSION_EXPIRED') {
        const msg = 'Session expired';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      if (errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        const msg = 'Network error. Please check your internet connection';
        console.log('[authCheck] Возвращаем:', msg);
        return rejectWithValue(msg);
      }
      
      const defaultMsg = 'Invalid email or password';
      console.log('[authCheck] Возвращаем по умолчанию:', defaultMsg);
      return rejectWithValue(defaultMsg);
    }
  }
);

export const registerWithEmail = createAsyncThunk<
  AuthResponse,
  { email: string; password: string; phone: string; refId?: number },
  { rejectValue: string }
>(
  'auth/registerWithEmail',
  async ({ email, password, phone, refId }, { rejectWithValue }) => {
    try {
      // Если refId не передан, пытаемся получить из localStorage
      let finalRefId = refId;
      if (!finalRefId) {
        try {
          const savedRefId = localStorage.getItem('referral_id');
          if (savedRefId) {
            const refIdNum = parseInt(savedRefId, 10);
            if (!isNaN(refIdNum) && refIdNum > 0) {
              finalRefId = refIdNum;
              console.log('[authCheck] ✅ Реферальный ID получен из localStorage:', finalRefId);
            }
          }
        } catch (e) {
          console.error('[authCheck] ❌ Ошибка получения referral_id из localStorage:', e);
        }
      }
      
      // Получаем информацию о партнерской ссылке из localStorage
      let partner_referral: { partner_id: number; referral_slug: string } | undefined;
      try {
        const partnerReferralStr = localStorage.getItem('partner_referral');
        console.log('[authCheck] 🔍 Проверка partner_referral в localStorage:', partnerReferralStr);
        if (partnerReferralStr) {
          const parsed = JSON.parse(partnerReferralStr);
          console.log('[authCheck] 📋 Распарсенный partner_referral:', parsed);
          // Преобразуем camelCase в snake_case для совместимости
          const partner_id = parsed.partnerId || parsed.partner_id;
          const referral_slug = parsed.referralSlug || parsed.referral_slug;
          
          // Проверяем, что оба значения присутствуют
          if (partner_id && referral_slug) {
            partner_referral = {
              partner_id: Number(partner_id),
              referral_slug: String(referral_slug)
            };
            console.log('[authCheck] ✅ Партнерская ссылка найдена и валидна:', partner_referral);
          } else {
            console.warn('[authCheck] ⚠️ partner_referral неполный:', { partner_id, referral_slug, parsed });
          }
        } else {
          console.warn('[authCheck] ⚠️ partner_referral не найден в localStorage');
        }
      } catch (e) {
        console.error('[authCheck] ❌ Ошибка парсинга partner_referral:', e);
      }
      
      // Получаем промокод из URL из localStorage
      let referral_promocode: string | undefined;
      try {
        const promocodeStr = localStorage.getItem('referral_promocode');
        console.log('[authCheck] 🔍 Проверка referral_promocode в localStorage:', promocodeStr);
        if (promocodeStr) {
          referral_promocode = promocodeStr;
          console.log('[authCheck] ✅ Промокод из URL найден:', referral_promocode);
        }
      } catch (e) {
        console.error('[authCheck] ❌ Ошибка получения referral_promocode:', e);
      }
      
      console.log('[authCheck] 📤 Отправка запроса регистрации:', {
        email,
        hasRefId: !!finalRefId,
        ref_id: finalRefId,
        hasPartnerReferral: !!partner_referral,
        partner_referral: partner_referral ? {
          partner_id: partner_referral.partner_id,
          referral_slug: partner_referral.referral_slug
        } : undefined,
        hasReferralPromocode: !!referral_promocode,
        referral_promocode
      });
      
      // Убеждаемся, что partner_referral содержит все необходимые поля перед отправкой
      const finalPartnerReferral = partner_referral && partner_referral.partner_id && partner_referral.referral_slug 
        ? partner_referral 
        : undefined;
      
      if (partner_referral && !finalPartnerReferral) {
        console.warn('[authCheck] ⚠️ partner_referral неполный, не отправляем:', partner_referral);
      }
      
      const response = await authApi.register(email, password, phone, finalRefId, finalPartnerReferral, referral_promocode);
      localStorage.setItem('token', response.token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      
      if (finalRefId) {
        localStorage.removeItem('referral_id');
      }
      
      if (finalPartnerReferral) {
        localStorage.removeItem('partner_referral');
      }
      
      // НЕ удаляем referral_promocode из localStorage после регистрации,
      // чтобы он был доступен на странице депозита
      // Промокод будет удален после использования на странице депозита
      // if (referralPromocode) {
      //   localStorage.removeItem('referral_promocode');
      // }
      
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      
      if (errorMessage.includes('Email уже зарегистрирован')) {
        return rejectWithValue('Email уже зарегистрирован');
      }
      if (errorMessage.includes('password')) {
        return rejectWithValue('The password is too weak');
      }
      
      return rejectWithValue('Registration error. Try again.');
    }
  }
);

export const initiateGoogleAuth = createAsyncThunk<
  { authUrl?: string; redirectUrl?: string },
  { refId?: number; partnerReferral?: { partnerId: number; referralSlug: string }; state?: string },
  { rejectValue: string }
>(
  'auth/initiateGoogleAuth',
  async ({ refId, partnerReferral, state }, { rejectWithValue }) => {
    try {
      // Если refId не передан, пытаемся получить из localStorage
      let finalRefId = refId;
      if (!finalRefId) {
        try {
          const savedRefId = localStorage.getItem('referral_id');
          if (savedRefId) {
            const refIdNum = parseInt(savedRefId, 10);
            if (!isNaN(refIdNum) && refIdNum > 0) {
              finalRefId = refIdNum;
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      // Если partnerReferral не передан, пытаемся получить из localStorage
      let finalPartnerReferral = partnerReferral;
      if (!finalPartnerReferral) {
        try {
          const partnerReferralStr = localStorage.getItem('partner_referral');
          if (partnerReferralStr) {
            finalPartnerReferral = JSON.parse(partnerReferralStr);
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      const response = await authApi.initiateGoogleAuth(finalRefId, finalPartnerReferral, state);
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      return rejectWithValue(errorMessage);
    }
  }
);

export const loginWithGoogle = createAsyncThunk<
  AuthResponse,
  { code: string; state?: string },
  { rejectValue: string }
>(
  'auth/loginWithGoogle',
  async ({ code, state }, { rejectWithValue }) => {
    try {
      const response = await authApi.loginWithGoogle(code, state);
      localStorage.setItem('token', response.token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      
      if (errorMessage.includes('INVALID_CREDENTIALS') || errorMessage.includes('неверные')) {
        return rejectWithValue('Invalid Google authorization');
      }
      if (errorMessage.includes('NETWORK_ERROR')) {
        return rejectWithValue('Network error. Please check your internet connection');
      }
      
      return rejectWithValue('Google login failed. Please try again.');
    }
  }
);

// Защита от повторных вызовов logout
let isLoggingOut = false;

export const logout = () => {
  // Предотвращаем множественные вызовы logout
  if (isLoggingOut) {
    return;
  }
  
  isLoggingOut = true;
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  
  // Небольшая задержка, чтобы дать время завершиться другим операциям
  setTimeout(() => {
    window.location.href = '/';
  }, 100);
};
