import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import classNames from 'classnames';
import { useLanguage } from '@src/app/providers/useLanguage';
import { useAppDispatch } from '@/src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { setUser } from '@src/entities/user/model/slice';
import { loginWithEmail, registerWithEmail, checkAndRegisterUser, initiateGoogleAuth, loginWithGoogle } from '@src/features/auth/authCheck';
import AuthModal, { AuthFormValues } from '../landing/components/AuthModal';
import { PhoneInput } from '@/src/shared/ui/PhoneInput';
import { getPartnerProgramUrl } from '@src/shared/lib/partnerServerUtils';
import styles from './LandingPageV2.module.css';
import fullLogo from '@src/assets/full-logo.png';
import platformImage from '@src/assets/1.png';
import smallImage from '@src/assets/small-image.jpg';
import bigImage from '@src/assets/big-image.jpg';
import demoTabImage from '@src/assets/DEMOTab3.png';
import methodVisa from '@src/assets/Methodland/method-visa.svg';
import methodMaster from '@src/assets/Methodland/method-master.svg';
import methodBitcoin from '@src/assets/Methodland/method-bitcoin.svg';
import methodEthereum from '@src/assets/Methodland/method-ethereum.svg';
import methodLitecoin from '@src/assets/Methodland/method-litecoin.svg';
import methodRipple from '@src/assets/Methodland/method-ripple.svg';
import methodTether from '@src/assets/Methodland/method-tether.svg';
import methodOpenBanking from '@src/assets/Methodland/method-OpenBanking.svg';
import heroBackgroundImage from '@src/assets/FonT4.png';
import desktopBackgroundImage from '@src/assets/FonT5.png';
import telBackgroundImage from '@src/assets/TEL.png';
import iphone from '@src/assets/iphone.svg';
import iconUserFriendly from '@src/assets/User-friendly interface.png';
import iconIntegratedSignals from '@src/assets/Integrated signals.png';
import iconTradingIndicators from '@src/assets/Trading indicators.png';
import iconSupport247 from '@src/assets/Support 247.png';
import iconBonusPrograms from '@src/assets/Bonus programs.png';
import iconDepositsWithdrawals from '@src/assets/Deposits & withdrawals.png';
import avatarArjun from '@src/assets/Avatar/Arjun.png';
import avatarMasroor from '@src/assets/Avatar/Masroor.jpg';
import avatarMichael from '@src/assets/Avatar/Michael.png';
import avatarSophie from '@src/assets/Avatar/Sophie.png';
import { decodeReferralHash } from '@src/shared/lib/referralHashUtils';
import { decodePartnerRef, trackPartnerClick } from '@src/shared/lib/partnerReferralUtils';

type LocaleKey = 'ru' | 'en';

type LocaleMap<T> = Record<LocaleKey, T> & { default: T };

type NavLink = { label: string; href: string };
type Feature = { icon: string; title: string; description: string; cta: string };
type CapitalStep = { title: string; description: string };
type Review = { name: string; date: string; amount: string; text: string; link: string; rating: number };
type FaqItem = { question: string; answer: string };
type FooterLinkGroup = { title: string; items: Array<{ label: string; href: string; external?: boolean }> };

const getLocaleValue = <T,>(map: LocaleMap<T>, language: string): T => {
  if (map[language as LocaleKey]) {
    return map[language as LocaleKey];
  }
  return map.default;
};

const iconMap: Record<string, string> = {
  '🧭': iconUserFriendly,
  '📡': iconIntegratedSignals,
  '📈': iconTradingIndicators,
  '💬': iconSupport247,
  '🎁': iconBonusPrograms,
  '💸': iconDepositsWithdrawals,
};

const avatarMap: Record<string, string> = {
  'Arjun': avatarArjun,
  'Masroor': avatarMasroor,
  'Michael': avatarMichael,
  'Sophie': avatarSophie,
};

