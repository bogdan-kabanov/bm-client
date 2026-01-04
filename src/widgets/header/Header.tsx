import "./Header.css";
import { Link, useLocation } from "react-router-dom";
import { FaExclamationTriangle } from "react-icons/fa";
import { useAppSelector, useAppDispatch } from "@src/shared/lib/hooks";
import { setMenuOpen, setSubscriptionsMenuOpen, setTopPartnersMenuOpen } from "@src/entities/copy-trading-signals/model/slice";
import { useEffect, useState, useMemo } from "react";
import { useMediaQuery } from '@src/shared/lib/hooks/useMediaQuery';
import { useLanguage } from "@src/app/providers/useLanguage";
import tradingIcon from "@icons/icon-candelstick.svg";
import profileIcon from "@icons/icon-profile-2.svg";
import botsIcon from "@icons/icon-ai.svg";
import copyTradingIcon from "@icons/icon-traders.svg";
import supportIcon from "@icons/icon-chat.svg";
import { usePrefetch } from "@src/shared/lib/hooks/usePrefetch";
import { useTradesHistoryModal } from "@src/shared/contexts/TradesHistoryModalContext";

type MenuItem = {
    path: string;
    icon: string;
    title: string;
    badge?: number;
    isButton?: boolean;
};

export function Header() {
    const location = useLocation();
    const dispatch = useAppDispatch();
    const bots = useAppSelector(state => state.bot.bots);
    const user = useAppSelector(state => state.profile.user);
    const [hasActiveBots, setHasActiveBots] = useState(false);
    const isMobile = useMediaQuery('(max-width: 1024px)');
    const { t, language } = useLanguage();
    const { prefetchOnHover, cancelPrefetch } = usePrefetch();
    const { openTradesHistoryModal } = useTradesHistoryModal();

    useEffect(() => {
        const activeBots = bots.filter(bot =>
            bot.status === 'ACTIVATED'
        );
        setHasActiveBots(activeBots.length > 0);
    }, [bots]);

    const hasActiveBotsCheck = bots.some(bot => bot.status === 'ACTIVATED');

    // Мемоизируем menuItems для предотвращения ререндеров
    const menuItems = useMemo<MenuItem[]>(() => [
        { path: "/trading", icon: tradingIcon, title: t('menu.tradingTitle') },
        { path: "/profile", icon: profileIcon, title: t('menu.profileTitle') },
        { path: "/copy-trading", icon: copyTradingIcon, title: t('menu.copyTradingTitle') }
    ], [t, language]);

    // Динамически устанавливаем высоты header-wrapper и trading-controls
    useEffect(() => {
        if (!isMobile) return;

        const updateHeights = () => {
            const headerWrapper = document.querySelector('.header-wrapper') as HTMLElement;
            const tradingControls = document.querySelector('.trading-controls') as HTMLElement;
            
            if (headerWrapper) {
                const headerHeight = headerWrapper.offsetHeight;
                document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
            }
            
            if (tradingControls) {
                const controlsHeight = tradingControls.offsetHeight;
                document.documentElement.style.setProperty('--trading-controls-height', `${controlsHeight}px`);
                
                // Устанавливаем общую высоту (header + controls)
                const totalHeight = (headerWrapper?.offsetHeight || 0) + controlsHeight;
                document.documentElement.style.setProperty('--mobile-bottom-height', `${totalHeight}px`);
            } else {
                // Если нет trading-controls (не на странице trading), используем только header
                const headerHeight = headerWrapper?.offsetHeight || 0;
                document.documentElement.style.setProperty('--mobile-bottom-height', `${headerHeight}px`);
            }
        };

        // Обновляем при монтировании и при ресайзе
        updateHeights();
        window.addEventListener('resize', updateHeights);


        return () => {
            window.removeEventListener('resize', updateHeights);
            // observer.disconnect();
            // clearInterval(interval);
        };
    }, [isMobile]);

    if (!isMobile) {
        return null;
    }

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <div className="header-wrapper">
            {menuItems.map((item) => {
                const active = isActive(item.path);
                const key = item.path;

                if (item.isButton && item.path === "/bots") {
                    return (
                        <button
                            key={key}
                            className={active ? "active" : ""}
                            title={hasActiveBotsCheck ? item.title : t('menu.noActiveBots')}
                            onClick={(e) => {
                                e.preventDefault();
                                openTradesHistoryModal();
                            }}
                        >
                            <div className="bot-icon-wrapper">
                                <img src={item.icon} alt="" className="header-icon" aria-hidden="true" />
                                {item.badge && item.badge > 0 && (
                                    <span className="header-badge">{item.badge}</span>
                                )}
                                {!hasActiveBotsCheck && bots.length > 0 && (
                                    <div className="bot-warning-indicator">
                                        <FaExclamationTriangle />
                                    </div>
                                )}
                            </div>
                            <span className="header-label">{item.title}</span>
                        </button>
                    );
                }

                if (item.path === "/copy-trading") {
                    return (
                        <button
                            key={key}
                            className={active ? "active" : ""}
                            title={item.title}
                            onClick={(e) => {
                                e.preventDefault();
                                dispatch(setTopPartnersMenuOpen(true));
                            }}
                        >
                            <img src={item.icon} alt="" className="header-icon" aria-hidden="true" />
                            <span className="header-label">{item.title}</span>
                        </button>
                    );
                }

                return (
                    <Link
                        key={key}
                        to={item.path}
                        className={active ? "active" : ""}
                        title={item.title}
                        onMouseEnter={() => !active && prefetchOnHover(item.path)}
                        onMouseLeave={cancelPrefetch}
                        onFocus={() => !active && prefetchOnHover(item.path)}
                        onBlur={cancelPrefetch}
                    >
                        <img src={item.icon} alt="" className="header-icon" aria-hidden="true" />
                        <span className="header-label">{item.title}</span>
                        {item.badge && item.badge > 0 && (
                            <span className="header-badge">{item.badge}</span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}