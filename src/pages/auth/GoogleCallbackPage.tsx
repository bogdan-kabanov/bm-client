import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { loginWithGoogle, checkAndRegisterUser } from '@src/features/auth/authCheck';
import { AppSkeleton } from '@src/shared/ui/skeleton/AppSkeleton';
import { getPublicSkeletonPreset } from '@src/shared/ui/skeleton/presets';
import { useLanguage } from '@src/app/providers/useLanguage';

export const GoogleCallbackPage = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectProfile);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Если пользователь уже авторизован, просто редиректим на торговлю
    if (user) {
      window.history.replaceState({}, '', '/');
      navigate('/trading', { replace: true });
      return;
    }

    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
          setStatus('error');
          setErrorMessage(t('auth.missingAuthCode'));
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        // Вызываем loginWithGoogle
        await dispatch(loginWithGoogle({ code, state: state || undefined })).unwrap();
        
        // Загружаем профиль пользователя
        await dispatch(checkAndRegisterUser()).unwrap();
        
        setStatus('success');
        
        // Очищаем URL от параметров
        window.history.replaceState({}, '', '/');
        
        // Перенаправляем на страницу торговли
        navigate('/trading', { replace: true });
      } catch (error: any) {

        setStatus('error');
        setErrorMessage(error?.message || t('auth.googleAuthError'));
        
        // Очищаем URL от параметров
        window.history.replaceState({}, '', '/');
        
        // Перенаправляем на главную через 3 секунды
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, dispatch, user]);

  if (status === 'loading') {
    return <AppSkeleton message="Авторизация через Google..." {...getPublicSkeletonPreset()} />;
  }

  if (status === 'error') {
    return (
      <AppSkeleton
        message={`Ошибка: ${errorMessage}. Перенаправление на главную страницу...`}
        {...getPublicSkeletonPreset()}
      />
    );
  }

  return <AppSkeleton message="Авторизация успешна. Перенаправление..." {...getPublicSkeletonPreset()} />;
};

