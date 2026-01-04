import { useCallback, useEffect, useMemo, useState, memo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./TradingHeader.css";
import { useAppSelector, useAppDispatch } from "@src/shared/lib/hooks";
import { selectProfile } from "@src/entities/user/model/selectors";
import { useLanguage } from "@src/app/providers/useLanguage";
import { FavoritePairs } from "@src/widgets/favorite-pairs/FavoritePairs";
import { getLevelInfo } from "@src/shared/ui/BalanceLevelBadge";
import { Heading, Text } from "@src/shared/ui/typography";
import { Button } from "@src/shared/ui/button";
import fullLogoLight from "@src/assets/logos/full-logo-light.png";
import fullLogoDark from "@src/assets/logos/full-logo-dark.png";
import arrowDownIcon from "@src/assets/icons/arrow-down.svg";
import userIcon from "@src/assets/icons/avatar.svg";
import walletIcon from "@src/assets/icons/wallet-icon.svg";
// Иконки удалены - теперь используем кастомные SVG компоненты
import { useAnimatedNumber } from "@src/shared/hooks/useAnimatedNumber";
import { ensureHttps } from "@src/shared/lib/ensureHttps";
import { demoLog } from "@src/entities/demo-trading";
import { formatCurrency } from "@src/shared/lib/currency/currencyUtils";
import { ProfilePopup } from "@src/widgets/profile-popup/ProfilePopup";
import { useMobileMenu } from "@src/shared/contexts/MobileMenuContext";
import { useSidebar } from "@src/shared/contexts/SidebarContext";
import { setTradingMode } from "@src/entities/trading/model/slice";
import { useMediaQuery } from "@src/shared/lib/hooks/useMediaQuery";

interface TradingHeaderProps {
    onStartTutorial?: () => void;
}

export const TradingHeader = memo(({ onStartTutorial }: TradingHeaderProps = {}) => {
    const dispatch = useAppDispatch();
    const profile = useAppSelector(selectProfile);
    const { t } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 1024px)');
    const { toggleMobileMenu, isMobileMenuOpen } = useMobileMenu();
    const { 
        isLeftPanelVisible, 
        isCenterPanelVisible,
        toggleLeftPanel, 
        toggleCenterPanel
    } = useSidebar();

    const [isBalanceMenuOpen, setIsBalanceMenuOpen] = useState(false);
    const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
    const [tradingMode, setTradingModeState] = useState<'manual' | 'demo'>('manual');
    const [isDropdownAbove, setIsDropdownAbove] = useState(false);
    const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        const stored = localStorage.getItem('balance_hidden');
        return stored === 'true';
    });
    const balanceDropdownRef = useRef<HTMLDivElement>(null);
    const balancePanelRef = useRef<HTMLDivElement>(null);

    const realBalance = useMemo(() => Number(profile?.balance || 0), [profile?.balance]);
    const demoBalance = useMemo(() => Number(profile?.demo_balance || 0), [profile?.demo_balance]);
    const [displayBalance, setDisplayBalance] = useState<number>(() => realBalance);
    const userCurrency = useMemo(() => {
        return profile?.currency || 'USD';
    }, [profile?.currency]);
    const levelInfo = useMemo(() => getLevelInfo(realBalance), [realBalance]);
    
    const getLevelNumber = (amount: number): string => {
        if (amount >= 2500) return "5";
        if (amount >= 500) return "4";
        if (amount >= 200) return "3";
        if (amount >= 50) return "2";
        return "1";
    };
    
    const levelNumber = useMemo(() => getLevelNumber(realBalance), [realBalance]);
    
    const getLevelIcon = (level: string): JSX.Element => {
        const iconSize = 10;
        const fillColor = '#ffffff';
        
        switch (level) {
            case "1":
                // Ромб
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 1L8.5 5L5 9L1.5 5L5 1Z" fill={fillColor} />
                    </svg>
                );
            case "2":
                // Звезда
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 0.5L6.12 3.46L9.5 3.7L7.25 5.8L7.88 9.05L5 7.55L2.12 9.05L2.75 5.8L0.5 3.7L3.88 3.46L5 0.5Z" fill={fillColor} />
                    </svg>
                );
            case "3":
                // Заполненная звезда
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 0L6.12 3.45L10 3.45L7.44 5.59L8.56 9.05L5 6.91L1.44 9.05L2.56 5.59L0 3.45L3.88 3.45L5 0Z" fill={fillColor} />
                    </svg>
                );
            case "4":
                // Алмаз
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 1L7.5 4.5L5 8L2.5 4.5L5 1Z" fill={fillColor} />
                        <path d="M7.5 4.5L9.5 5.5L7.5 6.5L5 8L7.5 4.5Z" fill={fillColor} />
                        <path d="M2.5 4.5L0.5 5.5L2.5 6.5L5 8L2.5 4.5Z" fill={fillColor} />
                    </svg>
                );
            case "5":
                // Корона
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 1.5L3.5 4L1.5 3.5L2 6.5H8L8.5 3.5L6.5 4L5 1.5Z" fill={fillColor} />
                        <rect x="1" y="6.5" width="8" height="2.5" fill={fillColor} />
                    </svg>
                );
            default:
                return (
                    <svg width={iconSize} height={iconSize} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 1L8.5 5L5 9L1.5 5L5 1Z" fill={fillColor} />
                    </svg>
                );
        }
    };
    
    const levelIcon = useMemo(() => getLevelIcon(levelNumber), [levelNumber]);
    
    // Используем userCurrency как ключ для принудительного обновления при смене валюты
    const balanceDisplay = useAnimatedNumber(displayBalance, 1000, false);
    const balanceProfitDisplay = useAnimatedNumber(Number(profile?.balance_profit || 0));
    const coinsDisplay = useAnimatedNumber(Number(profile?.coins || 0));
    const profileImageSrc = useMemo(() => {
        const normalized = ensureHttps(profile?.avatarUrl || profile?.avatar_url);
        return normalized || userIcon;
    }, [profile?.avatarUrl, profile?.avatar_url]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const parseTradingMode = (value: string | null): 'manual' | 'demo' => {
            if (value === 'manual' || value === 'demo') {
                return value;
            }
            return 'manual';
        };

        const updateFromLocalStorage = () => {
            try {
                const stored = localStorage.getItem('tradingMode');
                setTradingModeState(parseTradingMode(stored));
            } catch {
                setTradingModeState('manual');
            }
        };

        updateFromLocalStorage();

        const handleTradingModeChange = (event: Event) => {
            const customEvent = event as CustomEvent<'manual' | 'demo'>;
            if (customEvent.detail) {
                setTradingModeState(customEvent.detail);
            } else {
                updateFromLocalStorage();
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'tradingMode') {
                setTradingModeState(parseTradingMode(event.newValue));
            }
        };

        window.addEventListener('tradingModeChange', handleTradingModeChange as EventListener);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('tradingModeChange', handleTradingModeChange as EventListener);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Сохранение и синхронизация состояния скрытия баланса
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateFromLocalStorage = () => {
            try {
                const stored = localStorage.getItem('balance_hidden');
                setIsBalanceHidden(stored === 'true');
            } catch {
                setIsBalanceHidden(false);
            }
        };

        // Слушаем изменения localStorage для синхронизации между вкладками
        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'balance_hidden') {
                updateFromLocalStorage();
            }
        };

        // Слушаем кастомные события для синхронизации в той же вкладке
        const handleBalanceHiddenChange = () => {
            updateFromLocalStorage();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('balanceHiddenChange', handleBalanceHiddenChange as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('balanceHiddenChange', handleBalanceHiddenChange as EventListener);
        };
    }, []);

    // Сохранение состояния скрытия баланса в localStorage при изменении
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            localStorage.setItem('balance_hidden', isBalanceHidden.toString());
            window.dispatchEvent(new CustomEvent('balanceHiddenChange'));
        } catch (error) {
            console.error('Failed to save balance_hidden to localStorage:', error);
        }
    }, [isBalanceHidden]);

    useEffect(() => {
        if (tradingMode === 'demo') {
            demoLog('TradingHeader demo balance updated', { demoBalance, profileDemoBalance: profile?.demo_balance });
            console.log('💰 [TradingHeader] Demo balance changed:', { demoBalance, profileDemoBalance: profile?.demo_balance });
        }
    }, [demoBalance, tradingMode, profile?.demo_balance]);

    useEffect(() => {
        const newBalance = tradingMode === 'demo' ? demoBalance : realBalance;
        console.log('💰 [TradingHeader] Updating display balance:', { 
            tradingMode, 
            demoBalance, 
            realBalance, 
            newBalance,
            profileDemoBalance: profile?.demo_balance 
        });
        setDisplayBalance(newBalance);
    }, [tradingMode, demoBalance, realBalance, profile?.demo_balance]);

    // Автоматическое позиционирование попапа вверх/вниз на мобильных
    useEffect(() => {
        if (!isBalanceMenuOpen || !balanceDropdownRef.current || !balancePanelRef.current) {
            setIsDropdownAbove(false);
            // Очищаем стили при закрытии
            if (balancePanelRef.current) {
                balancePanelRef.current.style.removeProperty('max-height');
                balancePanelRef.current.style.removeProperty('overflow-y');
            }
            return;
        }

        const checkPosition = () => {
            const dropdown = balanceDropdownRef.current;
            const panel = balancePanelRef.current;
            if (!dropdown || !panel) return;

            const rect = dropdown.getBoundingClientRect();
            
            // Получаем размеры viewport с учетом safe-area на iPhone
            const viewport = window.visualViewport;
            const viewportHeight = viewport?.height || window.innerHeight;
            const viewportTop = viewport?.offsetTop || 0;
            
            // Рассчитываем доступное пространство более точно
            // Используем реальную позицию элемента относительно viewport
            const dropdownBottom = rect.bottom;
            const dropdownTop = rect.top;
            
            // Пространство снизу от нижней границы кнопки до низа экрана
            const spaceBelow = viewportHeight - dropdownBottom;
            // Пространство сверху от верхней границы кнопки до верха экрана
            const spaceAbove = dropdownTop;
            
            // На мобильных устройствах проверяем, достаточно ли места
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // На iPhone лучше всегда показывать снизу с ограничением высоты
                // чтобы попап не выходил за границы экрана
                // Показываем сверху только если снизу совсем нет места (меньше 100px)
                // и сверху есть достаточно места (больше 200px)
                const shouldShowAbove = spaceBelow < 100 && spaceAbove > 200;
                
                // Динамически устанавливаем max-height для попапа
                // Рассчитываем максимальную доступную высоту строго по доступному пространству
                let maxAvailableHeight: number;
                
                if (shouldShowAbove) {
                    // Если показываем сверху - используем пространство сверху минус отступы
                    maxAvailableHeight = Math.max(150, spaceAbove - 40); // отступ 40px сверху
                } else {
                    // Если показываем снизу - используем пространство снизу минус отступы
                    // Важно: не больше реального доступного пространства
                    maxAvailableHeight = Math.max(150, spaceBelow - 40); // отступ 40px снизу
                }
                
                // Дополнительно ограничиваем максимальной высотой viewport (60%)
                const maxHeight = Math.min(maxAvailableHeight, viewportHeight * 0.6);
                
                // Устанавливаем max-height строго не больше доступного пространства
                // Используем !important через setProperty для приоритета над CSS
                panel.style.setProperty('max-height', `${maxHeight}px`, 'important');
                
                // Также устанавливаем overflow для прокрутки
                panel.style.setProperty('overflow-y', 'auto', 'important');
                
                setIsDropdownAbove(shouldShowAbove);
            } else {
                setIsDropdownAbove(false);
                panel.style.removeProperty('max-height');
                panel.style.removeProperty('overflow-y');
            }
        };

        // Вызываем сразу для быстрого применения ограничений
        checkPosition();
        
        // Задержка для расчета размеров после рендера
        const timer = setTimeout(checkPosition, 100);
        
        // Также проверяем после полного рендера
        const rafTimer = requestAnimationFrame(() => {
            setTimeout(checkPosition, 50);
        });
        
        // Дополнительная проверка после анимации открытия
        const animationTimer = setTimeout(checkPosition, 250);
        
        window.addEventListener('resize', checkPosition);
        window.addEventListener('scroll', checkPosition, true);
        
        // Для iPhone также слушаем изменения visualViewport
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', checkPosition);
            window.visualViewport.addEventListener('scroll', checkPosition);
        }

        return () => {
            clearTimeout(timer);
            clearTimeout(animationTimer);
            cancelAnimationFrame(rafTimer);
            window.removeEventListener('resize', checkPosition);
            window.removeEventListener('scroll', checkPosition, true);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', checkPosition);
                window.visualViewport.removeEventListener('scroll', checkPosition);
            }
        };
    }, [isBalanceMenuOpen]);

    // Закрытие меню при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (balanceDropdownRef.current && !balanceDropdownRef.current.contains(event.target as Node)) {
                setIsBalanceMenuOpen(false);
            }
        };

        if (isBalanceMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isBalanceMenuOpen]);

    // Отдельный эффект для отслеживания изменений валюты
    useEffect(() => {
        // Если валюта изменилась, нужно пересчитать баланс
    }, [userCurrency, balanceDisplay, displayBalance, profile]);

    const isDemoMode = tradingMode === 'demo';
    
    // State for Islamic halal account to track localStorage changes
    const [islamicHalalFromStorage, setIslamicHalalFromStorage] = useState<boolean | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }
        const stored = localStorage.getItem('islamicHalalEnabled');
        return stored === 'true';
    });
    
    // Check if Islamic halal account is enabled
    const isIslamicHalalEnabled = useMemo(() => {
        // Priority: profile data > localStorage > false
        if (profile?.is_islamic_halal === true) {
            return true;
        }
        if (islamicHalalFromStorage === true) {
            return true;
        }
        return false;
    }, [profile?.is_islamic_halal, islamicHalalFromStorage]);
    
    // Listen to localStorage changes for Islamic halal account
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateFromLocalStorage = () => {
            try {
                const stored = localStorage.getItem('islamicHalalEnabled');
                setIslamicHalalFromStorage(stored === 'true');
            } catch {
                setIslamicHalalFromStorage(null);
            }
        };

        // Initial update
        updateFromLocalStorage();

        // Listen to storage events (for cross-tab updates)
        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'islamicHalalEnabled') {
                updateFromLocalStorage();
            }
        };

        // Listen to custom events (for same-tab updates)
        const handleIslamicHalalChange = () => {
            updateFromLocalStorage();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('islamicHalalChange', handleIslamicHalalChange as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('islamicHalalChange', handleIslamicHalalChange as EventListener);
        };
    }, []);
    
    const balanceModeLabel = isDemoMode 
        ? t('trading.demoAccount')
        : isIslamicHalalEnabled 
            ? t('trading.halalAccount', { defaultValue: 'Halal account' })
            : t('trading.realAccount');
    const depositLabel = t("deposit.pay") || t("deposit.title") || "Deposit";
    const withdrawLabel = t("withdrawal.withdrawButton") || t("withdrawal.title") || "Withdrawal";

    const handleProfileClick = useCallback(() => {
        setIsProfilePopupOpen(true);
    }, []);

    const handleTradingModeChange = useCallback((mode: 'manual' | 'demo') => {
        dispatch(setTradingMode(mode));
        setTradingModeState(mode);
        localStorage.setItem('tradingMode', mode);
        // Не закрываем меню при переключении
        window.dispatchEvent(new CustomEvent<'manual' | 'demo'>('tradingModeChange', { detail: mode }));
    }, [dispatch]);

    const showProfit = false;
    const showCoins = false;

    const formattedBalance = useMemo(() => {
        return formatCurrency(displayBalance, userCurrency, { convertFromUSD: true });
    }, [displayBalance, userCurrency]);

    const formattedProfit = useMemo(() => {
        if (!showProfit) return '';
        const profitNum = typeof balanceProfitDisplay === 'string' ? parseFloat(balanceProfitDisplay) : Number(profile?.balance_profit || 0);
        return formatCurrency(profitNum, userCurrency);
    }, [showProfit, balanceProfitDisplay, profile?.balance_profit, userCurrency]);

    const hideLanguageDropdown = isMobile;
    
    // Определяем, находимся ли мы на странице депозита
    const isDepositPage = location.pathname.includes('/deposit') || 
                         location.pathname.includes('/withdraw') || 
                         location.pathname.includes('/transaction-history');
    
    const isProfilePage = location.pathname.includes('/profile');
    
    const isLightThemePage = isDepositPage || isProfilePage;
    
    // Определяем, находимся ли мы на странице трейдинга
    const isTradingPage = location.pathname === '/trading' || location.pathname.startsWith('/trading');
    
    // Текст и иконка для кнопки навигации
    const tradingButtonLabel = (isDepositPage || isProfilePage)
        ? (t('menu.trading', { defaultValue: 'Trading' }) || 'Trading')
        : (depositLabel || 'Top up');
    
    const handleTradingButtonClick = () => {
        if (isDepositPage || isProfilePage) {
            navigate('/trading');
        } else {
            navigate('/deposit');
        }
    };

    const handleLogoClick = useCallback(() => {
        if (!isTradingPage) {
            navigate('/trading');
        }
    }, [isTradingPage, navigate]);

    return (
        <header className={`app-top-header ${isLightThemePage ? 'app-top-header--deposit' : ''}`}>
            <div className={`trading-page__header-compact ${isLightThemePage ? 'trading-page__header-compact--deposit' : 'trading-page__header-compact--trading'}`}>
                <div className="header-left">
                    {isMobile && (
                        <button
                            className="mobile-menu-toggle"
                            onClick={toggleMobileMenu}
                            aria-label={isMobileMenuOpen ? t('menu.closeMenu') : t('menu.openMenu')}
                            aria-expanded={isMobileMenuOpen}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {isMobileMenuOpen ? (
                                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                ) : (
                                    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                )}
                            </svg>
                        </button>
                    )}
                    <Heading 
                        as={'h1' as any} 
                        level={1} 
                        className={`trading-page__title ${!isTradingPage ? 'trading-page__title--clickable' : ''}`}
                        aria-label="BlockMind"
                        onClick={handleLogoClick}
                        style={!isTradingPage ? { cursor: 'pointer' } : undefined}
                    >
                        <img 
                            src={isLightThemePage ? fullLogoDark : fullLogoLight} 
                            alt="BlockMind" 
                            className="trading-page__logo" 
                            width="120"
                            height="32"
                            loading="eager"
                            decoding="sync"
                        />
                    </Heading>
                    {!hideLanguageDropdown && (
                        <FavoritePairs />
                    )}
                </div>

                <div className="balance-info-compact">
                        {/* ИЗБРАННЫЕ ТЕЛЕГРАММ ТАМ ИЩИ */}

                        <div
                            ref={balanceDropdownRef}
                            className={`balance-dropdown ${isBalanceMenuOpen ? "is-open" : ""} ${isDropdownAbove ? "is-above" : ""}`}
                            data-open={isBalanceMenuOpen ? "true" : "false"}
                        >
                            <div
                                className="balance-item balance-item--primary"
                                tabIndex={0}
                                aria-haspopup="true"
                                aria-expanded={isBalanceMenuOpen}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsBalanceMenuOpen(!isBalanceMenuOpen);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsBalanceMenuOpen(!isBalanceMenuOpen);
                                    }
                                }}
                                data-account-type={
                                    isDemoMode ? "demo" 
                                    : isIslamicHalalEnabled ? "halal" 
                                    : "real"
                                }
                            >
                                <div className="balance-item__content">
                                    <div className="balance-item__top">
                                        <div className="balance-item__label">{balanceModeLabel}</div>
                                        <div className="balance-item__arrow">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="balance-item__value">
                                        {isBalanceHidden ? '••••••' : formattedBalance}
                                    </div>
                                </div>
                            </div>
                            <div 
                                ref={balancePanelRef}
                                className="balance-dropdown__panel" 
                                role="menu" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="balance-dropdown__account-selector">
                                    <div 
                                        className={`balance-dropdown__account-option ${tradingMode !== 'demo' ? 'balance-dropdown__account-option--active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (tradingMode === 'demo') {
                                                handleTradingModeChange('manual');
                                            }
                                        }}
                                        role="menuitemradio"
                                        aria-checked={tradingMode !== 'demo'}
                                    >
                                        <div className="balance-dropdown__account-radio">
                                            <div className={`balance-dropdown__radio-circle ${tradingMode !== 'demo' ? 'balance-dropdown__radio-circle--checked' : ''}`}></div>
                                        </div>
                                        <div className="balance-dropdown__account-info">
                                            <Text
                                                as={'span' as any}
                                                weight="semibold"
                                                className="balance-dropdown__account-label"
                                            >
                                                {t('trading.realAccount')}
                                            </Text>
                                            <Text
                                                as={'span' as any}
                                                size="xs"
                                                weight="medium"
                                                tone="muted"
                                                className="balance-dropdown__account-balance"
                                            >
                                                {isBalanceHidden ? '••••••' : formatCurrency(realBalance, userCurrency, { convertFromUSD: true })}
                                            </Text>
                                        </div>
                                    </div>
                                    <div 
                                        className={`balance-dropdown__account-option ${tradingMode === 'demo' ? 'balance-dropdown__account-option--active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (tradingMode !== 'demo') {
                                                handleTradingModeChange('demo');
                                            }
                                        }}
                                        role="menuitemradio"
                                        aria-checked={tradingMode === 'demo'}
                                    >
                                        <div className="balance-dropdown__account-radio">
                                            <div className={`balance-dropdown__radio-circle ${tradingMode === 'demo' ? 'balance-dropdown__radio-circle--checked' : ''}`}></div>
                                        </div>
                                        <div className="balance-dropdown__account-info">
                                            <Text
                                                as={'span' as any}
                                                weight="semibold"
                                                className="balance-dropdown__account-label"
                                            >
                                                {t('trading.demoAccount')}
                                            </Text>
                                            <Text
                                                as={'span' as any}
                                                size="xs"
                                                weight="medium"
                                                tone="muted"
                                                className="balance-dropdown__account-balance"
                                            >
                                                {isBalanceHidden ? '••••••' : formatCurrency(demoBalance, userCurrency, { convertFromUSD: true })}
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                                <div 
                                    className="balance-dropdown__hide-balance"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsBalanceHidden(!isBalanceHidden);
                                    }}
                                    role="menuitem"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="balance-dropdown__hide-icon">
                                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <line x1="17" y1="7" x2="7" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                    <Text
                                        as={'span' as any}
                                        weight="medium"
                                        className="balance-dropdown__hide-label"
                                    >
                                        {t('trading.hideBalance', { defaultValue: 'Hide balance' })}
                                    </Text>
                                </div>
                            </div>
                        </div>

                        {showProfit && (
                            <div className="balance-item profit">
                                <Text as={'span' as any} size="xs" weight="medium" tone="muted" className="balance-label">
                                    {t("trading.profit")}:
                                </Text>
                                <Text as={'span' as any} weight="semibold" className="balance-value" key={`profit-${userCurrency}-${profile?.balance_profit || 0}`}>
                                    {formattedProfit}
                                </Text>
                            </div>
                        )}

                        {showCoins && (
                            <div className="balance-item coins">
                                <Text as={'span' as any} size="xs" weight="medium" tone="muted" className="balance-label">
                                    {t("trading.coins")}:
                                </Text>
                                <Text as={'span' as any} weight="semibold" className="balance-value">
                                    {coinsDisplay.replace(".00", "")}
                                </Text>
                            </div>
                        )}

                        <Button
                            type="button"
                            variant="primary"
                            className="deposit-button trading-button"
                            onClick={handleTradingButtonClick}
                            aria-label={tradingButtonLabel}
                        >
                            <span className="deposit-icon trading-icon">
                                <img src={walletIcon} alt="" />
                            </span>
                            <span className="deposit-text trading-text">
                                {tradingButtonLabel}
                            </span>
                        </Button>

                        <div className="profile-wrapper">
                            <Button
                                type="button"
                                variant="ghost"
                                className={`profile-button profile-button--level-${levelInfo.variant}`}
                                aria-label={t("profile.title") || "Profile"}
                                onClick={handleProfileClick}
                                data-level={levelInfo.variant}
                            >
                                <div className="profile-button__avatar-wrapper">
                                    <img 
                                        src={profileImageSrc} 
                                        alt={t("profile.title") || "Profile"} 
                                        width="32"
                                        height="32"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                                {!isDemoMode && (
                                    <span className={`profile-button__level-badge profile-button__level-badge--${levelInfo.variant}`}>
                                        {levelIcon}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            <ProfilePopup 
                isOpen={isProfilePopupOpen} 
                onClose={() => setIsProfilePopupOpen(false)} 
            />
        </header>
    );
});

