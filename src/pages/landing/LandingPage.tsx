import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectProfile } from '@src/entities/user/model/selectors';
import { setUser } from '@src/entities/user/model/slice';
import { loginWithEmail, registerWithEmail, checkAndRegisterUser } from '@src/features/auth/authCheck';
import { useLanguage } from '@src/app/providers/useLanguage';
import styles from './LendingPage.module.css';
import { useAppDispatch } from '@/src/shared/lib/hooks';
import Header from './components/Header';
import AuthModal, { AuthFormValues } from './components/AuthModal';
import HeroSection from './components/HeroSection';
import ExchangesSection from './components/ExchangesSection';
import UrgencyTimer from './components/UrgencyTimer';
import { decodeReferralHash } from '@src/shared/lib/referralHashUtils';

const ArbitrageSection = lazy(() => import('./components/ArbitrageSection'));
const FeaturesSection = lazy(() => import('./components/FeaturesSection'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));
const Footer = lazy(() => import('./components/Footer'));
const TestimonialsSection = lazy(() => import('./components/TestimonialsSection'));
const ProfitabilitySection = lazy(() => import('./components/ProfitabilitySection'));
const BotsDescriptionSection = lazy(() => import('./components/BotsDescriptionSection'));
const WhyChooseSection = lazy(() => import('./components/WhyChooseSection'));
const CTASection = lazy(() => import('./components/CTASection'));

const LendingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectProfile);
  const { t } = useLanguage();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [refId, setRefId] = useState<number | undefined>(undefined);

  // Извлечь refId из URL при загрузке страницы
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Проверяем новый параметр invite (приоритет) и старый ref (для обратной совместимости)
    const inviteParam = urlParams.get('invite');
    const refParam = urlParams.get('ref');
    
    let refIdNum: number | undefined;
    
    if (inviteParam) {
      // Декодируем хеш из нового формата
      refIdNum = decodeReferralHash(inviteParam);
      if (refIdNum) {
        setRefId(refIdNum);
        // Сохраняем числовой ID в localStorage
        localStorage.setItem('referral_id', String(refIdNum));
      }
    } else if (refParam) {
      // Обратная совместимость со старым форматом
      refIdNum = parseInt(refParam, 10);
      if (!isNaN(refIdNum)) {
        setRefId(refIdNum);
        localStorage.setItem('referral_id', refParam);
      }
    } else {
      // Проверить, есть ли сохраненный refId в localStorage
      const savedRefId = localStorage.getItem('referral_id');
      if (savedRefId) {
        refIdNum = parseInt(savedRefId, 10);
        if (!isNaN(refIdNum)) {
          setRefId(refIdNum);
        }
      }
    }
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setAuthError(null);
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
    setAuthError(null);
  };

  const handleLogin = async ({ email, password }: AuthFormValues) => {
    setAuthError(null);
    try {
      await dispatch(loginWithEmail({ email, password })).unwrap();
      // Загружаем профиль пользователя после успешной авторизации
      try {
        await dispatch(checkAndRegisterUser()).unwrap();
        handleCloseAuth();
        // navigate('/trading', { replace: true }); // Отключено по запросу
      } catch (profileError: any) {
        const profileErrorMessage = profileError?.message || profileError?.toString() || '';
        // Всегда показываем ошибку в форме, не делаем редирект при ошибке
        if (profileErrorMessage.includes('Network error') || profileErrorMessage.includes('NETWORK_ERROR')) {
          setAuthError(t('auth.errors.networkError'));
        } else if (profileErrorMessage.includes('Session expired') || profileErrorMessage.includes('SESSION_EXPIRED')) {
          setAuthError(t('auth.errors.sessionExpired'));
        } else if (profileErrorMessage.includes('timeout') || profileErrorMessage.includes('Request timeout')) {
          setAuthError(t('auth.errors.networkError'));
        } else {
          setAuthError(t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.');
        }
      }
    } catch (error: any) {
      // Redux Toolkit возвращает ошибку в error.message
      const errorMessage = error?.message || error?.toString() || '';

      // Всегда показываем ошибку в форме, не делаем редирект при ошибке
      // Маппинг ошибок от authCheck.tsx
      if (errorMessage.includes('Invalid email or password') || errorMessage.includes('Invalid credentials') || errorMessage.includes('UNAUTHORIZED')) {
        setAuthError(t('auth.errors.invalidCredentials'));
      } else if (errorMessage.includes('Invalid password')) {
        setAuthError(t('auth.errors.invalidPassword'));
      } else if (errorMessage.includes('User not found')) {
        setAuthError(t('auth.errors.invalidCredentials'));
      } else if (errorMessage.includes('Session expired')) {
        setAuthError(t('auth.errors.sessionExpired'));
      } else if (errorMessage.includes('Network error') || errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        setAuthError(t('auth.errors.networkError'));
      } else if (errorMessage.includes('Server error')) {
        setAuthError(t('auth.errors.serverError'));
      } else {
        // Для неизвестных ошибок тоже показываем сообщение
        setAuthError(t('auth.errors.invalidCredentials') || 'Неверный email или пароль');
      }
    }
  };

  const handleRegister = async ({ email, password, phone }: AuthFormValues) => {
    setAuthError(null);
    try {
      const registerResponse = await dispatch(registerWithEmail({ email, password, phone, refId })).unwrap();
      
      // Если регистрация вернула user, используем его напрямую
      if (registerResponse?.user) {
        // Обновляем состояние пользователя в Redux
        dispatch(setUser(registerResponse.user));
        // Закрываем модальное окно
        handleCloseAuth();
        // navigate('/trading', { replace: true }); // Отключено по запросу
        return;
      }
      
      // Если user не вернулся, пытаемся загрузить профиль
      try {
        await dispatch(checkAndRegisterUser()).unwrap();
        handleCloseAuth();
        // navigate('/trading', { replace: true }); // Отключено по запросу
      } catch (profileError: any) {
        const profileErrorMessage = profileError?.message || profileError?.toString() || '';
        // Всегда показываем ошибку в форме, не делаем редирект при ошибке
        if (profileErrorMessage.includes('Network error') || profileErrorMessage.includes('NETWORK_ERROR')) {
          setAuthError(t('auth.errors.networkError'));
        } else if (profileErrorMessage.includes('Session expired') || profileErrorMessage.includes('SESSION_EXPIRED')) {
          setAuthError(t('auth.errors.sessionExpired'));
        } else if (profileErrorMessage.includes('timeout') || profileErrorMessage.includes('Request timeout')) {
          setAuthError(t('auth.errors.networkError'));
        } else {
          setAuthError(t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.');
        }
      }
    } catch (error: any) {
      // Redux Toolkit возвращает ошибку в error.message
      const errorMessage = error?.message || error?.toString() || '';

      // Маппинг ошибок от authCheck.tsx
      if (errorMessage.includes('Email already exists') || errorMessage.includes('email already') || errorMessage.includes('Email уже зарегистрирован')) {
        setAuthError(t('auth.errors.emailAlreadyExists'));
      } else if (errorMessage.includes('Login already exists') || errorMessage.includes('login already')) {
        setAuthError(t('auth.errors.loginAlreadyExists'));
      } else if (errorMessage.includes('Invalid email')) {
        setAuthError(t('auth.errors.invalidEmail'));
      } else if (errorMessage.includes('Password too short') || errorMessage.includes('password') || errorMessage.includes('too weak')) {
        setAuthError(t('auth.errors.passwordTooShort'));
      } else if (errorMessage.includes('Invalid phone') || errorMessage.includes('phone')) {
        setAuthError(t('auth.errors.phoneInvalid'));
      } else if (errorMessage.includes('Network error') || errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        setAuthError(t('auth.errors.networkError'));
      } else if (errorMessage.includes('Server error')) {
        setAuthError(t('auth.errors.serverError'));
      } else {
        setAuthError(t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.');
      }
    }
  };

  return (
    <div className={styles.lendingPage}>
      <Header 
        user={user}
        onOpenLogin={() => handleOpenAuth('login')}
        onOpenRegister={() => handleOpenAuth('register')}
      />

      <main className={styles.lendingContent}>
        <HeroSection onGetStarted={() => handleOpenAuth('register')} />
        <ExchangesSection />
        <UrgencyTimer onGetStarted={() => handleOpenAuth('register')} />
        <Suspense fallback={null}>
          <ArbitrageSection />
        </Suspense>
        <Suspense fallback={null}>
          <WhyChooseSection />
        </Suspense>
        <Suspense fallback={null}>
          <CTASection onGetStarted={() => handleOpenAuth('register')} />
        </Suspense>
        <Suspense fallback={null}>
          <FeaturesSection />
        </Suspense>
        <Suspense fallback={null}>
          <ProfitabilitySection />
        </Suspense>
        <Suspense fallback={null}>
          <BotsDescriptionSection />
        </Suspense>
        <Suspense fallback={null}>
          <HowItWorks onGetStarted={() => handleOpenAuth('register')} />
        </Suspense>
        <Suspense fallback={null}>
          <TestimonialsSection />
        </Suspense>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onClose={handleCloseAuth}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        error={authError}
      />
    </div>
  );
};

export default LendingPage;