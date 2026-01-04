import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import "./ProfilePage.css";
import { updateUserProfile, fetchProfile, setUser, clearProfile } from "@src/entities/user/model/slice.ts";
import { selectProfile, selectProfileError, selectProfileLoading } from "@src/entities/user/model/selectors.ts";
import { useLanguage } from "@src/app/providers/useLanguage.ts";
import { useAnimatedNumber } from "@src/shared/hooks/useAnimatedNumber";
import { KYCVerificationForm } from "@src/features/kyc-verification/ui/KYCVerificationForm";
import { LanguageDropdown } from "@src/shared/ui/LanguageDropdown";
import { authApi, userApi } from "@src/shared/api";
import userIcon from "@src/assets/icons/avatar.svg";
import { ensureHttps } from "@src/shared/lib/ensureHttps";
import { generateReferralHash } from "@src/shared/lib/referralHashUtils";
import { formatTraderCodeForDisplay } from "@src/shared/lib/traderCodeUtils";
import { formatCurrency, CURRENCY_INFO, SupportedCurrency, getCurrencyInfo } from "@src/shared/lib/currency/currencyUtils";
import { getLevelInfo } from "@src/shared/ui/BalanceLevelBadge/BalanceLevelBadge";
import { EditableField } from "./components/EditableField";
import { CurrencyField } from "./components/CurrencyField";
import { CountryField } from "./components/CountryField";
import { InfoCard } from "./components/InfoCard";
import { SidebarProvider, useSidebar } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { useMediaQuery } from '@src/shared/lib/hooks/useMediaQuery';

