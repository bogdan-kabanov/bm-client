import { useEffect, useRef, useContext, type ReactNode, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkAndRegisterUser, logout } from '@src/features/auth/authCheck';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile, selectProfileLoading, selectProfileError } from '@src/entities/user/model/selectors';
import { resetLoading } from '@src/entities/user/model/slice';
import { LanguageContext } from '@src/app/providers/LanguageProvider';
import { RollingSquareLoader } from '@src/shared/ui/loader/RollingSquareLoader';

interface AuthWrapperProps {
    children: ReactNode;
}

export const AuthWrapper = memo(({ children }: AuthWrapperProps) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAppSelector(selectProfile);
    const loading = useAppSelector(selectProfileLoading);
    const error = useAppSelector(selectProfileError);
    const hasChecked = useRef(false);
    const isCheckingRef = useRef(false);
    const loadingTimeoutRef = useRef<number | null>(null);
    const prevUserRef = useRef<boolean>(false);
    const languageContext = useContext(LanguageContext);
    const t = languageContext?.t || ((key: string, params?: any) => {
        if (key === 'common.checkingYourSession') return 'Checking your session...';
        if (key === 'common.authorizationErrorTitle') return 'Authorization Error';
        if (key === 'common.logoutAndLoginAgain') return 'Logout and login again';
        return key;
    });

    useEffect(() => {
        if (user) {
            hasChecked.current = false;
            isCheckingRef.current = false;
            return;
        }
        if (hasChecked.current || isCheckingRef.current) {
            return;
        }
        if (loading) {
            return;
        }

        const savedToken = localStorage.getItem('token');
        
        if (!savedToken) {
            hasChecked.current = true;
            return;
        }

        hasChecked.current = true;
        isCheckingRef.current = true;
        dispatch(checkAndRegisterUser()).finally(() => {
            isCheckingRef.current = false;
            if (!user) {
                hasChecked.current = false;
            }
        });
    }, [dispatch, user, loading]);
    
    useEffect(() => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }

        if (loading && !user) {
            // Устанавливаем таймаут на 30 секунд для предотвращения бесконечной загрузки
            loadingTimeoutRef.current = window.setTimeout(() => {
                loadingTimeoutRef.current = null;
                // Сбрасываем состояние загрузки, чтобы показать страницу входа
                // Это предотвратит бесконечную загрузку при зависании запроса
                console.warn('[AuthWrapper] Таймаут загрузки авторизации (30 сек). Сбрасываем состояние загрузки.');
                dispatch(resetLoading());
            }, 30000);
        }
    }, [loading, user, error, dispatch]);

    useEffect(() => {
        if (user && !prevUserRef.current && (location.pathname === '/' || location.pathname.startsWith('/landing'))) {
            navigate('/trading', { replace: true });
        }
        prevUserRef.current = !!user;
    }, [user, location.pathname, navigate]);

    useEffect(() => {
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, []);

    const handleLogout = () => {
        logout();
    };

    const isNetworkError = error && (
        error.includes('Network error') ||
        error.includes('NETWORK_ERROR') ||
        error.includes('CORS') ||
        error.includes('Failed to fetch') ||
        error.includes('сервер недоступен') ||
        error.includes('timeout')
    );

    if (loading && !user && !isNetworkError) {
        return (
            <div className="app-loader">
                <RollingSquareLoader message={t('common.checkingYourSession')} size="large" />
            </div>
        );
    }

    if (error && !user) {
        // Проверяем, является ли это ошибкой формы авторизации/регистрации
        const isFormError = error.includes('Invalid password') || 
                           error.includes('Invalid email or password') || 
                           error.includes('Invalid credentials') ||
                           error.includes('User not found') ||
                           error.includes('Login failed') ||
                           error.includes('Registration error') ||
                           error.includes('Email already exists') ||
                           error.includes('email already') ||
                           error.includes('Login already exists') ||
                           error.includes('login already') ||
                           error.includes('Invalid email') ||
                           error.includes('Password too short') ||
                           error.includes('Invalid phone') ||
                           error.includes('Email уже зарегистрирован') ||
                           error.includes('The password is too weak') ||
                           error.includes('Invalid Google authorization') ||
                           error.includes('Google login failed');
        
        // Если это ошибка формы или сетевой ошибка, показываем дочерние компоненты
        // (формы авторизации должны обрабатывать эти ошибки сами)
        if (isFormError || isNetworkError) {
            return <>{children}</>;
        }
        
        // Для других ошибок (например, ошибки сессии) показываем страницу ошибки
        // только если мы не на главной странице
        if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/landing')) {
            window.location.href = '/';
            return null;
        }
        
        // На главной странице или landing показываем дочерние компоненты
        // чтобы пользователь мог попробовать авторизоваться снова
        return <>{children}</>;
    }

    return <>{children}</>;
});