export const LandingPageV2: FC = () => {
  const { t, language } = useLanguage();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectProfile);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [refId, setRefId] = useState<number | undefined>(undefined);
  
  useEffect(() => {
    // Добавляем класс на body для разрешения прокрутки
    document.body.classList.add('landing-page-active');
    document.documentElement.classList.add('landing-page-active');
    
    // Принудительно устанавливаем стили через JavaScript для гарантии
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    
    if (html) {
      html.style.overflowY = 'auto';
      html.style.position = 'static';
      html.style.height = 'auto';
      html.style.minHeight = '100vh';
    }
    
    if (body) {
      body.style.overflowY = 'auto';
      body.style.position = 'static';
      body.style.height = 'auto';
      body.style.minHeight = '100vh';
    }
    
    if (root) {
      root.style.overflowY = 'auto';
      root.style.position = 'static';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
    }
    
    return () => {
      document.body.classList.remove('landing-page-active');
      document.documentElement.classList.remove('landing-page-active');
      
      if (html) {
        html.style.overflowY = '';
        html.style.position = '';
        html.style.height = '';
        html.style.minHeight = '';
      }
      
      if (body) {
        body.style.overflowY = '';
        body.style.position = '';
        body.style.height = '';
        body.style.minHeight = '';
      }
      
      if (root) {
        root.style.overflowY = '';
        root.style.position = '';
        root.style.height = '';
        root.style.minHeight = '';
      }
    };
  }, []);
  const featuresGridRef = useRef<HTMLDivElement>(null);
  const reviewsGridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDraggingReviews, setIsDraggingReviews] = useState(false);
  const [startXReviews, setStartXReviews] = useState(0);
  const [scrollLeftReviews, setScrollLeftReviews] = useState(0);
  const [sidebarMode, setSidebarMode] = useState<'login' | 'register'>('register');
  const [sidebarFormData, setSidebarFormData] = useState<AuthFormValues>({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [sidebarFormError, setSidebarFormError] = useState<string | null>(null);
  const [sidebarShowPassword, setSidebarShowPassword] = useState(false);
  const [sidebarPolicyAccepted, setSidebarPolicyAccepted] = useState(false);
  const [sidebarPhoneValid, setSidebarPhoneValid] = useState(true);
  const [sidebarBlink, setSidebarBlink] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleCode = urlParams.get('code');
    const googleState = urlParams.get('state');
    
    if (googleCode) {
      const handleGoogleCallback = async () => {
        try {
          await dispatch(loginWithGoogle({ code: googleCode, state: googleState || undefined })).unwrap();
          await dispatch(checkAndRegisterUser()).unwrap();
          window.history.replaceState({}, '', window.location.pathname);
          // navigate('/trading', { replace: true }); // Отключено по запросу
        } catch (error: any) {
          setAuthError(error?.message || 'Ошибка авторизации через Google');
          window.history.replaceState({}, '', window.location.pathname);
        }
      };
      
      handleGoogleCallback();
    }
    
    const inviteParam = urlParams.get('invite');
    const refParam = urlParams.get('ref');
    const promocodeParam = urlParams.get('promocode');
    
    // Сохраняем промокод из URL в localStorage
    if (promocodeParam) {
      console.log('[LandingPageV2] Промокод из URL:', promocodeParam);
      localStorage.setItem('referral_promocode', promocodeParam);
    }
    
    let refIdNum: number | undefined;
    
    if (refParam) {
      console.log('[LandingPageV2] Обработка ref параметра:', refParam);
      decodePartnerRef(refParam).then(partnerRef => {
        if (partnerRef) {
          console.log('[LandingPageV2] Партнерская ссылка декодирована:', partnerRef);
          const utmParams: Record<string, string> = {};
          
          if (partnerRef.utmParams) {
            Object.assign(utmParams, partnerRef.utmParams);
          }
          
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_event', 'utm_id', 'utm_creative', 'utm_placement', 'utm_network', 'utm_device', 'utm_geo', 'utm_language'].forEach(key => {
            const value = urlParams.get(key);
            if (value) {
              utmParams[key] = value;
            }
          });

          console.log('[LandingPageV2] Отслеживание клика:', {
            partnerId: partnerRef.partnerId,
            referralSlug: partnerRef.referralSlug,
            utmParams
          });
          trackPartnerClick(partnerRef.partnerId, partnerRef.referralSlug, utmParams)
            .then(success => {
              if (success) {
                console.log('[LandingPageV2] ✅ Клик успешно отслежен');
              } else {
                console.error('[LandingPageV2] ❌ Ошибка отслеживания клика');
              }
            })
            .catch(error => {
              console.error('[LandingPageV2] ❌ Ошибка при отслеживании клика:', error);
            });
          
          // Сохраняем информацию о партнере для использования при регистрации
          const partnerReferralData = {
            partnerId: partnerRef.partnerId,
            referralSlug: partnerRef.referralSlug
          };
          console.log('[LandingPageV2] 💾 Сохранение partner_referral в localStorage:', partnerReferralData);
          localStorage.setItem('partner_referral', JSON.stringify(partnerReferralData));
          
          // Проверяем, что данные сохранились
          const saved = localStorage.getItem('partner_referral');
          if (saved) {
            console.log('[LandingPageV2] ✅ partner_referral успешно сохранен:', saved);
          } else {
            console.error('[LandingPageV2] ❌ Ошибка сохранения partner_referral');
          }
        } else {
          console.warn('[LandingPageV2] ⚠️ Не удалось декодировать ref параметр:', refParam);
        }
      }).catch(error => {
        console.error('[LandingPageV2] ❌ Ошибка при декодировании ref параметра:', error);
      });
    }
    
    if (inviteParam) {
      refIdNum = decodeReferralHash(inviteParam);
      if (refIdNum) {
        setRefId(refIdNum);
        localStorage.setItem('referral_id', String(refIdNum));
      }
    } else if (refParam) {
      refIdNum = parseInt(refParam, 10);
      if (!Number.isNaN(refIdNum)) {
        setRefId(refIdNum);
        localStorage.setItem('referral_id', refParam);
      }
    } else {
      const savedRefId = localStorage.getItem('referral_id');
      if (savedRefId) {
        refIdNum = parseInt(savedRefId, 10);
        if (!Number.isNaN(refIdNum)) {
          setRefId(refIdNum);
        }
      }
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!featuresGridRef.current) return;
      e.preventDefault();
      const rect = featuresGridRef.current.getBoundingClientRect();
      const x = e.pageX - rect.left;
      const walk = (x - startX) * 2;
      featuresGridRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, startX, scrollLeft]);

  useEffect(() => {
    if (!isDraggingReviews) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!reviewsGridRef.current) return;
      e.preventDefault();
      const rect = reviewsGridRef.current.getBoundingClientRect();
      const x = e.pageX - rect.left;
      const walk = (x - startXReviews) * 2;
      reviewsGridRef.current.scrollLeft = scrollLeftReviews - walk;
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingReviews(false);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingReviews, startXReviews, scrollLeftReviews]);

  const triggerSidebarBlink = useCallback(() => {
    if (sidebarRef.current) {
      setSidebarBlink(true);
      sidebarRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setSidebarBlink(false), 1000);
    }
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register', shouldBlink: boolean = false) => {
    const isMobile = window.innerWidth <= 1400;
    
    if (isMobile) {
      setAuthMode(mode);
      setAuthModalOpen(true);
      setAuthError(null);
    } else {
      setSidebarMode(mode);
      setSidebarFormError(null);
    }
    
    if (shouldBlink) {
      triggerSidebarBlink();
    }
  };

  const handleButtonClick = (mode: 'login' | 'register' = 'register') => {
    handleOpenAuth(mode, true);
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
    setAuthError(null);
  };

  const handleLogin = async ({ email, password }: AuthFormValues) => {
    setAuthError(null);
    setSidebarFormError(null);
    console.log('[LandingPageV2] handleLogin вызван');
    try {
      const loginResult = await dispatch(loginWithEmail({ email, password })).unwrap();
      console.log('[LandingPageV2] loginResult:', loginResult);
      
      if (loginResult?.user) {
        dispatch(setUser(loginResult.user));
        setAuthModalOpen(false);
        setAuthError(null);
        setSidebarFormError(null);
        // navigate('/trading', { replace: true }); // Отключено по запросу
        return;
      }
      
      try {
        await dispatch(checkAndRegisterUser()).unwrap();
        setAuthModalOpen(false);
        setAuthError(null);
        setSidebarFormError(null);
        // navigate('/trading', { replace: true }); // Отключено по запросу
      } catch (profileError: any) {
        const profileErrorMessage = profileError?.message || profileError?.toString() || '';
        const errorText = profileErrorMessage.includes('Network error') || profileErrorMessage.includes('NETWORK_ERROR')
          ? t('auth.errors.networkError')
          : profileErrorMessage.includes('Session expired') || profileErrorMessage.includes('SESSION_EXPIRED')
          ? t('auth.errors.sessionExpired')
          : profileErrorMessage.includes('timeout') || profileErrorMessage.includes('Request timeout')
          ? t('auth.errors.networkError')
          : t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.';
        setAuthError(errorText);
        setSidebarFormError(errorText);
      }
    } catch (error: any) {
      console.error('[LandingPageV2] Ошибка в handleLogin:', error);
      const errorMessage = error?.message || error?.toString() || '';
      console.log('[LandingPageV2] errorMessage:', errorMessage);

      let errorText = '';
      if (errorMessage.includes('Invalid email or password') || errorMessage.includes('Invalid credentials') || errorMessage.includes('UNAUTHORIZED')) {
        errorText = t('auth.errors.invalidCredentials') || 'Неверный email или пароль';
      } else if (errorMessage.includes('Invalid password')) {
        errorText = t('auth.errors.invalidPassword');
      } else if (errorMessage.includes('User not found')) {
        errorText = t('auth.errors.invalidCredentials');
      } else if (errorMessage.includes('Session expired')) {
        errorText = t('auth.errors.sessionExpired');
      } else if (errorMessage.includes('Network error') || errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        errorText = t('auth.errors.networkError') || 'Ошибка сети. Проверьте подключение к интернету и попробуйте снова.';
      } else if (errorMessage.includes('Server error')) {
        errorText = t('auth.errors.serverError');
      } else {
        errorText = t('auth.errors.invalidCredentials') || 'Неверный email или пароль';
      }
      
      console.log('[LandingPageV2] Устанавливаем ошибку:', errorText);
      setAuthError(errorText);
      setSidebarFormError(errorText);
    }
  };

  const handleRegister = async ({ email, password, phone }: AuthFormValues) => {
    setAuthError(null);
    setSidebarFormError(null);
    try {
      const registerResponse = await dispatch(registerWithEmail({ email, password, phone, refId })).unwrap();
      
      // Если регистрация вернула user, используем его напрямую
      if (registerResponse?.user) {
        // Обновляем состояние пользователя в Redux
        dispatch(setUser(registerResponse.user));
        // Закрываем модальное окно
        setAuthModalOpen(false);
        setAuthError(null);
        setSidebarFormError(null);
        // navigate('/trading', { replace: true }); // Отключено по запросу
        return;
      }
      
      // Если user не вернулся, пытаемся загрузить профиль
      try {
        await dispatch(checkAndRegisterUser()).unwrap();
        // Закрываем модальное окно только после успешной регистрации и загрузки профиля
        setAuthModalOpen(false);
        setAuthError(null);
        setSidebarFormError(null);
        // navigate('/trading', { replace: true }); // Отключено по запросу
      } catch (profileError: any) {
        const profileErrorMessage = profileError?.message || profileError?.toString() || '';
        const errorText = profileErrorMessage.includes('Network error') || profileErrorMessage.includes('NETWORK_ERROR')
          ? t('auth.errors.networkError')
          : profileErrorMessage.includes('Session expired') || profileErrorMessage.includes('SESSION_EXPIRED')
          ? t('auth.errors.sessionExpired')
          : profileErrorMessage.includes('timeout') || profileErrorMessage.includes('Request timeout')
          ? t('auth.errors.networkError')
          : t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.';
        setAuthError(errorText);
        setSidebarFormError(errorText);
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '';

      let errorText = '';
      if (errorMessage.includes('Email already exists') || errorMessage.includes('email already') || errorMessage.includes('Email уже зарегистрирован')) {
        errorText = t('auth.errors.emailAlreadyExists');
      } else if (errorMessage.includes('Login already exists') || errorMessage.includes('login already')) {
        errorText = t('auth.errors.loginAlreadyExists');
      } else if (errorMessage.includes('Invalid email')) {
        errorText = t('auth.errors.invalidEmail');
      } else if (errorMessage.includes('Password too short') || errorMessage.includes('password') || errorMessage.includes('too weak')) {
        errorText = t('auth.errors.passwordTooShort');
      } else if (errorMessage.includes('Invalid phone') || errorMessage.includes('phone')) {
        errorText = t('auth.errors.phoneInvalid');
      } else if (errorMessage.includes('Network error') || errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        errorText = t('auth.errors.networkError');
      } else if (errorMessage.includes('Server error')) {
        errorText = t('auth.errors.serverError');
      } else {
        errorText = t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.';
      }
      
      setAuthError(errorText);
      setSidebarFormError(errorText);
    }
  };

  const handleGoogleAuthModal = async () => {
    try {
      let partnerReferral: { partnerId: number; referralSlug: string } | undefined;
      try {
        const partnerReferralStr = localStorage.getItem('partner_referral');
        if (partnerReferralStr) {
          partnerReferral = JSON.parse(partnerReferralStr);
        }
      } catch (e) {

      }
      
      const result = await dispatch(initiateGoogleAuth({ refId, partnerReferral, state: authMode })).unwrap();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {

        setAuthError('Ошибка: не получен URL для авторизации');
      }
    } catch (error: any) {

      setAuthError(error?.message || 'Ошибка авторизации через Google');
    }
  };

  const navLinks = useMemo(
    () =>
      getLocaleValue<NavLink[]>(
        {
          ru: [
            { label: 'Возможности', href: '#features' },
            { label: 'Демо', href: '#demo' },
            { label: 'Отзывы', href: '#reviews' },
            { label: 'FAQ', href: '#faq' },
          ],
          en: [
            { label: 'Features', href: '#features' },
            { label: 'Demo', href: '#demo' },
            { label: 'Reviews', href: '#reviews' },
            { label: 'FAQ', href: '#faq' },
          ],
          default: [
            { label: 'Features', href: '#features' },
            { label: 'Demo', href: '#demo' },
            { label: 'Reviews', href: '#reviews' },
            { label: 'FAQ', href: '#faq' },
          ],
        },
        language
      ),
    [language]
  );

  const ctaPrimary = getLocaleValue(
    {
      ru: 'РЕГИСТРАЦИЯ',
      en: 'SIGN UP',
      default: 'SIGN UP',
    },
    language
  );

  const ctaSecondary = getLocaleValue(
    {
      ru: 'Войти',
      en: 'Log in',
      default: 'Log in',
    },
    language
  );

  const heroContent = useMemo(
    () =>
      getLocaleValue(
        {
          ru: {
            title: 'Трейдинговая платформа для умных инвестиций',
            subtitle: 'Зарегистрируйтесь и получите 50 000 USD на демо-счёт, чтобы потренироваться в торговле.',
            note: '* Минимальный депозит для реальной торговли — 10 USD',
            demoCta: 'Попробовать демо без регистрации',
          },
          en: {
            title: 'Trading platform for smart investments',
            subtitle: 'Sign up and get 50,000 USD on your demo account to learn how to trade.',
            note: '* The minimum deposit amount to start real trading is 10 USD',
            demoCta: 'Try demo',
          },
          default: {
            title: 'Trading platform for smart investments',
            subtitle: 'Sign up and get 50,000 USD on your demo account to learn how to trade.',
            note: '* The minimum deposit amount to start real trading is 10 USD',
            demoCta: 'Try demo',
          },
        },
        language
      ),
    [language]
  );

  const platformContent = useMemo(
    () =>
      getLocaleValue(
        {
          ru: {
            title: 'Доступ к платформе с любого устройства',
            subtitle:
              'Современный интерфейс, быстрые котировки и профессиональные инструменты под ваши стратегии. Никакого скачивания — просто войдите в браузере или используйте мобильное приложение.',
            demo: 'Попробовать бесплатно',
          },
          en: {
            title: 'Access the platform from any device',
            subtitle:
              'Modern interface, lightning-fast quotes and professional tools for your strategies. No downloads required — just log in via browser or use the mobile app.',
            demo: 'Try it for free',
          },
          default: {
            title: 'Access the platform from any device',
            subtitle:
              'Modern interface, lightning-fast quotes and professional tools for your strategies. No downloads required — just log in via browser or use the mobile app.',
            demo: 'Try it for free',
          },
        },
        language
      ),
    [language]
  );

  const featureBlocks = useMemo(
    () =>
      getLocaleValue<Feature[]>(
        {
          ru: [
            {
              icon: '🧭',
              title: 'Понятный интерфейс',
              description: 'Все торговые инструменты под рукой, интуитивная навигация и высокая скорость исполнения.',
              cta: 'Зарегистрироваться',
            },
            {
              icon: '📡',
              title: 'Интегрированные сигналы',
              description: 'Подсказки с точностью до 87% помогут выстроить прибыльную стратегию.',
              cta: 'Попробовать',
            },
            {
              icon: '📈',
              title: 'Индикаторы для анализа',
              description:
                'Популярные индикаторы и графические инструменты — тестируйте на демо и переходите на реальный счёт.',
              cta: 'Исследовать',
            },
            {
              icon: '💬',
              title: 'Поддержка 24/7',
              description: 'Команда профессионалов на связи круглосуточно — получайте ответы в чате или по e-mail.',
              cta: 'Написать нам',
            },
            {
              icon: '🎁',
              title: 'Бонусы и турниры',
              description: 'Участвуйте в акциях для трейдеров, получайте подарки и повышайте оборот.',
              cta: 'Получить бонус',
            },
            {
              icon: '💸',
              title: 'Платежи без задержек',
              description: 'Разнообразные способы ввода и молниеносный вывод средств. Минимальный депозит — 10 USD.',
              cta: 'Начать торговлю',
            },
          ],
          en: [
            {
              icon: '🧭',
              title: 'User-friendly interface',
              description: 'All trading instruments at your fingertips with impressive execution speed.',
              cta: 'Sign up',
            },
            {
              icon: '📡',
              title: 'Integrated signals',
              description: 'Signals with up to 87% accuracy help you shape a profitable strategy.',
              cta: 'Try it',
            },
            {
              icon: '📈',
              title: 'Trading indicators',
              description:
                'A curated set of popular indicators and drawing tools — test them on demo and move to live.',
              cta: 'Explore',
            },
            {
              icon: '💬',
              title: 'Support 24/7',
              description: 'Highly trained support staff ready to assist you any time across channels.',
              cta: 'Contact support',
            },
            {
              icon: '🎁',
              title: 'Bonus programs',
              description: 'Join trader tournaments and giveaways to unlock extra rewards.',
              cta: 'Get a bonus',
            },
            {
              icon: '💸',
              title: 'Deposits & withdrawals',
              description: 'Multiple payment options and fast payouts. Minimum deposit starts at 10 USD.',
              cta: 'Start trading',
            },
          ],
          default: [],
        },
        language
      ),
    [language]
  );

  const capitalSteps = useMemo(
    () =>
      getLocaleValue<CapitalStep[]>(
        {
          ru: [
            { title: 'Выберите актив', description: 'Более 100 инструментов: валюты, сырьё, акции и индексы.' },
            { title: 'Проанализируйте график', description: 'Используйте индикаторы, сигналы и исторические данные.' },
            { title: 'Откройте сделку', description: 'Определите направление движения и настройте параметры сделки.' },
            { title: 'Получите результат', description: 'Фиксируйте прибыль и выводите средства без комиссий брокера.' },
          ],
          en: [
            { title: 'Select an asset', description: 'Choose from 100+ instruments: forex, commodities, stocks, indices.' },
            { title: 'Study the chart', description: 'Apply indicators, signals and historical data to validate the setup.' },
            { title: 'Place a trade', description: 'Set direction, investment amount and trade duration in one click.' },
            { title: 'Take the result', description: 'Lock in profit and withdraw instantly with zero broker fees.' },
          ],
          default: [],
        },
        language
      ),
    [language]
  );

  const reviews = useMemo(
    () =>
      getLocaleValue<Review[]>(
        {
          ru: [
            {
              name: 'Arjun',
              date: '03.12.2024',
              amount: '$913',
              rating: 5,
              text: 'Интерфейс понятный и простой. Сделки открываются мгновенно, а соотношение по сигналам 1:1. Приложение работает стабильно.',
              link: '',
            },
            {
              name: 'Sophie',
              date: '28.11.2024',
              amount: '$1041',
              rating: 5,
              text: 'Отличная платформа! Саппорт отвечает быстро, а доходность радует. BlockMind — реальный шанс заработать.',
              link: '',
            },
            {
              name: 'Michael',
              date: '25.11.2024',
              amount: '$398',
              rating: 5,
              text: 'Пользуюсь несколько лет. Удобно управлять сделками и следить за рынком. Поддержка даёт развернутые ответы, вывод приходит без комиссий.',
              link: '',
            },
            {
              name: 'Masroor',
              date: '11.10.2024',
              amount: '$428',
              rating: 5,
              text: 'С момента регистрации платформа только радует. Быстрые платежи, куча инструментов и приятные бонусы.',
              link: '',
            },
          ],
          en: [
            {
              name: 'Arjun',
              date: 'December 03, 2024',
              amount: '$913',
              rating: 5,
              text: 'The interface is easy to understand and use. Trades execute instantly and the signal ratio stays 1:1. The app works flawlessly.',
              link: '',
            },
            {
              name: 'Sophie',
              date: 'November 28, 2024',
              amount: '$1041',
              rating: 5,
              text: 'BlockMind is a great trading platform. Support responds fast and profitability is impressive. It is a real opportunity to generate profit.',
              link: '',
            },
            {
              name: 'Michael',
              date: 'November 25, 2024',
              amount: '$398',
              rating: 5,
              text: 'I have only positive experiences. Intuitive design, responsive support and fast withdrawals with zero fees. The toolkit covers everything I need.',
              link: '',
            },
            {
              name: 'Masroor',
              date: 'October 11, 2024',
              amount: '$428',
              rating: 5,
              text: 'From day one the platform impresses. Quick deposits, lots of assets and unique promos keep trading exciting.',
              link: '',
            },
          ],
          default: [],
        },
        language
      ),
    [language]
  );

  const appContent = useMemo(
    () =>
      getLocaleValue(
        {
          ru: {
            title: 'Широкий спектр платежных систем',
            subtitle: 'Пополняйте и выводите средства наиболее удобным способом: банковской картой, электронным кошельком, криптовалютой.',
          },
          en: {
            title: 'Wide range of payment systems',
            subtitle: 'Make deposits and withdrawals in a most convenient way: with a bank card, e-wallet, cryptocurrency.',
          },
          default: {
            title: 'Wide range of payment systems',
            subtitle: 'Make deposits and withdrawals in a most convenient way: with a bank card, e-wallet, cryptocurrency.',
          },
        },
        language
      ),
    [language]
  );

  const faqItems = useMemo(
    () =>
      getLocaleValue<FaqItem[]>(
        {
          ru: [
            {
              question: 'Как научиться торговать?',
              answer:
                'Создайте аккаунт и начните практиковаться на бесплатном демо. Процесс полностью повторяет реальную торговлю, но используется виртуальный баланс.',
            },
            {
              question: 'Сколько времени занимает вывод средств?',
              answer:
                'Заявка обрабатывается в среднем от 1 до 5 дней в зависимости от загруженности платёжных систем. Мы стараемся перечислять средства как можно быстрее.',
            },
            {
              question: 'Что такое торговая платформа и зачем она нужна?',
              answer:
                'Это программное решение, которое позволяет совершать сделки, видеть котировки, выбирать активы и анализировать рынок в режиме реального времени.',
            },
            {
              question: 'Могу ли я торговать с телефона?',
              answer:
                'Да, платформа оптимизирована под браузер и мобильные устройства. Доступно Android-приложение и адаптивная веб-версия.',
            },
            {
              question: 'Каков минимальный депозит?',
              answer: 'Торговать можно, пополнив счёт всего на 10 USD. Этого достаточно, чтобы начать и протестировать стратегию.',
            },
            {
              question: 'Есть ли комиссии за ввод и вывод?',
              answer:
                'Брокер не берёт комиссий. Возможные сборы может взимать платёжная система или банк согласно своим тарифам.',
            },
          ],
          en: [
            {
              question: 'How do I learn how to trade?',
              answer:
                'Create an account and start practicing on the free demo. It mirrors real trading but uses virtual funds.',
            },
            {
              question: 'How long does it take to withdraw funds?',
              answer:
                'Withdrawal requests are usually processed within 1–5 days depending on current volume. We strive to send funds as fast as possible.',
            },
            {
              question: 'What is a trading platform and what is it for?',
              answer:
                'It is a software solution that lets you trade financial instruments, monitor live quotes, asset stats and payout rates in real time.',
            },
            {
              question: 'Can I trade using a phone or mobile device?',
              answer:
                'Yes, the platform is optimised for browsers and mobile. Use the Android app or responsive web terminal on your device.',
            },
            {
              question: 'What is the minimum deposit amount?',
              answer: 'You can start trading with just 10 USD. This is enough to launch and test your strategy.',
            },
            {
              question: 'Are there any deposit or withdrawal fees?',
              answer:
                'The broker does not charge fees. Payment providers may apply their own commissions or currency exchange rates.',
            },
          ],
          default: [],
        },
        language
      ),
    [language]
  );

  const footerLinkGroups = useMemo(() => {
    const partnerProgramUrl = getPartnerProgramUrl() || '#';
    
    return getLocaleValue<FooterLinkGroup[]>(
      {
        ru: [
          {
            title: 'Privacy policy',
            items: [
              { label: 'Политика конфиденциальности', href: '/privacy-policy', external: false },
            ],
          },
          {
            title: 'Service agreement',
            items: [
              { label: 'Пользовательское соглашение', href: '/terms', external: false },
            ],
          },
          {
            title: 'Risk disclosure',
            items: [
              { label: 'Предупреждение о рисках', href: '/risk-disclosure', external: false },
            ],
          },
          {
            title: 'Company',
            items: [
              { label: 'Компания', href: '/company', external: false },
              { label: 'FAQ', href: '#faq', external: false },
              { label: 'Контакты', href: '#', external: true },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Демо-счёт', href: '#', external: true },
              { label: 'Партнёрская программа', href: partnerProgramUrl, external: true },
            ],
          },
        ],
        en: [
          {
            title: 'Privacy policy',
            items: [
              { label: 'Privacy policy', href: '/privacy-policy', external: false },
            ],
          },
          {
            title: 'Service agreement',
            items: [
              { label: 'Service agreement', href: '/terms', external: false },
            ],
          },
          {
            title: 'Risk disclosure',
            items: [
              { label: 'Risk disclosure', href: '/risk-disclosure', external: false },
            ],
          },
          {
            title: 'Company',
            items: [
              { label: 'Company', href: '/company', external: false },
              { label: 'FAQ', href: '#faq', external: false },
              { label: 'Contacts', href: '#', external: true },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Demo account', href: '#', external: true },
              { label: 'Affiliate program', href: partnerProgramUrl, external: true },
            ],
          },
        ],
        default: [],
      },
      language
    );
  }, [language]);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const footerCopy = useMemo(
    () =>
      getLocaleValue(
        {
          ru: {
            legal: 'ON SPOT LLC GROUP. Адрес: Main Street, P.O. Box 625, Charlestown, St. Kitts and Nevis.',
            availability:
              'Сайт недоступен в ряде стран, включая США, Канаду, Гонконг, страны ЕЭЗ, Израиль, Россию, а также для лиц младше 18 лет.',
            risk:
              'Предупреждение о рисках: торговля Forex и другими инструментами с плечом связана с высоким риском и может привести к потере вложенных средств. Не инвестируйте больше, чем готовы потерять, и убедитесь, что понимаете все риски. Перед началом торговли учитывайте опыт и цели, при необходимости получите независимую консультацию.',
            ownership: 'ON SPOT LLC GROUP.',
            copy: `Copyright © ${currentYear} BlockMind. Все права защищены.`,
          },
          en: {
            legal: 'BlockMind LTD',
            availability:
              'Services are not available in several countries including USA, Canada, Hong Kong, EEA countries, Israel, Russia, and for persons under 18 years of age.',
            risk:
              'Risk warning: Trading Forex and leveraged instruments involves significant risk of losing your capital. Do not invest more than you can afford to lose and make sure you understand the risks. Consider your experience, objectives and seek independent advice if necessary.',
            ownership: 'BlockMind LTD',
            copy: `Copyright © ${currentYear} BlockMind. All rights reserved.`,
          },
          default: {
            legal: 'BlockMind LTD',
            availability:
              'Services are not available in several countries including USA, Canada, Hong Kong, EEA countries, Israel, Russia, and for persons under 18 years of age.',
            risk:
              'Risk warning: Trading Forex and leveraged instruments involves significant risk of losing your capital. Do not invest more than you can afford to lose and make sure you understand the risks.',
            ownership: 'BlockMind LTD',
            copy: `Copyright © ${currentYear} BlockMind. All rights reserved.`,
          },
        },
        language
      ),
    [currentYear, language]
  );

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, index) => (
      <span
        key={index}
        className={classNames(styles.reviewStar, { [styles.reviewStarActive]: index < rating })}
        aria-hidden="true"
      >
        ★
      </span>
    ));

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    if (!featuresGridRef.current) return;
    const rect = featuresGridRef.current.getBoundingClientRect();
    const x = e.pageX - rect.left;
    const y = e.pageY - rect.top;
    
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      return;
    }
    
    setIsDragging(true);
    setStartX(x);
    setScrollLeft(featuresGridRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseDownReviews = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    if (!reviewsGridRef.current) return;
    const rect = reviewsGridRef.current.getBoundingClientRect();
    const x = e.pageX - rect.left;
    const y = e.pageY - rect.top;
    
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      return;
    }
    
    setIsDraggingReviews(true);
    setStartXReviews(x);
    setScrollLeftReviews(reviewsGridRef.current.scrollLeft);
  };

  const handleMouseUpReviews = () => {
    setIsDraggingReviews(false);
  };

  const handleMouseLeaveReviews = () => {
    setIsDraggingReviews(false);
  };

  const scrollFeatures = (direction: 'left' | 'right') => {
    if (!featuresGridRef.current) return;
    const scrollAmount = 400;
    const currentScroll = featuresGridRef.current.scrollLeft;
    const targetScroll = direction === 'left' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    featuresGridRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const scrollReviews = (direction: 'left' | 'right') => {
    if (!reviewsGridRef.current) return;
    const scrollAmount = 400;
    const currentScroll = reviewsGridRef.current.scrollLeft;
    const targetScroll = direction === 'left' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    reviewsGridRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleSidebarSubmit = async (e?: React.FormEvent) => {
    console.log('[LandingPageV2] handleSidebarSubmit вызван, sidebarMode:', sidebarMode);
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSidebarFormError(null);

    const trimmedEmail = sidebarFormData.email.trim();

    if (!trimmedEmail) {
      setSidebarFormError(t('auth.errors.emailRequired'));
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setSidebarFormError(t('auth.errors.invalidEmail'));
      return;
    }

    if (!sidebarFormData.password) {
      setSidebarFormError(t('auth.errors.passwordRequired'));
      return;
    }

    if (!validatePassword(sidebarFormData.password)) {
      setSidebarFormError(t('auth.errors.passwordTooShort'));
      return;
    }

    if (sidebarMode === 'register') {
      const phoneTrimmed = (sidebarFormData.phone || '').trim();
      if (!phoneTrimmed || !sidebarPhoneValid) {
        setSidebarFormError(t('auth.errors.phoneInvalid'));
        return;
      }


      if (!sidebarPolicyAccepted) {
        setSidebarFormError(t('auth.errors.termsNotAccepted'));
        return;
      }
    }

    const payload: AuthFormValues = {
      ...sidebarFormData,
      email: trimmedEmail,
    };

    try {
      if (sidebarMode === 'login') {
        console.log('[LandingPageV2] Вызываем handleLogin из handleSidebarSubmit');
        await handleLogin(payload);
      } else {
        console.log('[LandingPageV2] Вызываем handleRegister из handleSidebarSubmit');
        await handleRegister(payload);
      }
      setSidebarFormError(null);
      setSidebarFormData({ email: '', phone: '', password: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('[LandingPageV2] Ошибка в handleSidebarSubmit:', error);
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('Invalid email or password') || errorMessage.includes('Invalid credentials') || errorMessage.includes('UNAUTHORIZED')) {
        setSidebarFormError(t('auth.errors.invalidCredentials'));
      } else if (errorMessage.includes('Email already exists') || errorMessage.includes('email already')) {
        setSidebarFormError(t('auth.errors.emailAlreadyExists'));
      } else if (errorMessage.includes('Invalid email')) {
        setSidebarFormError(t('auth.errors.invalidEmail'));
      } else if (errorMessage.includes('Password too short')) {
        setSidebarFormError(t('auth.errors.passwordTooShort'));
      } else if (errorMessage.includes('Network error') || errorMessage.includes('NETWORK_ERROR')) {
        setSidebarFormError(t('auth.errors.networkError'));
      } else {
        setSidebarFormError(t('auth.errors.unknownError') || 'Произошла ошибка. Попробуйте снова.');
      }
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.heroSection} id="hero">
          <div className={styles.heroVideoWrapper}>
            <img
              className={styles.heroVideo}
              src={heroBackgroundImage}
              alt="Background"
            />
            <div 
              className={styles.heroVideoOverlay}
              style={{ 
                '--desktop-background': `url(${desktopBackgroundImage})`,
                '--tel-background': `url(${telBackgroundImage})`
              } as React.CSSProperties}
            >
              <div className={styles.container}>
                <div className={styles.heroNavContent}>
                  <div className={styles.logo}>
                    <img src={fullLogo} alt="BlockMind logo" className={styles.logoImage} />
                  </div>

                  <div className={styles.navLinks}>
                    {navLinks.map((link) => (
                      <a 
                        key={link.label} 
                        href={link.href}
                        onClick={(e) => {
                          if (link.href.startsWith('#')) {
                            e.preventDefault();
                            const element = document.querySelector(link.href);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }
                        }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>

                  <button
                    className={styles.desktopLoginButton}
                    onClick={() => handleOpenAuth('login')}
                    aria-label="Login"
                  >
                    {ctaSecondary}
                  </button>

                  <button
                    className={styles.mobileLoginButton}
                    onClick={() => handleOpenAuth('login')}
                    aria-label="Login"
                  >
                    {ctaSecondary}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={classNames(styles.container, styles.heroContainer)}>
            <div className={styles.heroContent}>
              <h1>
                {(() => {
                  const title = heroContent.title;
                  if (title.includes('Trading platform for smart investments')) {
                    return (
                      <>
                        Trading platform<span className={styles.mobileSpace}> </span><br className={styles.desktopBreak} />
                        for smart<span className={styles.mobileSpace}> </span><br className={styles.desktopBreak} />
                        investments
                      </>
                    );
                  }
                  // Для других языков разбиваем по " for "
                  const parts = title.split(' for ');
                  if (parts.length > 1) {
                    return (
                      <>
                        {parts[0]}<br />
                        for {parts.slice(1).join(' for ')}
                      </>
                    );
                  }
                  return title;
                })()}
              </h1>
              <p>{heroContent.subtitle}</p>
              <div className={styles.heroActions}>
                <button
                  className={classNames(styles.primaryButton, styles.largeButton)}
                  onClick={() => handleButtonClick('register')}
                >
                  {ctaPrimary}
                </button>
                <button
                  className={classNames(styles.secondaryButton, styles.largeButton)}
                  onClick={() => handleButtonClick('register')}
                >
                  {heroContent.demoCta}
                </button>
              </div>
              <div className={styles.trustIndicators}>
                <div className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>{getLocaleValue({ ru: 'Рейтинг 4.8 от реальных трейдеров', en: 'Rated 4.8 by real traders', default: 'Rated 4.8 by real traders' }, language)}</span>
                </div>
                <div className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{getLocaleValue({ ru: 'SSL шифрование и безопасные платежи', en: 'SSL encryption & secure payments', default: 'SSL encryption & secure payments' }, language)}</span>
                </div>
                <div className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>{getLocaleValue({ ru: '30+ индикаторов и умные сигналы', en: '30+ indicators & smart signals', default: '30+ indicators & smart signals' }, language)}</span>
                </div>
              </div>
              <div className={styles.heroNote}>{heroContent.note}</div>
            </div>
          </div>
        </section>

        <section className={styles.featuresSection} id="features">
          <div className={styles.container}>
            <h2>
              {getLocaleValue(
                {
                  ru: 'Возможности платформы',
                  en: 'Features of the platform',
                  default: 'Features of the platform',
                },
                language
              )}
            </h2>
            <div className={styles.sectionHeaderWithControls}>
              <p className={styles.sectionSubtitle}>
                {getLocaleValue(
                  {
                    ru: 'Мы постоянно улучшаем платформу, чтобы ваша торговля была комфортной и безопасной.',
                    en: 'We continuously improve the platform to make your trading comfortable and secure.',
                    default: 'We continuously improve the platform to make your trading comfortable and secure.',
                  },
                  language
                )}
              </p>
            </div>
            <div className={styles.featuresGrid}>
              {featureBlocks.map((feature) => (
                <div key={feature.title} className={styles.featureCard}>
                  <div className={styles.featureIcon}>
                    {iconMap[feature.icon] ? (
                      <img src={iconMap[feature.icon]} alt={feature.title} />
                    ) : (
                      <span className={styles.featureIconEmoji}>{feature.icon}</span>
                    )}
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => handleButtonClick('register')}
                  >
                    {feature.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.demoSection} id="demo">
          <div className={styles.container}>
            <div className={styles.demoCard}>
              <div className={styles.demoContent}>
                <h3>
                  {language === 'ru' ? (
                    <>
                      <span className={styles.demoTitleLight}>Демо-счёт</span>
                      <br />
                      <span className={styles.demoTitleBold}>на 50,000 $</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.demoTitleLight}>Demo account</span>
                      <br />
                      <span className={styles.demoTitleBold}>for 50,000 $</span>
                    </>
                  )}
                </h3>
                <p>
                  {language === 'ru' ? (
                    'Практикуйтесь без риска, используя все доступные функции платформы.'
                  ) : (
                    <>
                      Practice without any risk, using all the<br />
                      available features of the platform.
                    </>
                  )}
                </p>
                <div className={styles.demoActions}>
                  <button className={styles.primaryButton} onClick={() => handleButtonClick('register')}>
                    {ctaPrimary}
                  </button>
                </div>
              </div>
              <div className={styles.demoImage}>
                <img
                  src={demoTabImage}
                  alt="BlockMind demo trading"
                />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.capitalSection} id="capital">
          <div className={styles.container}>
            <div className={classNames(styles.capitalHeading, 'placeholder-surface')}>
              <h2>
                {getLocaleValue(
                  {
                    ru: 'Увеличивайте капитал на точных прогнозах',
                    en: 'Grow your capital with accurate predictions',
                    default: 'Grow your capital with accurate predictions',
                  },
                  language
                )}
              </h2>
              <p>
                {getLocaleValue(
                  {
                    ru: 'Определите, вырастет или снизится цена актива, и откройте сделку. Управляйте рисками и отслеживайте результат в одном окне.',
                    en: 'Decide whether the asset price will rise or fall and place a trade. Manage risk and track the outcome in one place.',
                    default: 'Decide whether the asset price will rise or fall and place a trade. Manage risk and track the outcome in one place.',
                  },
                  language
                )}
              </p>
            </div>
            <div className={styles.capitalGrid}>
              {capitalSteps.map((step) => (
                <div key={step.title} className={styles.capitalItem}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.reviewsSection} id="reviews">
          <div className={styles.container}>
            <h2>
              {getLocaleValue(
                {
                  ru: 'Что говорят трейдеры',
                  en: 'What people say about us',
                  default: 'What people say about us',
                },
                language
              )}
            </h2>
            <div className={styles.sectionHeaderWithControls}>
              <p className={styles.sectionSubtitle}>
                {getLocaleValue(
                  {
                    ru: 'Мы попросили клиентов оценить BlockMind по пятибалльной шкале.',
                    en: 'We asked our clients to rate BlockMind on a five-point scale.',
                    default: 'We asked our clients to rate BlockMind on a five-point scale.',
                  },
                  language
                )}
              </p>
            </div>
            <div className={styles.reviewsGrid}>
              {reviews.map((review) => (
                <article key={review.name} className={styles.reviewCard}>
                  <div className={styles.reviewAvatar}>
                    {avatarMap[review.name] ? (
                      <img src={avatarMap[review.name]} alt={review.name} className={styles.reviewAvatarImage} />
                    ) : (
                      review.name.charAt(0)
                    )}
                  </div>
                  <div className={styles.reviewHeader}>
                    <div>
                      <div className={styles.reviewName}>{review.name}</div>
                      <div className={styles.reviewMeta}>
                        <span>{review.date}</span>
                        <span>Profit: {review.amount}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.reviewStars} aria-label={`Rating ${review.rating} out of 5`}>
                    {renderStars(review.rating)}
                  </div>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.appSection} id="app">
          <div className={styles.container}>
            <div className={styles.paymentContent}>
              <h2 className={styles.paymentTitle}>{appContent.title}</h2>
              <p className={styles.paymentSubtitle}>{appContent.subtitle}</p>
              <div className={styles.paymentIcons}>
                <div className={styles.paymentIcon}>
                  <img src={methodVisa} alt="Visa" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodMaster} alt="Mastercard" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodBitcoin} alt="Bitcoin" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodEthereum} alt="Ethereum" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodLitecoin} alt="Litecoin" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodRipple} alt="Ripple" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodTether} alt="Tether" />
                </div>
                <div className={styles.paymentIcon}>
                  <img src={methodOpenBanking} alt="Open Banking" />
                </div>
                <div className={styles.paymentIconOther}>
                  {getLocaleValue(
                    {
                      ru: 'И другие',
                      en: 'And others',
                      default: 'And others',
                    },
                    language
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.faqSection} id="faq">
          <div className={styles.container}>
            <h2>
              {getLocaleValue(
                {
                  ru: 'Часто задаваемые вопросы',
                  en: 'Frequently asked questions',
                  default: 'Frequently asked questions',
                },
                language
              )}
            </h2>
            <p className={styles.sectionSubtitle}>
              {getLocaleValue(
                {
                  ru: 'Посмотрите ответы на самые популярные вопросы новых трейдеров.',
                  en: 'See answers to the most common questions new traders ask.',
                  default: 'See answers to the most common questions new traders ask.',
                },
                language
              )}
            </p>
            <div className={styles.faqList}>
              {faqItems.map((item) => (
                <details key={item.question} className={classNames(styles.faqItem, 'placeholder-surface')}>
                  <summary className={styles.faqSummary}>{item.question}</summary>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </details>
              ))}
            </div>
            <div className={styles.faqMore}>
              <span>
                {getLocaleValue(
                  {
                    ru: 'Остались вопросы?',
                    en: 'Still have a question?',
                    default: 'Still have a question?',
                  },
                  language
                )}
              </span>
              <a href="#" target="_blank" rel="noreferrer">
                {getLocaleValue(
                  {
                    ru: 'Связаться с нами',
                    en: 'Contact us',
                    default: 'Contact us',
                  },
                  language
                )}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <img src={fullLogo} alt="BlockMind logo" className={styles.footerLogoImage} />
              <div className={styles.footerLinks}>
                {footerLinkGroups.map((group) => (
                  <div key={group.title}>
                    {group.items.map((item) => (
                      <span key={item.label} className={styles.footerLinkItem}>
                        {item.external ? (
                          item.label === 'Демо-счёт' || item.label === 'Demo account' ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleButtonClick('register');
                              }}
                            >
                              {item.label}
                            </a>
                          ) : (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.label}
                            </a>
                          )
                        ) : item.label === 'FAQ' || item.label === 'Часто задаваемые вопросы' ? (
                          <a
                            href={item.href}
                            onClick={(e) => {
                              e.preventDefault();
                              const element = document.getElementById('faq');
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                          >
                            {item.label}
                          </a>
                        ) : item.label === 'Company' || item.label === 'Компания' ? (
                          <a
                            href={item.href}
                            onClick={(e) => {
                              e.preventDefault();
                            }}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link 
                            to={item.href}
                            onClick={(e) => {
                              if (item.label === 'Демо-счёт' || item.label === 'Demo account') {
                                e.preventDefault();
                                handleButtonClick('register');
                              } else if (item.href.startsWith('#')) {
                                e.preventDefault();
                                const element = document.querySelector(item.href);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>{footerCopy.legal}</p>
            <p>{footerCopy.availability}</p>
            <p>{footerCopy.risk}</p>
            <p>{footerCopy.ownership}</p>
            <p>{footerCopy.copy}</p>
          </div>
        </div>
      </footer>

      {!user && (
        <aside ref={sidebarRef} className={classNames(styles.authSidebar, { [styles.blink]: sidebarBlink })}>
          <div className={styles.sidebarHeader}>
            <button
              type="button"
              className={classNames(styles.sidebarModeButton, { [styles.active]: sidebarMode === 'register' })}
              onClick={() => {
                setSidebarMode('register');
                setSidebarFormError(null);
              }}
            >
              {t('landing.createAccount')}
            </button>
            <button
              type="button"
              className={classNames(styles.sidebarModeButton, { [styles.active]: sidebarMode === 'login' })}
              onClick={() => {
                setSidebarMode('login');
                setSidebarFormError(null);
              }}
            >
              {t('auth.loginTitle')}
            </button>
          </div>

          {sidebarFormError && (
            <div className={styles.sidebarError}>{sidebarFormError}</div>
          )}

          {authError && (
            <div className={styles.sidebarError}>{authError}</div>
          )}

          <form 
            className={styles.sidebarForm} 
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSidebarSubmit();
              }
            }}
          >
            <div className={styles.sidebarFormGroup}>
              <label>{t('auth.email')}</label>
              <input
                type="email"
                value={sidebarFormData.email}
                onChange={(e) => {
                  setSidebarFormData(prev => ({ ...prev, email: e.target.value }));
                  setSidebarFormError(null);
                }}
                placeholder={t('profile.enterEmail')}
                required
              />
            </div>

            {sidebarMode === 'register' && (
              <div className={styles.sidebarFormGroup}>
                <label>{t('landing.phone')}</label>
                <PhoneInput
                  value={sidebarFormData.phone ?? ''}
                  onChange={(phone) => {
                    setSidebarFormData(prev => ({ ...prev, phone: phone ?? '' }));
                    setSidebarFormError(null);
                  }}
                  onValidationChange={(isValid) => {
                    setSidebarPhoneValid(isValid);
                  }}
                  placeholder={t('profile.enterPhone')}
                  required
                />
              </div>
            )}

            <div className={styles.sidebarFormGroup}>
              <label>{t('auth.password')}</label>
              <div className={styles.sidebarPasswordWrapper}>
                <input
                  type={sidebarShowPassword ? 'text' : 'password'}
                  value={sidebarFormData.password}
                  onChange={(e) => {
                    setSidebarFormData(prev => ({ ...prev, password: e.target.value }));
                    setSidebarFormError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setSidebarShowPassword(prev => !prev)}
                  className={styles.sidebarVisibilityToggle}
                  aria-label={sidebarShowPassword ? 'Hide password' : 'Show password'}
                >
                  {sidebarShowPassword ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {sidebarMode === 'register' && (
              <>
                <div className={styles.sidebarCheckbox}>
                  <label>
                    <input
                      type="checkbox"
                      checked={sidebarPolicyAccepted}
                      onChange={(e) => {
                        setSidebarPolicyAccepted(e.target.checked);
                        setSidebarFormError(null);
                      }}
                    />
                    <span>
                      {t('landing.acceptPolicy')}{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer">
                        {t('landing.termsAndConditions')}
                      </a>
                      {' '}{t('landing.and')}{' '}
                      <a href="/compliance" target="_blank" rel="noopener noreferrer">
                        {t('landing.amlKycPolicy')}
                      </a>
                    </span>
                  </label>
                </div>
              </>
            )}

            <button 
              type="button" 
              className={styles.sidebarSubmitBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Вызываем handleSidebarSubmit напрямую, без события формы
                handleSidebarSubmit();
              }}
            >
              {sidebarMode === 'login' ? t('auth.loginButton') : t('landing.createAccount')}
            </button>
          </form>

          <div className={styles.sidebarDivider}>
            <span>
              {getLocaleValue(
                {
                  ru: 'или',
                  en: 'or',
                  default: 'or',
                },
                language
              )}
            </span>
          </div>

          <button
            type="button"
            className={styles.sidebarGoogleBtn}
            onClick={async () => {
              try {
                let partnerReferral: { partnerId: number; referralSlug: string } | undefined;
                try {
                  const partnerReferralStr = localStorage.getItem('partner_referral');
                  if (partnerReferralStr) {
                    partnerReferral = JSON.parse(partnerReferralStr);
                  }
                } catch (e) {

                }
                
                const result = await dispatch(initiateGoogleAuth({ refId, partnerReferral, state: sidebarMode })).unwrap();
                if (result.authUrl) {
                  window.location.href = result.authUrl;
                } else if (result.redirectUrl) {
                  window.location.href = result.redirectUrl;
                } else {

                  setSidebarFormError('Ошибка: не получен URL для авторизации');
                }
              } catch (error: any) {

                setSidebarFormError(error?.message || 'Ошибка авторизации через Google');
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>
              {sidebarMode === 'login' 
                ? getLocaleValue(
                    {
                      ru: 'Вход с помощью Google',
                      en: 'Sign in with Google',
                      default: 'Sign in with Google',
                    },
                    language
                  )
                : getLocaleValue(
                    {
                      ru: 'Регистрация с помощью Google',
                      en: 'Sign up with Google',
                      default: 'Sign up with Google',
                    },
                    language
                  )
              }
            </span>
          </button>
        </aside>
      )}

      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onClose={handleCloseAuth}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        onGoogleAuth={handleGoogleAuthModal}
        error={authError}
      />

    </div>
  );
};

export default LandingPageV2;
