export { PublicRoutes } from './publicRoutes';
export { PrivateRoutes } from './privateRoutes';
export * from './lazyComponents';

import { useEffect, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { PublicRoutes } from './publicRoutes';
import { PrivateRoutes } from './privateRoutes';

export const AppRouter = () => {
    const user = useAppSelector(selectProfile);
    const navigate = useNavigate();
    const location = useLocation();
    
    // Список защищенных маршрутов, которые требуют авторизации
    const protectedRoutes = [
        '/trading',
        '/deposit',
        '/withdraw',
        '/transaction-history',
        '/profile',
        '/bots',
        '/referrals',
        '/email/verify',
        '/auth/google/callback',
        '/privacy-policy',
        '/terms',
        '/risk-disclosure',
        '/company'
    ];
    
    const isProtectedRoute = protectedRoutes.some(route => 
        location.pathname === route || location.pathname.startsWith(route + '/')
    );
    
    useEffect(() => {
        const pathname = location.pathname;
        const isLanding = pathname === '/landing' || 
            (pathname[0] === '/' && 
             pathname[1] === 'l' && 
             pathname[2] === 'a' && 
             pathname[3] === 'n' && 
             pathname[4] === 'd' && 
             pathname[5] === 'i' && 
             pathname[6] === 'n' && 
             pathname[7] === 'g');
        if (user && (pathname === '/' || isLanding)) {
            navigate('/trading', { replace: true });
        }
    }, [user, location.pathname, navigate]);
    
    // Если это защищенный маршрут и пользователь еще не загружен, показываем загрузку
    // Это предотвращает редирект на / через PublicRoutes
    if (isProtectedRoute && !user) {
        return (
            <div style={{ color: "#ffffff",display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Loading...
            </div>
        );
    }
    
    if (user) {
        return (
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>}>
                <PrivateRoutes autoAccessGranted={true} />
            </Suspense>
        );
    }
    
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>}>
            <PublicRoutes />
        </Suspense>
    );
};

