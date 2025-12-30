import React, { useEffect, useMemo, useState, useRef } from 'react';
import styles from './AuthModal.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';
import { PhoneInput } from '@/src/shared/ui/PhoneInput';

export interface AuthFormValues {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface AuthModalProps {
  open: boolean;
  mode: 'login' | 'register';
  onClose: () => void;
  onLogin: (credentials: AuthFormValues) => void;
  onRegister: (credentials: AuthFormValues) => void;
  onSwitchMode: () => void;
  onGoogleAuth?: () => void;
  error?: string | null;
}

const AuthModal: React.FC<AuthModalProps> = ({
  open,
  mode,
  onClose,
  onLogin,
  onRegister,
  onSwitchMode,
  onGoogleAuth,
  error,
}) => {
  const { t } = useLanguage();
  const isLogin = mode === 'login';
  const initialFormData = useMemo<AuthFormValues>(
    () => ({
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    }),
    []
  );
  const [formData, setFormData] = useState<AuthFormValues>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [phoneValid, setPhoneValid] = useState(true);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [blurredFields, setBlurredFields] = useState<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement>(null);

  const getText = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setFormError(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setPolicyAccepted(false);
      setTouchedFields(new Set());
      setBlurredFields(new Set());
      // Блокируем скролл body когда модальное окно открыто
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      // Разблокируем скролл когда модальное окно закрыто
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      // Принудительно скрываем overlay
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
    }
    
    // Cleanup при размонтировании
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [open, mode, initialFormData]);

  // Валидация email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Валидация пароля
  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    // Помечаем все поля как "тронутые" для показа ошибок
    setTouchedFields(new Set(['email', 'password', 'phone', 'confirmPassword']));

    const trimmedEmail = formData.email.trim();

    // Валидация email
    if (!trimmedEmail) {
      setFormError(t('auth.errors.emailRequired'));
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setFormError(t('auth.errors.invalidEmail'));
      return;
    }

    // Валидация пароля
    if (!formData.password) {
      setFormError(t('auth.errors.passwordRequired'));
      return;
    }

    if (!validatePassword(formData.password)) {
      setFormError(t('auth.errors.passwordTooShort'));
      return;
    }

    // Валидация для регистрации
    if (!isLogin) {
      // Валидация телефона
      const phoneTrimmed = (formData.phone || '').trim();
      if (!phoneTrimmed || !phoneValid) {
        setFormError(t('auth.errors.phoneInvalid'));
        return;
      }

      // Валидация подтверждения пароля
      if (!formData.confirmPassword) {
        setFormError(t('auth.errors.passwordRequired'));
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setFormError(t('landing.passwordsMustMatch'));
        return;
      }

      // Валидация политики
      if (!policyAccepted) {
        setFormError(t('auth.errors.termsNotAccepted'));
        return;
      }
    }

    const payload: AuthFormValues = {
      ...formData,
      email: trimmedEmail,
    };

    if (isLogin) {
      onLogin(payload);
    } else {
      onRegister(payload);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fieldName = e.target.name;
    setFormData(prev => ({
      ...prev,
      [fieldName]: e.target.value || ''
    }));
    setFormError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const fieldName = e.target.name;
    setTouchedFields(prev => new Set(prev).add(fieldName));
    setBlurredFields(prev => new Set(prev).add(fieldName));
  };

  const handleModeSwitch = (targetMode: 'login' | 'register') => {
    if (targetMode !== mode) {
      onSwitchMode();
    }
  };

  if (!open) {
    // Убеждаемся, что overflow разблокирован при закрытии
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    return null;
  }

  return (
    <div 
      ref={overlayRef}
      className={styles.authModalOverlay} 
      onClick={onClose} 
      style={{ display: open ? 'flex' : 'none' }}
    >
      <div className={styles.authModal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>×</button>

        <div className={styles.modalHeader}>
          <span className={styles.badge}>
            {isLogin ? t('auth.loginTitle') : t('landing.registration')}
          </span>
          <h2 className={styles.modalTitle}>
            {isLogin ? getText('landing.accessPlatform', 'Вход в торговый кабинет') : getText('landing.createAccount', 'Создайте аккаунт за 60 секунд')}
          </h2>
          <p className={styles.modalSubtitle}>
            {isLogin
              ? getText('landing.advancedAITrading', 'Доступ к платформе мгновенно и без лишних шагов')
              : getText('landing.joinThousands', 'Присоединяйтесь к тысячам трейдеров и начните зарабатывать уже сегодня')}
          </p>
        </div>

        <div className={styles.modeSwitcher}>
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`${styles.modeButton} ${isLogin ? styles.active : ''}`}
          >
            {t('auth.loginTitle')}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`${styles.modeButton} ${!isLogin ? styles.active : ''}`}
          >
            {t('landing.createAccount')}
          </button>
        </div>