export function ProfilePage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector(selectProfile);
    const loading = useAppSelector(selectProfileLoading);
    const error = useAppSelector(selectProfileError);
    const { t, language } = useLanguage();
    const isMobile = useMediaQuery('(max-width: 1024px)');
    const hasLoadedRef = useRef(false);
    const lastLoadTimeRef = useRef<number>(0);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const isUpdatingCurrencyRef = useRef(false);
    const LOAD_THROTTLE = 5000; // Минимум 5 секунд между загрузками
    const TAB_STORAGE_KEY = 'profile.activeTab';

    const [editData, setEditData] = useState({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        login: "",
        currency: "USD" as SupportedCurrency,
        country: "",
        wallets: {
            usdt: "",
            btc: "",
            ltc: "",
            eth: ""
        }
    });
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'account' | 'wallets' | 'kyc' | 'referrals'>(() => {
        if (typeof window === 'undefined') {
            return 'account';
        }
        const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
        if (stored === 'wallets' || stored === 'kyc' || stored === 'account' || stored === 'referrals') {
            return stored as 'account' | 'wallets' | 'kyc' | 'referrals';
        }
        return 'account';
    });
    const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
    const [fieldSaving, setFieldSaving] = useState<string | null>(null);
    
    // Password recovery and change states
    const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
    const [passwordRecoveryLoading, setPasswordRecoveryLoading] = useState(false);
    const [passwordChangeData, setPasswordChangeData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState<{ [key: string]: string }>({});
    
    // Referral program state
    const [referralLinkCopied, setReferralLinkCopied] = useState(false);
    
    // Islamic halal account state
    const ISLAMIC_HALAL_STORAGE_KEY = 'islamicHalalEnabled';
    const [islamicHalalEnabled, setIslamicHalalEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        const stored = localStorage.getItem(ISLAMIC_HALAL_STORAGE_KEY);
        return stored === 'true';
    });
    const [islamicHalalLoading, setIslamicHalalLoading] = useState(false);
    
    // Delete account state
    const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
    const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Current IP address state
    const [currentIpAddress, setCurrentIpAddress] = useState<string | null>(null);

    const balanceDisplay = useAnimatedNumber(Number(user?.balance || 0));
    const balanceProfitDisplay = useAnimatedNumber(Number(user?.balance_profit || 0));
    const totalRefEarningsDisplay = useAnimatedNumber(Number(user?.total_ref_earnings || 0));
    const refBalanceDisplay = useAnimatedNumber(Number(user?.ref_balance || 0));
    const coinsDisplay = useAnimatedNumber(Number(user?.coins || 0));
    const levelInfo = useMemo(() => getLevelInfo(Number(user?.balance || 0)), [user?.balance]);
    const avatarUrl = ensureHttps(user?.avatarUrl || user?.avatar_url || null);
    const userCurrency = useMemo(() => user?.currency || 'USD', [user?.currency]);

    useEffect(() => {
        const loadProfile = async () => {
            if (user) {
                hasLoadedRef.current = true;
                return;
            }

            const now = Date.now();
            if (now - lastLoadTimeRef.current < LOAD_THROTTLE && hasLoadedRef.current) {
                return;
            }

            if (isUpdatingCurrencyRef.current) {
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                return;
            }

            try {
                lastLoadTimeRef.current = now;
                hasLoadedRef.current = true;
                await dispatch(fetchProfile()).unwrap();
            } catch (err) {
                if (err instanceof Error && (
                    err.message.includes('SESSION_EXPIRED') ||
                    err.message.includes('NETWORK_ERROR')
                )) {
                    hasLoadedRef.current = true;
                    return;
                }
                hasLoadedRef.current = false;
            }
        };

        loadProfile();
    }, [dispatch, user]);

    const loadingRef = useRef(loading);
    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const timeSinceLastLoad = now - lastLoadTimeRef.current;
                
                if (timeSinceLastLoad > 30000) {
                    const token = localStorage.getItem('token');
                    if (token && !loadingRef.current) {
                        const scheduleUpdate = (callback: () => void) => {
                            if ('requestIdleCallback' in window) {
                                requestIdleCallback(callback, { timeout: 2000 });
                            } else {
                                setTimeout(callback, 100);
                            }
                        };
                        
                        scheduleUpdate(() => {
                            if (!loadingRef.current && token === localStorage.getItem('token')) {
                                lastLoadTimeRef.current = Date.now();
                                dispatch(fetchProfile()).catch((err) => {
                                    if (err instanceof Error && !err.message.includes('SESSION_EXPIRED') && 
                                        !err.message.includes('NETWORK_ERROR')) {
                                        console.error('Ошибка загрузки профиля:', err);
                                    }
                                });
                            }
                        });
                    }
                }
            }
        };

        const handleFocus = () => {
            const now = Date.now();
            const timeSinceLastLoad = now - lastLoadTimeRef.current;
            
            if (timeSinceLastLoad > 30000) {
                const token = localStorage.getItem('token');
                if (token && !loadingRef.current) {
                    const scheduleUpdate = (callback: () => void) => {
                        if ('requestIdleCallback' in window) {
                            requestIdleCallback(callback, { timeout: 2000 });
                        } else {
                            setTimeout(callback, 100);
                        }
                    };
                    
                    scheduleUpdate(() => {
                        if (!loadingRef.current && token === localStorage.getItem('token')) {
                            lastLoadTimeRef.current = Date.now();
                            dispatch(fetchProfile()).catch((err) => {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                // Игнорируем ошибки, связанные с удаленным аккаунтом или истекшей сессией
                                if (!errorMessage.includes('SESSION_EXPIRED') && 
                                    !errorMessage.includes('NETWORK_ERROR') &&
                                    !errorMessage.includes('ACCOUNT_DELETED') &&
                                    !errorMessage.includes('500') &&
                                    !errorMessage.includes('Internal Server Error')) {
                                    console.error('Ошибка загрузки профиля:', err);
                                }
                                // Если аккаунт удален, очищаем профиль и редиректим на лендинг
                                // (это уже обработано в fetchProfile, но на всякий случай проверяем здесь тоже)
                                if (errorMessage.includes('ACCOUNT_DELETED')) {
                                    dispatch(clearProfile());
                                    localStorage.removeItem('token');
                                    localStorage.removeItem('refresh_token');
                                    if (window.location.pathname !== '/') {
                                        window.location.href = '/';
                                    }
                                }
                            });
                        }
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [dispatch]);

    // Предыдущие значения для сравнения
    const prevUserRef = useRef(user);
    const lastCurrencyUpdateRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (user) {
            // Проверяем, действительно ли изменились данные пользователя
            const prevUser = prevUserRef.current;
            const userChanged = !prevUser || 
                prevUser.firstname !== user.firstname ||
                prevUser.lastname !== user.lastname ||
                prevUser.email !== user.email ||
                prevUser.phone !== user.phone ||
                prevUser.login !== user.login ||
                prevUser.currency !== user.currency ||
                (user as any)?.country !== (prevUser as any)?.country ||
                (user as any)?.kyc_country !== (prevUser as any)?.kyc_country ||
                JSON.stringify(prevUser.wallets) !== JSON.stringify(user.wallets);
            
            const newCurrency = (user.currency as SupportedCurrency) || "USD";
            
            // Не обновляем editData.currency, если идет обновление валюты
            if (isUpdatingCurrencyRef.current) {
                // Обновляем только другие поля, но не валюту, если она не изменилась в user
                if (userChanged && (!prevUser || prevUser.currency === newCurrency)) {
                    const wallets = typeof user.wallets === 'string' ? JSON.parse(user.wallets) : user.wallets;
                    const userCountry = (user as any)?.country || (user as any)?.kyc_country || "";
                    setEditData(prev => ({
                        ...prev,
                        firstname: user.firstname || "",
                        lastname: user.lastname || "",
                        email: user.email || "",
                        phone: user.phone || "",
                        login: user.login || "",
                        country: userCountry,
                        wallets: wallets || { usdt: "", btc: "", ltc: "", eth: "" }
                    }));
                }
                prevUserRef.current = user;
                return;
            }
            
            // Не обновляем editData.currency, если мы только что обновили валюту и она совпадает с текущей в editData
            if (userChanged && prevUser && prevUser.currency !== user.currency) {
                // Валюта изменилась в user
                if (lastCurrencyUpdateRef.current === newCurrency && editData.currency === newCurrency) {
                    // Обновляем только другие поля, но не валюту
                    const wallets = typeof user.wallets === 'string' ? JSON.parse(user.wallets) : user.wallets;
                    const userCountry = (user as any)?.country || (user as any)?.kyc_country || "";
                    setEditData(prev => ({
                        ...prev,
                        firstname: user.firstname || "",
                        lastname: user.lastname || "",
                        email: user.email || "",
                        phone: user.phone || "",
                        login: user.login || "",
                        country: userCountry,
                        wallets: wallets || { usdt: "", btc: "", ltc: "", eth: "" }
                    }));
                    prevUserRef.current = user;
                    return;
                }
            }
            
            if (userChanged) {
                const wallets = typeof user.wallets === 'string' ? JSON.parse(user.wallets) : user.wallets;
                const oldCurrency = editData.currency;
                const userCountry = (user as any)?.country || (user as any)?.kyc_country || "";
                
                setEditData({
                    firstname: user.firstname || "",
                    lastname: user.lastname || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    login: user.login || "",
                    currency: newCurrency,
                    country: userCountry,
                    wallets: wallets || { usdt: "", btc: "", ltc: "", eth: "" }
                });
                
                // Логируем изменение валюты в профиле
                if (oldCurrency !== newCurrency) {
                } else {
                }
            }
            
            // Обновляем halal только если он изменился и мы не в процессе загрузки
            const halalValue = user.is_islamic_halal || false;
            if (halalValue !== islamicHalalEnabled && !islamicHalalLoading) {
                setIslamicHalalEnabled(halalValue);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(ISLAMIC_HALAL_STORAGE_KEY, String(halalValue));
                    // Dispatch custom event to notify other components (like TradingHeader)
                    window.dispatchEvent(new CustomEvent('islamicHalalChange'));
                }
            }
            
            prevUserRef.current = user;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Получаем текущий IP адрес клиента
    useEffect(() => {
        const fetchCurrentIp = async () => {
            try {
                // Используем переменную окружения или fallback на ipify.org
                const ipApiUrl = import.meta.env.VITE_IP_API_URL || 'https://api.ipify.org?format=json';
                const response = await fetch(ipApiUrl);
                const data = await response.json();
                if (data.ip) {
                    setCurrentIpAddress(data.ip);
                }
            } catch (error) {

            }
        };

        fetchCurrentIp();
    }, []);

    // Разрешаем скролл для страницы профиля
    useEffect(() => {
        const pageContent = document.querySelector('.page-content');
        if (pageContent) {
            pageContent.classList.add('page-content--scrollable');
            return () => {
                pageContent.classList.remove('page-content--scrollable');
            };
        }
    }, []);

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setAvatarError(null);

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setAvatarError(t('profile.avatarTooLarge'));
            event.target.value = '';
            return;
        }

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setAvatarError(t('profile.avatarInvalidType'));
            event.target.value = '';
            return;
        }

        setAvatarUploading(true);

        try {
            const updatedUser = await userApi.uploadAvatar(file);
            dispatch(setUser(updatedUser));
            setNotification({ type: 'success', message: t('profile.updateSuccess') });
        } catch (error) {

            const errorMessage = error instanceof Error ? error.message || '' : '';
            const normalized = errorMessage.toLowerCase();

            if (normalized.includes('format') || normalized.includes('формат') || normalized.includes('type') || normalized.includes('тип')) {
                setAvatarError(t('profile.avatarInvalidType'));
            } else if (normalized.includes('5mb') || normalized.includes('5 мб') || normalized.includes('size') || normalized.includes('размер')) {
                setAvatarError(t('profile.avatarTooLarge'));
            } else {
                setAvatarError(errorMessage || t('profile.updateError'));
            }
        } finally {
            setAvatarUploading(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleSendVerificationEmail = async () => {
        if (!user?.email) {
            setNotification({
                type: 'error',
                message: t('profile.emailAddHint')
            });
            return;
        }

        try {
            setEmailVerificationLoading(true);
            const response = await authApi.requestEmailVerification();
            setNotification({
                type: 'success',
                message: response?.message || t('profile.verificationEmailSent')
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            let translated = message || t('profile.verificationEmailError');

            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('указан') || lowerMessage.includes('specified') || lowerMessage.includes('add') || lowerMessage.includes('добав')) {
                translated = t('profile.emailAddHint');
            }
            if (lowerMessage.includes('уже подтвержден') || lowerMessage.includes('already verified') || lowerMessage.includes('already confirmed')) {
                translated = t('profile.emailAlreadyVerified');
            }

            setNotification({
                type: 'error',
                message: translated
            });
        } finally {
            setEmailVerificationLoading(false);
        }
    };

    const handlePasswordRecovery = async () => {
        if (!passwordRecoveryEmail) {
            setNotification({
                type: 'error',
                message: t('profile.enterEmail')
            });
            return;
        }

        try {
            setPasswordRecoveryLoading(true);
            await authApi.requestPasswordReset(passwordRecoveryEmail);
            setNotification({
                type: 'success',
                message: t('profile.passwordRecoverySent')
            });
            setPasswordRecoveryEmail('');
        } catch (error: any) {
            setNotification({
                type: 'error',
                message: error?.message || t('profile.passwordRecoveryError')
            });
        } finally {
            setPasswordRecoveryLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        setPasswordErrors({});

        if (!passwordChangeData.oldPassword) {
            setPasswordErrors({ oldPassword: t('profile.enterOldPassword') });
            return;
        }

        if (!passwordChangeData.newPassword) {
            setPasswordErrors({ newPassword: t('profile.enterNewPassword') });
            return;
        }

        if (passwordChangeData.newPassword.length < 6) {
            setPasswordErrors({ newPassword: t('profile.passwordTooShort') });
            return;
        }

        if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
            setPasswordErrors({ confirmPassword: t('profile.passwordsDoNotMatch') });
            return;
        }

        try {
            setPasswordChangeLoading(true);
            // Моковый запрос - в реальности здесь будет API вызов
            await new Promise(resolve => setTimeout(resolve, 1500));
            setNotification({
                type: 'success',
                message: t('profile.passwordChanged')
            });
            setPasswordChangeData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('неверный') || lowerMessage.includes('invalid') || lowerMessage.includes('incorrect') || lowerMessage.includes('wrong')) {
                setPasswordErrors({ oldPassword: t('profile.invalidOldPassword') });
            } else {
                setNotification({
                    type: 'error',
                    message: t('profile.passwordChangeError')
                });
            }
        } finally {
            setPasswordChangeLoading(false);
        }
    };

    const getWalletsFromUser = () => {
        if (!user?.wallets) {
            return { usdt: "", btc: "", ltc: "", eth: "" };
        }
        const parsed = typeof user.wallets === 'string' ? JSON.parse(user.wallets) : user.wallets;
        return {
            usdt: parsed?.usdt || "",
            btc: parsed?.btc || "",
            ltc: parsed?.ltc || "",
            eth: parsed?.eth || ""
        };
    };

    const resetFieldValue = (fieldKey: string) => {
        setEditData((prev) => {
            if (fieldKey.startsWith('wallets.')) {
                const coin = fieldKey.split('.')[1] as keyof typeof prev.wallets;
                const wallets = getWalletsFromUser();
                return {
                    ...prev,
                    wallets: {
                        ...prev.wallets,
                        [coin]: wallets[coin] || ""
                    }
                };
            }

            if (fieldKey === 'currency') {
                return {
                    ...prev,
                    [fieldKey]: (user as any)?.[fieldKey] || "USD"
                };
            }
            if (fieldKey === 'country') {
                const userCountry = (user as any)?.country || (user as any)?.kyc_country || "";
                return {
                    ...prev,
                    [fieldKey]: userCountry
                };
            }
            return {
                ...prev,
                [fieldKey]: (user as any)?.[fieldKey] || ""
            };
        });
    };

    const startEditing = (fieldKey: string) => {
        setEditingFields((prev) => ({ ...prev, [fieldKey]: true }));
        setFormErrors((prev) => {
            if (!prev[fieldKey]) return prev;
            const updated = { ...prev };
            delete updated[fieldKey];
            return updated;
        });
    };

    const cancelEditing = (fieldKey: string) => {
        if (fieldKey === 'currency') {
            isUpdatingCurrencyRef.current = false;
            lastCurrencyUpdateRef.current = null;
        }
        resetFieldValue(fieldKey);
        setEditingFields((prev) => ({ ...prev, [fieldKey]: false }));
    };

    const handleFieldChange = (fieldKey: string, value: string) => {
        // Для валюты устанавливаем флаг обновления сразу при изменении
        if (fieldKey === 'currency') {
            isUpdatingCurrencyRef.current = true;
            lastCurrencyUpdateRef.current = value;
        }
        
        setEditData((prev) => {
            if (fieldKey.startsWith('wallets.')) {
                const coin = fieldKey.split('.')[1] as keyof typeof prev.wallets;
                return {
                    ...prev,
                wallets: {
                        ...prev.wallets,
                        [coin]: value
                    }
                };
            }

            return {
                ...prev,
                [fieldKey]: value
            };
        });
    };

    const buildProfileUpdatePayload = (fieldKey: string, value?: string) => {
        if (fieldKey.startsWith('wallets.')) {
            return {
                wallets: {
                    ...editData.wallets
                }
            };
        }

        if (['firstname', 'lastname', 'phone', 'login', 'currency', 'country'].includes(fieldKey)) {
            // Используем переданное значение или текущее из editData
            const fieldValue = value !== undefined ? value : (editData as any)[fieldKey];
            return {
                [fieldKey]: fieldValue
            };
        }

        return null;
    };

    const handleFieldSubmit = async (fieldKey: string, value?: string) => {
        if (!user) return;

        const payload = buildProfileUpdatePayload(fieldKey, value);
        if (!payload) {
            setEditingFields((prev) => ({ ...prev, [fieldKey]: false }));
            return;
        }

        // Логирование для Chart Debug Logs
        if (fieldKey === 'currency') {
            const oldCurrency = user.currency || 'USD';
            const newCurrency = (payload as any).currency || 'USD';
            const balance = user.balance || 0;
        }

        try {
            setFieldSaving(fieldKey);
            if (fieldKey === 'currency') {
                isUpdatingCurrencyRef.current = true;
            }
            const updatedUser = await dispatch(updateUserProfile({ profileData: payload })).unwrap();
            
            // Логирование после обновления валюты
            if (fieldKey === 'currency' && updatedUser) {
                const newCurrency = updatedUser.currency || 'USD';
                const balance = updatedUser.balance || 0;
                // Сохраняем валюту, которую мы только что обновили
                lastCurrencyUpdateRef.current = newCurrency;
                // Сбрасываем флаг через небольшую задержку, чтобы избежать конфликтов
                setTimeout(() => {
                    isUpdatingCurrencyRef.current = false;
                    // Очищаем флаг последнего обновления через 2 секунды
                    setTimeout(() => {
                        lastCurrencyUpdateRef.current = null;
                    }, 2000);
                }, 1000);
            }
            
            setNotification({ type: 'success', message: t('profile.updateSuccess') });
            setEditingFields((prev) => ({ ...prev, [fieldKey]: false }));
            setFormErrors((prev) => {
                if (!prev[fieldKey]) return prev;
                const updated = { ...prev };
                delete updated[fieldKey];
                return updated;
            });
        } catch (err: any) {
            if (fieldKey === 'currency') {
                isUpdatingCurrencyRef.current = false;
            }
            const errorsMap: { [key: string]: string } = {};

            if (err?.errors && Array.isArray(err.errors)) {
                err.errors.forEach((e: any) => {
                    const errorMessage = typeof e === 'string' ? e : e?.message || '';
                    const normalized = errorMessage.toLowerCase();

                    const lowerError = typeof e === 'string' ? e.toLowerCase() : '';
                    if (typeof e === 'string' && (e.includes('Email уже занят') || lowerError.includes('email already taken') || lowerError.includes('email занят'))) {
                        setNotification({ type: 'error', message: t('profile.emailTaken') });
                    } else if (normalized.includes('phone') || errorMessage.includes('телефон') || errorMessage.includes('phone')) {
                        errorsMap.phone = errorMessage;
                    } else if (normalized.includes('login') || errorMessage.includes('логин') || errorMessage.includes('username')) {
                        errorsMap.login = errorMessage;
                    } else if (normalized.includes('first') || errorMessage.includes('имя') || errorMessage.includes('firstname') || errorMessage.includes('first name')) {
                        errorsMap.firstname = errorMessage;
                    } else if (normalized.includes('last') || errorMessage.includes('фам') || errorMessage.includes('lastname') || errorMessage.includes('last name')) {
                        errorsMap.lastname = errorMessage;
                    } else if (normalized.includes('wallet') || normalized.includes('address')) {
                        const coin = fieldKey.split('.')[1];
                        errorsMap[`wallets.${coin}`] = errorMessage;
                    }
                });
            }

            if (Object.keys(errorsMap).length > 0) {
                setFormErrors((prev) => ({ ...prev, ...errorsMap }));
            }

            if (!err?.errors?.some((e: any) => typeof e === 'string' && e.includes('Email уже занят'))) {
                setNotification({ type: 'error', message: err?.message || t('profile.updateError') });
            }

            resetFieldValue(fieldKey);
            setEditingFields((prev) => ({ ...prev, [fieldKey]: false }));
            if (fieldKey === 'currency') {

            }
        } finally {
            setFieldSaving(null);
        }
    };

    const getDisplayValue = (fieldKey: string) => {
        if (fieldKey.startsWith('wallets.')) {
            const coin = fieldKey.split('.')[1] as keyof typeof editData.wallets;
            return getWalletAddress(coin);
        }
        if (fieldKey === 'currency') {
            const currency = (user as any)?.currency || 'USD';
            const currencyInfo = getCurrencyInfo(currency);
            return `${currencyInfo.symbol} ${currencyInfo.name} (${currencyInfo.code})`;
        }
        if (fieldKey === 'country') {
            const userCountry = (user as any)?.country || (user as any)?.kyc_country || "";
            if (!userCountry) return t('profile.notSet');
            // Если это код страны (2 символа), нужно найти название
            // Пока просто возвращаем код, название будет отображаться в CountryField
            return userCountry;
        }
        return (user as any)?.[fieldKey] || t('profile.notSet');
    };

    // Мемоизируем обработчики для предотвращения перерендеров
    // Используем useCallback с правильными зависимостями
    const handleFieldChangeMemo = useCallback((fieldKey: string, value: string) => {
        handleFieldChange(fieldKey, value);
    }, [editData]);
    
    const handleFieldSubmitMemo = useCallback(async (fieldKey: string, value?: string) => {
        await handleFieldSubmit(fieldKey, value);
    }, [user, editData, dispatch, t]);
    
    const cancelEditingMemo = useCallback((fieldKey: string) => {
        cancelEditing(fieldKey);
    }, [user]);
    
    const startEditingMemo = useCallback((fieldKey: string) => {
        startEditing(fieldKey);
    }, []);
    
    const getDisplayValueMemo = useCallback((fieldKey: string) => {
        return getDisplayValue(fieldKey);
    }, [user, editData, t]);

    const renderEditableField = (
        fieldKey: string,
        label: string,
        options?: {
            type?: string;
            placeholder?: string;
            inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
            className?: string;
        }
    ) => {
        const isFieldEditing = !!editingFields[fieldKey];
        const isSaving = fieldSaving === fieldKey;
        const value = fieldKey.startsWith('wallets.')
            ? editData.wallets[fieldKey.split('.')[1] as keyof typeof editData.wallets] || ""
            : (editData as any)[fieldKey] || "";

        return (
            <EditableField
                fieldKey={fieldKey}
                label={label}
                value={value}
                isFieldEditing={isFieldEditing}
                isSaving={isSaving}
                error={formErrors[fieldKey]}
                options={options}
                onFieldChange={handleFieldChangeMemo}
                onFieldSubmit={handleFieldSubmitMemo}
                onCancelEditing={cancelEditingMemo}
                onStartEditing={startEditingMemo}
                getDisplayValue={getDisplayValueMemo}
            />
        );
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return t('common.notAvailable');
        try {
            const localeMap: Record<string, string> = {
                'en': 'en-US',
                'ru': 'ru-RU',
                'it': 'it-IT',
                'fr': 'fr-FR',
                'ar': 'ar-SA',
                'tr': 'tr-TR',
                'fa': 'fa-IR',
                'hr': 'hr-HR',
                'bn': 'bn-BD',
                'sw': 'sw-KE',
                'nl': 'nl-NL',
                'ha': 'ha-NG',
                'az': 'az-AZ',
                'ka': 'ka-GE',
                'pt': 'pt-PT',
                'pl': 'pl-PL',
                'th': 'th-TH',
                'ms': 'ms-MY',
                'ja': 'ja-JP',
                'sr': 'sr-RS',
                'hi': 'hi-IN',
                'uk': 'uk-UA',
                'ky': 'ky-KG',
                'yo': 'yo-NG',
                'af': 'af-ZA',
                'uz': 'uz-UZ',
                'es': 'es-ES',
                'id': 'id-ID',
                'vi': 'vi-VN',
                'zh': 'zh-CN',
                'ko': 'ko-KR',
                'ro': 'ro-RO',
                'el': 'el-GR',
                'tl': 'tl-PH',
                'kk': 'kk-KZ',
                'ig': 'ig-NG',
                'tg': 'tg-TJ',
                'hy': 'hy-AM',
                'de': 'de-DE',
                'cs': 'cs-CZ'
            };
            const locale = localeMap[language] || 'en-US';
            return new Date(dateString).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return t('common.notAvailable');
        }
    };

    const renderCurrencyField = () => {
        const fieldKey = 'currency';
        const isFieldEditing = !!editingFields[fieldKey];
        const isSaving = fieldSaving === fieldKey;
        const currentCurrency = editData.currency || 'USD';

        return (
            <CurrencyField
                fieldKey={fieldKey}
                currentCurrency={currentCurrency}
                isFieldEditing={isFieldEditing}
                isSaving={isSaving}
                error={formErrors[fieldKey]}
                onFieldChange={handleFieldChangeMemo}
                onFieldSubmit={handleFieldSubmitMemo}
                onCancelEditing={cancelEditingMemo}
                onStartEditing={startEditingMemo}
                getDisplayValue={getDisplayValueMemo}
            />
        );
    };

    const getWalletAddress = (coin: string) => {
        if (!user?.wallets) return t('profile.notSet');
        const wallets = typeof user.wallets === 'string' ? JSON.parse(user.wallets) : user.wallets;
        return wallets[coin as keyof typeof wallets] || t('profile.notSet');
    };

    if (loading && !user) {
        return (
            <MobileMenuProvider>
                <SidebarProvider>
                    <ProfilePageWrapper>
                        <TradingHeader />
                        <div className="profile-page-container">
                            <div className="profile-page-content">
                                <div className="profile-loading">
                                    <div className="loading-spinner large"></div>
                                    <p>{t('profile.loading')}</p>
                                </div>
                            </div>
                        </div>
                    </ProfilePageWrapper>
                </SidebarProvider>
            </MobileMenuProvider>
        );
    }

    if (error && !error.errors?.some((e: any) => typeof e === 'string' && e.includes('Email уже занят'))) {
        return (
            <MobileMenuProvider>
                <SidebarProvider>
                    <ProfilePageWrapper>
                        <TradingHeader />
                        <div className="profile-page-container">
                            <div className="profile-page-content">
                                <div className="profile-error">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                                              stroke="#ff006e" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    <h3>{t('profile.errorTitle')}</h3>
                                    <p>{typeof error === 'string' ? error : error?.message}</p>
                                    <button
                                        className="retry-btn"
                                        onClick={() => {
                                            if (user?.id) {
                                                const { email, ...profileDataToSave } = editData;
                                                dispatch(updateUserProfile({
                                                    profileData: profileDataToSave
                                                }));
                                            }
                                        }}
                                    >
                                        {t('common.tryAgain')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </ProfilePageWrapper>
                </SidebarProvider>
            </MobileMenuProvider>
        );
    }

    const handleTabChange = (tab: 'account' | 'wallets' | 'kyc' | 'referrals') => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(TAB_STORAGE_KEY, tab);
            } catch {
                // ignore storage errors
            }
        }
    };

    const getReferralLink = () => {
        const refId = user?.id;
        if (!refId) return '';
        // Генерируем хеш из ID пользователя
        const referralHash = generateReferralHash(refId);
        const baseUrl = window.location.origin;
        // Используем параметр invite вместо ref для скрытности
        return `${baseUrl}/?invite=${referralHash}`;
    };

    const copyReferralLink = () => {
        const referralLink = getReferralLink();
        navigator.clipboard.writeText(referralLink);
        setReferralLinkCopied(true);
        setTimeout(() => setReferralLinkCopied(false), 2000);
    };

    const handleIslamicHalalToggle = async (e?: React.MouseEvent) => {
        if (islamicHalalLoading) {
            e?.preventDefault();
            return;
        }
        const newValue = !islamicHalalEnabled;
        try {
            setIslamicHalalLoading(true);
            await userApi.updateIslamicHalal(newValue);
            setIslamicHalalEnabled(newValue);
            if (typeof window !== 'undefined') {
                localStorage.setItem(ISLAMIC_HALAL_STORAGE_KEY, String(newValue));
                // Dispatch custom event to notify other components (like TradingHeader)
                window.dispatchEvent(new CustomEvent('islamicHalalChange'));
            }
            // Обновляем только поле is_islamic_halal в Redux store без полной перезагрузки профиля
            if (user) {
                dispatch(setUser({ ...user, is_islamic_halal: newValue }));
            }
            setNotification({
                type: 'success',
                message: t('profile.islamicHalalUpdated')
            });
        } catch (error) {
            setNotification({
                type: 'error',
                message: t('profile.islamicHalalUpdateError')
            });
        } finally {
            setIslamicHalalLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteAccountConfirm !== 'DELETE') {
            setNotification({
                type: 'error',
                message: t('profile.deleteAccountInvalidConfirm')
            });
            return;
        }

        try {
            setDeleteAccountLoading(true);
            await userApi.deleteAccount(deleteAccountConfirm);
            
            // Очищаем все данные пользователя
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            
            // Очищаем профиль из Redux
            dispatch(clearProfile());
            
            // Показываем уведомление об успешном удалении
            setNotification({
                type: 'success',
                message: t('profile.deleteAccountSuccess')
            });
            
            // Редирект на лендинг
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            const errorMessage = message || t('profile.deleteAccountError');
            
            // Если получили ошибку ACCOUNT_DELETED_OR_ERROR, считаем что аккаунт удален
            // (возможно, произошла ошибка при удалении связанных записей, но пользователь уже удален)
            if (message.includes('ACCOUNT_DELETED_OR_ERROR')) {
                // Очищаем все данные пользователя
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                
                // Очищаем профиль из Redux
                dispatch(clearProfile());
                
                // Показываем уведомление об успешном удалении
                setNotification({
                    type: 'success',
                    message: t('profile.deleteAccountSuccess')
                });
                
                // Редирект на лендинг
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
                return;
            }
            
            setNotification({
                type: 'error',
                message: errorMessage
            });
        } finally {
            setDeleteAccountLoading(false);
        }
    };

    return (
        <MobileMenuProvider>
            <SidebarProvider>
                <ProfilePageWrapper>
                    <TradingHeader />
                    <div className="profile-page-container">
                        <nav className="profile-page-nav">
                            <button
                                type="button"
                                className={`profile-nav-tab ${activeTab === 'account' ? 'active' : ''}`}
                                onClick={() => handleTabChange('account')}
                            >
                                {t('profile.accountInfoTab', { defaultValue: 'Account Information' })}
                            </button>
                            <button
                                type="button"
                                className={`profile-nav-tab ${activeTab === 'wallets' ? 'active' : ''}`}
                                onClick={() => handleTabChange('wallets')}
                            >
                                {t('profile.walletTab', { defaultValue: 'Wallet Addresses' })}
                            </button>
                            <button
                                type="button"
                                className={`profile-nav-tab ${activeTab === 'kyc' ? 'active' : ''}`}
                                onClick={() => handleTabChange('kyc')}
                            >
                                {t('profile.kycTab', { defaultValue: 'KYC Verification' })}
                            </button>
                            <button
                                type="button"
                                className={`profile-nav-tab ${activeTab === 'referrals' ? 'active' : ''}`}
                                onClick={() => handleTabChange('referrals')}
                                disabled
                            >
                                {t('profile.referralsTab', { defaultValue: 'Referral Program' })}
                            </button>
                        </nav>
                        
                        <div className="profile-page-content">
                            {notification && (
                                <div className={`notification ${notification.type}`}>
                                    <span>{notification.message}</span>
                                    <button onClick={() => setNotification(null)}>×</button>
                                </div>
                            )}

                            <div className="profile-container">
                                <div className="profile-tab-panels">
                        {activeTab === 'account' && (
                            <div className="tab-panel account-panel">
                                <div className="profile-main-layout">
                                    {/* Основная информация */}
                                    <div className="profile-section profile-section--main">
                                        {/* Заголовок и аватар в одну строку */}
                                        <div className="profile-header-row">
                                            <h2 className="profile-info-title">{t('profile.accountInfo')}</h2>
                                            <div className={`avatar-container-inline avatar-container--level-${levelInfo.variant}`}>
                                                <div className="avatar-wrapper">
                                                    <img
                                                        src={avatarUrl || userIcon}
                                                        alt={t('profile.title') || 'Profile'}
                                                        className="avatar-image"
                                                    />
                                                    {avatarUploading && (
                                                        <div className="avatar-loading-overlay">
                                                            <div className="loading-spinner small" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="avatar-actions-inline">
                                                    <button
                                                        type="button"
                                                        className="avatar-upload-button"
                                                        onClick={() => avatarInputRef.current?.click()}
                                                        disabled={avatarUploading}
                                                    >
                                                        {avatarUploading
                                                            ? t('common.processing')
                                                            : t('profile.uploadAvatar', { defaultValue: 'Upload avatar' })}
                                                    </button>
                                                    <input
                                                        ref={avatarInputRef}
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                        className="avatar-file-input"
                                                        onChange={handleAvatarUpload}
                                                    />
                                                    {avatarError && <span className="avatar-error-message">{avatarError}</span>}
                                                    <span className="avatar-hint-text">
                                                        {t('profile.avatarHint')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Информационные поля */}
                                        <div className="profile-info-card">
                                            <div className="profile-info-fields">
                                                <div className="profile-field">
                                                    <span className="profile-field-label">{t('profile.id')}</span>
                                                    <span className="profile-field-value">
                                                        {user?.id ? formatTraderCodeForDisplay(user.id) : t('common.notAvailable')}
                                                    </span>
                                                </div>

                                                <div className="profile-field profile-field--email">
                                                    <span className="profile-field-label">{t('profile.email')}</span>
                                                    <div className="profile-field-value">
                                                        <span className="email-value">{user?.email || t('profile.notSet')}</span>
                                                        {user?.email ? (
                                                            user.email_verified ? (
                                                                <span className="email-status-badge email-status-badge--verified">
                                                                    {t('profile.emailVerified')}
                                                                </span>
                                                            ) : (
                                                                <div className="email-actions">
                                                                    <span className="email-status-badge email-status-badge--pending">
                                                                        {t('profile.emailNotVerified')}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="email-verify-button"
                                                                        onClick={handleSendVerificationEmail}
                                                                        disabled={emailVerificationLoading}
                                                                    >
                                                                        {emailVerificationLoading
                                                                            ? t('common.processing')
                                                                            : t('profile.verifyEmailAction')}
                                                                    </button>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <span className="email-status-badge email-status-badge--empty">
                                                                {t('profile.emailAddHint')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="profile-field">
                                                    <span className="profile-field-label">{t('profile.ipAddress')}</span>
                                                    <span className="profile-field-value">
                                                        {user?.ip_address || currentIpAddress || t('profile.notSet')}
                                                    </span>
                                                </div>

                                                {renderEditableField('firstname', t('profile.firstName'), {
                                                    placeholder: t('profile.enterFirstName')
                                                })}

                                                {renderEditableField('lastname', t('profile.lastName'), {
                                                    placeholder: t('profile.enterLastName')
                                                })}

                                                {renderEditableField('phone', t('profile.phone'), {
                                                    type: 'tel',
                                                    inputMode: 'tel',
                                                    placeholder: t('profile.enterPhone')
                                                })}

                                                {renderEditableField('login', t('profile.login'), {
                                                    placeholder: t('profile.enterLogin')
                                                })}

                                                {renderCurrencyField()}

                                                <div className="profile-field profile-field--verification">
                                                    <span className="profile-field-label">{t('profile.verification')}</span>
                                                    <div className="profile-field-value">
                                                        {user?.kyc_verified ? (
                                                            <div className="verification-status">
                                                                <span className="verification-status-badge verification-status-badge--verified">
                                                                    {t('profile.verified')}
                                                                </span>
                                                            </div>
                                                        ) : user?.kyc_submitted_at ? (
                                                            <div className="verification-status">
                                                                <span className="verification-status-badge verification-status-badge--pending">
                                                                    {t('profile.pendingVerification')}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="verification-status">
                                                                <span className="verification-status-badge verification-status-badge--not-verified">
                                                                    {t('profile.notVerified')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {isMobile && (
                                                    <div className="profile-field">
                                                        <span className="profile-field-label">{t('profile.language')}</span>
                                                        <div className="profile-field-value">
                                                            <LanguageDropdown variant="trading" />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="profile-field">
                                                    <span className="profile-field-label">{t('profile.islamicHalalAccount', { defaultValue: 'Islamic halal account' })}</span>
                                                    <div className="profile-field-value">
                                                        <div className="toggle-wrapper">
                                                            <label 
                                                                className={`toggle-switch ${islamicHalalLoading ? 'disabled' : ''}`}
                                                                onClick={(e) => {
                                                                    if (islamicHalalLoading) {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                    }
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={islamicHalalEnabled}
                                                                    onChange={() => handleIslamicHalalToggle()}
                                                                    disabled={islamicHalalLoading}
                                                                    onClick={(e) => {
                                                                        if (islamicHalalLoading) {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="toggle-slider"></span>
                                                            </label>
                                                            <span className="toggle-text">
                                                                {islamicHalalEnabled 
                                                                    ? t('profile.islamicHalalEnabled')
                                                                    : t('profile.islamicHalalDisabled')
                                                                }
                                                            </span>
                                                            {islamicHalalLoading && (
                                                                <span className="inline-loader" style={{ marginLeft: '10px' }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="profile-field">
                                                    <span className="profile-field-label">{t('profile.memberSince')}</span>
                                                    <span className="profile-field-value">{formatDate(user?.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Верификация KYC */}
                                    {!user?.kyc_verified && (
                                        <div className="profile-verification-section">
                                            <h2 className="profile-section-title">{t('profile.kycVerification')}</h2>
                                            <div className="verification-warning">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p>{t('profile.verificationWarning')}</p>
                                            </div>
                                            <KYCVerificationForm
                                                user={user}
                                                onSuccess={() => {
                                                    dispatch(fetchProfile());
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Смена пароля */}
                                    <div className="profile-password-section">
                                            <h2 className="profile-section-title">{t('profile.changePassword')}</h2>
                                            <form 
                                                className="password-form"
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handlePasswordChange();
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    name="username"
                                                    autoComplete="username"
                                                    value={user?.login || user?.email || ''}
                                                    readOnly
                                                    style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                                                    tabIndex={-1}
                                                    aria-hidden="true"
                                                />
                                                <div className="form-field">
                                                    <label className="form-label">{t('profile.oldPassword')}</label>
                                                    <input
                                                        type="password"
                                                        value={passwordChangeData.oldPassword}
                                                        onChange={(e) => setPasswordChangeData(prev => ({ ...prev, oldPassword: e.target.value }))}
                                                        placeholder={t('profile.enterOldPassword')}
                                                        className="form-input"
                                                        autoComplete="current-password"
                                                    />
                                                    {passwordErrors.oldPassword && (
                                                        <span className="form-error">{passwordErrors.oldPassword}</span>
                                                    )}
                                                </div>
                                                <div className="form-field">
                                                    <label className="form-label">{t('profile.newPassword')}</label>
                                                    <input
                                                        type="password"
                                                        value={passwordChangeData.newPassword}
                                                        onChange={(e) => setPasswordChangeData(prev => ({ ...prev, newPassword: e.target.value }))}
                                                        placeholder={t('profile.enterNewPassword')}
                                                        className="form-input"
                                                        autoComplete="new-password"
                                                    />
                                                    {passwordErrors.newPassword && (
                                                        <span className="form-error">{passwordErrors.newPassword}</span>
                                                    )}
                                                </div>
                                                <div className="form-field">
                                                    <label className="form-label">{t('profile.confirmPassword')}</label>
                                                    <input
                                                        type="password"
                                                        value={passwordChangeData.confirmPassword}
                                                        onChange={(e) => setPasswordChangeData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        placeholder={t('profile.confirmPassword')}
                                                        className="form-input"
                                                        autoComplete="new-password"
                                                    />
                                                    {passwordErrors.confirmPassword && (
                                                        <span className="form-error">{passwordErrors.confirmPassword}</span>
                                                    )}
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="password-submit-button"
                                                    disabled={passwordChangeLoading}
                                                >
                                                    {passwordChangeLoading
                                                        ? t('common.processing')
                                                        : t('profile.changePasswordBtn')}
                                                </button>
                                            </form>
                                    </div>

                                    {/* Удаление аккаунта - внизу */}
                                    <div className="profile-delete-section">
                                            <h2 className="profile-section-title">{t('profile.deleteAccount')}</h2>
                                            <div className="delete-account-content">
                                                {!showDeleteConfirm ? (
                                                    <button
                                                        type="button"
                                                        className="delete-account-button"
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                    >
                                                        {t('profile.deleteAccountButton')}
                                                    </button>
                                                ) : (
                                                    <div className="delete-confirm-wrapper">
                                                        <div className="form-field">
                                                            <label className="form-label">{t('profile.deleteAccountConfirmLabel')}</label>
                                                            <input
                                                                type="text"
                                                                value={deleteAccountConfirm}
                                                                onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                                                                placeholder="DELETE"
                                                                className="form-input"
                                                            />
                                                        </div>
                                                        <div className="delete-confirm-actions">
                                                            <button
                                                                type="button"
                                                                className="delete-confirm-button"
                                                                onClick={handleDeleteAccount}
                                                                disabled={deleteAccountLoading || deleteAccountConfirm !== 'DELETE'}
                                                            >
                                                                {deleteAccountLoading
                                                                    ? t('common.processing')
                                                                    : t('profile.deleteAccountConfirmButton')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="delete-cancel-button"
                                                                onClick={() => {
                                                                    setShowDeleteConfirm(false);
                                                                    setDeleteAccountConfirm('');
                                                                }}
                                                                disabled={deleteAccountLoading}
                                                            >
                                                                {t('common.cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'wallets' && (
                            <div className="tab-panel">
                                <div className="wallet-card">
                                    <h3>{t('profile.walletAddresses')}</h3>
                                    <p>{t('profile.walletDescription')}</p>
                                    <div className="wallets-list">
                                        {['usdt', 'btc', 'ltc', 'eth'].map((coin) => (
                                            <div key={coin} className="wallet-item">
                                                <span className="wallet-label">{coin.toUpperCase()}</span>
                                                {renderEditableField(`wallets.${coin}`, '', {
                                                    placeholder: t('profile.enterAddress', { coin: coin.toUpperCase() }),
                                                    className: 'wallet-editable'
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'kyc' && (
                            <div className="tab-panel">
                                <div className="kyc-card">
                                    <h3>{t('profile.kycVerification', { defaultValue: 'KYC Verification' })}</h3>
                                    <KYCVerificationForm
                                        user={user}
                                        onSuccess={() => {
                                            dispatch(fetchProfile());
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'referrals' && (
                            <div className="tab-panel">
                                <div className="referral-program-card">
                                    <div className="referral-hero">
                                        <h2 className="referral-title">
                                            {t('profile.referralProgramTitle')}
                                        </h2>
                                        <p className="referral-slogan">
                                            {t('profile.referralSlogan')}
                                        </p>
                                    </div>

                                    <div className="referral-stats-grid">
                                        <div className="referral-stat-card">
                                            <div className="stat-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                                    <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V8H20V18Z" fill="currentColor"/>
                                                    <path d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="currentColor"/>
                                                </svg>
                                            </div>
                                            <div className="stat-value">{formatCurrency(refBalanceDisplay, userCurrency)}</div>
                                            <div className="stat-label">{t('profile.referralBalance')}</div>
                                        </div>
                                        <div className="referral-stat-card">
                                            <div className="stat-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                                    <path d="M3 18L9 12L13 16L21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M21 6H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                            <div className="stat-value">{formatCurrency(totalRefEarningsDisplay, userCurrency)}</div>
                                            <div className="stat-label">{t('profile.totalRefEarnings')}</div>
                                        </div>
                                        <div className="referral-stat-card">
                                            <div className="stat-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                                    <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                            <div className="stat-value">{user?.ref_count || 0}</div>
                                            <div className="stat-label">{t('profile.refCount')}</div>
                                        </div>
                                    </div>

                                    <div className="referral-benefits">
                                        <h3 className="benefits-title">
                                            {t('profile.referralBenefitsTitle')}
                                        </h3>
                                        <div className="benefits-list">
                                            <div className="benefit-item">
                                                <div className="benefit-icon">
                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                                                        <path d="M12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6Z" fill="currentColor"/>
                                                    </svg>
                                                </div>
                                                <div className="benefit-content">
                                                    <div className="benefit-percent">20%</div>
                                                    <div className="benefit-text">
                                                        {t('profile.referralFirstDeposit')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="benefit-item">
                                                <div className="benefit-icon">
                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                                        <path d="M3 3V21H21V3H3ZM5 5H19V19H5V5Z" fill="currentColor"/>
                                                        <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H13V17H7V15Z" fill="currentColor"/>
                                                    </svg>
                                                </div>
                                                <div className="benefit-content">
                                                    <div className="benefit-percent">2%</div>
                                                    <div className="benefit-text">
                                                        {t('profile.referralTradingVolume')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="referral-link-section">
                                        <h3 className="link-section-title">
                                            {t('profile.yourReferralLink')}
                                        </h3>
                                        <div className="referral-link-container">
                                            <input
                                                type="text"
                                                readOnly
                                                value={getReferralLink()}
                                                className="referral-link-input"
                                            />
                                            <button
                                                type="button"
                                                className={`referral-copy-btn ${referralLinkCopied ? 'copied' : ''}`}
                                                onClick={copyReferralLink}
                                            >
                                                {referralLinkCopied ? (
                                                    <>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                        {t('profile.copied')}
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                            <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor" />
                                                        </svg>
                                                        {t('profile.copyLink')}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <p className="referral-link-hint">
                                            {t('profile.referralLinkHint')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                </ProfilePageWrapper>
            </SidebarProvider>
        </MobileMenuProvider>
    );
}

function ProfilePageWrapper({ children }: { children: React.ReactNode }) {
    const { hideLeftPanel } = useSidebar();
    
    useEffect(() => {
        hideLeftPanel();
        
        document.body.classList.add('profile-page-active');
        document.documentElement.classList.add('profile-page-active');
        
        return () => {
            document.body.classList.remove('profile-page-active');
            document.documentElement.classList.remove('profile-page-active');
        };
    }, [hideLeftPanel]);
    
    return (
        <div className="profile-page-wrapper">
            {children}
        </div>
    );
}