        {(error || formError) && (
          <div className={styles.errorMessage}>
            {formError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="auth-email">{t('auth.email')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>@</span>
              <input
                id="auth-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t('profile.enterEmail')}
                autoComplete="email"
                required
              />
            </div>
            {blurredFields.has('email') && formData.email && !validateEmail(formData.email) && (
              <div className={styles.fieldError}>{t('auth.errors.invalidEmail')}</div>
            )}
          </div>

          {!isLogin && (
            <div className={styles.formGroup}>
              <label>{t('landing.phone')}</label>
              <PhoneInput
                className={styles.phoneInput}
                value={formData.phone ?? ''}
                onChange={(phone) => {
                  setFormData(prev => ({ ...prev, phone: phone ?? '' }));
                  setFormError(null);
                }}
                onValidationChange={(isValid) => {
                  setPhoneValid(isValid);
                }}
                placeholder={t('profile.enterPhone')}
                required
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label>{t('auth.password')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>*</span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                className={styles.visibilityToggle}
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {blurredFields.has('password') && formData.password && !validatePassword(formData.password) && (
              <div className={styles.fieldError}>{t('auth.errors.passwordTooShort')}</div>
            )}
          </div>

          {!isLogin && (
            <div className={styles.formGroup}>
              <label>
                {getText(
                  'landing.repeatPassword',
                  getText('auth.repeatPassword', 'Повторите пароль')
                )}
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>*</span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.visibilityToggle}
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  aria-label={showConfirmPassword ? 'Hide password repeat' : 'Show password repeat'}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              {blurredFields.has('confirmPassword') && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <div className={styles.fieldError}>{t('landing.passwordsMustMatch')}</div>
              )}
            </div>
          )}

          {!isLogin && (
            <div className={styles.policyCheckbox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => {
                    setPolicyAccepted(e.target.checked);
                    setFormError(null);
                  }}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxText}>
                  {getText(
                    'landing.acceptPolicy',
                    'Я принимаю'
                  )}{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.policyLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getText('landing.termsAndConditions', 'Условия использования')}
                  </a>
                  {' '}{getText('landing.and', 'и')}{' '}
                  <a
                    href="/compliance"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.policyLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getText('landing.amlKycPolicy', 'Политику AML/KYC')}
                  </a>
                </span>
              </label>
            </div>
          )}

          <button type="submit" className={styles.submitBtn}>
            {isLogin ? t('auth.loginButton') : t('landing.createAccount')}
          </button>
        </form>

        {onGoogleAuth && (
          <div className={styles.googleAuthSection}>
            <div className={styles.divider}>
              <span>or</span>
            </div>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={onGoogleAuth}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.6 10.232c0-.68-.06-1.34-.17-1.98H10v3.75h5.38c-.23 1.18-.89 2.17-1.89 2.84v2.45h3.16c1.85-1.7 2.92-4.2 2.92-7.06z" fill="#4285F4" />
                <path d="M10 20c2.7 0 4.96-.89 6.61-2.42l-3.16-2.45c-.88.6-2.01.95-3.45.95-2.65 0-4.9-1.78-5.7-4.18H.9v2.53C2.5 18.08 6.05 20 10 20z" fill="#34A853" />
                <path d="M4.3 11.98c-.2-.6-.31-1.24-.31-1.98s.11-1.38.31-1.98V5.5H.9C.33 6.64 0 8.25 0 10s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC04" />
                <path d="M10 3.98c1.47 0 2.78.5 3.81 1.49l2.81-2.81C14.96.89 12.7 0 10 0 6.05 0 2.5 1.92.9 5.5l3.4 2.68c.8-2.4 3.05-4.18 5.7-4.18z" fill="#EA4335" />
              </svg>
              {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
            </button>
          </div>
        )}

        <div className={styles.termsHint}>
          {isLogin
            ? 'BlockMind is a comprehensive trading platform that offers fast execution, accurate market charts, and access to a wide range of assets — built for traders of any experience level.'
            : getText('landing.accessPlatform', 'Создавая аккаунт, вы соглашаетесь с условиями платформы')}
        </div>

        <div className={styles.authSwitch}>
          {isLogin ? (
            <p>
              {t('landing.newToBlockMind')}{' '}
              <button type="button" onClick={onSwitchMode} className={styles.switchBtn}>
                {t('landing.registerHere')}
              </button>
            </p>
          ) : (
            <p>
              {t('landing.alreadyHaveAccount')}{' '}
              <button type="button" onClick={onSwitchMode} className={styles.switchBtn}>
                {t('landing.loginHere')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;