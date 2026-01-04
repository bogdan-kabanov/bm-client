// SidebarMenu.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./SidebarMenu.css";
import { useAppSelector } from "@src/shared/lib/hooks";
import userIcon from "@src/assets/icons/avatar.svg";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from "@/src/app/providers/useLanguage";
import tradingIcon from "@icons/icon-candelstick.svg";
import profileIcon from "@icons/icon-profile-2.svg";
import botsIcon from "@icons/icon-ai.svg";
import copyTradingIcon from "@icons/icon-traders.svg";
import supportIcon from "@icons/icon-chat.svg";
import paymentsIcon from "@icons/icon-deposit.svg";
import { usePrefetch } from "@src/shared/lib/hooks/usePrefetch";
import { useChatDropdown } from "@src/shared/contexts/ChatDropdownContext";
import { useAppDispatch } from "@src/shared/lib/hooks";
import { setMenuOpen, setSubscriptionsMenuOpen, setTopPartnersMenuOpen } from "@src/entities/copy-trading-signals/model/slice";
import { selectTopPartnersMenuOpen, selectSubscriptionsMenuOpen } from "@src/entities/copy-trading-signals/model/selectors";
import { notificationApi } from "@src/shared/api";
import { useWebSocket } from "@/src/entities/websoket/useWebSocket";
import bonusImage from "@src/assets/images/bonus/Bonus.png";
import { BonusPopup } from '../bonus-popup/BonusPopup';

type MenuItem = {
    path: string;
    icon: string;
    label: string;
    title: string;
    badge?: number;
};

export const SidebarMenu = React.memo(function SidebarMenu() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const bots = useAppSelector(state => state.bot.bots);
    const user = useAppSelector(state => state.profile.user);
    const autoAccessGranted = Boolean(user?.auto_mode_access_granted ?? user?.autoModeAccessGranted);
    const { t, language } = useLanguage();
    const { prefetchOnHover, cancelPrefetch } = usePrefetch();

    // Мемоизируем menuItems для предотвращения ререндеров
    const menuItems = useMemo<MenuItem[]>(() => [
        { path: "/trading", icon: tradingIcon, label: t('menu.trading'), title: t('menu.tradingTitle') },
        { path: "/profile", icon: profileIcon, label: t('menu.profile'), title: t('menu.profileTitle') },
        { path: "/deposit", icon: paymentsIcon, label: t('deposit.title', { defaultValue: 'Deposit' }), title: t('deposit.title', { defaultValue: 'Payments' }) },
        ...(autoAccessGranted ? [{
            path: "/bots",
            icon: botsIcon,
            label: t('menu.bots'),
            title: t('menu.botsTitle'),
            badge: bots.length
        }] : []),
        {
            path: "/copy-trading",
            icon: copyTradingIcon,
            label: t('menu.copyTradingShort', { defaultValue: 'TOP' }),
            title: t('menu.copyTradingTitle')
        }
    ], [t, language, bots.length, autoAccessGranted]);

    // Убрали функцию анимации онлайн пользователей

    // const fetchStats = async () => {
    //     try {
    //         // Больше не загружаем статистику онлайн пользователей
    //         
    //     } catch (err) {
    //         
    //     }
    // };

    const websocket = useWebSocket();
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
    const hasActiveBots = bots.some(bot => bot.status === 'ACTIVATED');
    const { openChat, isOpen: isChatOpen } = useChatDropdown();
    const isTradingPage = location.pathname === "/trading";
    const isTopPartnersMenuOpen = useAppSelector(selectTopPartnersMenuOpen);
    const isSubscriptionsMenuOpen = useAppSelector(selectSubscriptionsMenuOpen);
    const bonusCanvasRef = useRef<HTMLCanvasElement>(null);
    const subscriptionsCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isBonusPopupOpen, setIsBonusPopupOpen] = useState(false);

    useEffect(() => {
        // Больше не загружаем статистику онлайн пользователей
    }, []);

    // Загрузка количества непрочитанных уведомлений
    useEffect(() => {
        const loadUnreadCount = async () => {
            try {
                const count = await notificationApi.getUnreadCount();
                setUnreadNotificationsCount(count);
            } catch (error) {
                console.error('Error loading unread notifications count:', error);
            }
        };

        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 30000); // Обновляем каждые 30 секунд
        
        return () => clearInterval(interval);
    }, []);

    // Подписка на новые уведомления через WebSocket
    useEffect(() => {
        if (!websocket) return;

        const unsubscribe = websocket.onMessage('new_notification', () => {
            // Обновляем количество непрочитанных уведомлений
            notificationApi.getUnreadCount()
                .then(count => setUnreadNotificationsCount(count))
                .catch(error => console.error('Error updating unread count:', error));
        });

        return () => {
            unsubscribe?.();
        };
    }, [websocket]);

    // Закрываем BonusPopup при получении события
    useEffect(() => {
        const handleCloseBonusPopup = () => {
            setIsBonusPopupOpen(false);
        };
        window.addEventListener('closeBonusPopup', handleCloseBonusPopup);
        return () => {
            window.removeEventListener('closeBonusPopup', handleCloseBonusPopup);
        };
    }, []);

    // Canvas animation for bonus block border
    useEffect(() => {
        const canvas = bonusCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const container = canvas.parentElement;
        if (!container) return;

        const updateCanvasSize = () => {
            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            
            const dpr = window.devicePixelRatio || 1;
            const width = rect.width;
            const height = rect.height;
            
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.scale(dpr, dpr);
        };

        updateCanvasSize();

        let animationFrame: number;
        let startTime = Date.now();
        const duration = 20000; // 20 seconds

        const drawBorder = () => {
            const now = Date.now();
            const elapsed = (now - startTime) % duration;
            const progress = elapsed / duration;
            
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            
            ctx.clearRect(0, 0, width, height);
            
            const borderWidth = 2;
            const radius = 6; // Slightly smaller to fit inside
            const x = borderWidth / 2;
            const y = borderWidth / 2;
            const w = width - borderWidth;
            const h = height - borderWidth;
            
            // Calculate angle for light position (clockwise from top)
            const angle = progress * Math.PI * 2;
            const lightSize = (Math.PI / 1.5) * 7; // ~840 degrees - 7 times longer
            const segments = 600; // Increased segments for smoother rendering
            
            ctx.lineWidth = borderWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw border segments
            // The light moves clockwise, so the bright front is at 'angle', and the tail extends backwards
            for (let i = 0; i < segments; i++) {
                const segAngle = (i / segments) * Math.PI * 2;
                
                let alpha = 0;
                let color = 'transparent';
                
                // Calculate angular distance from segAngle to angle (clockwise)
                let angularDistance = 0;
                if (segAngle <= angle) {
                    angularDistance = angle - segAngle;
                } else {
                    angularDistance = (Math.PI * 2 - segAngle) + angle;
                }
                
                // Normalize lightSize to be within one full rotation for display
                const displayLightSize = Math.min(lightSize, Math.PI * 2);
                
                // Check if segment is within the light tail
                if (angularDistance <= displayLightSize && angularDistance >= 0) {
                    // Position 0 = tail start (dim, behind), position 1 = front (bright, at angle)
                    // We want bright at front (1) and fade to dim at tail start (0)
                    const positionInTail = angularDistance / displayLightSize;
                    // Very smooth fade using ease-in-out curve
                    // Using smoother easing function for more natural fade
                    const t = positionInTail;
                    const fadeIntensity = t < 0.5 
                        ? 2 * t * t * (3 - 2 * t) // Smooth ease-in-out
                        : 1 - Math.pow(-2 * t + 2, 3) / 2; // Smooth ease-out
                    alpha = fadeIntensity;
                    
                    // Only purple color, intensity controlled by alpha
                    color = '#7C3AED';
                }
                
                // Calculate position on rounded rectangle border
                const getBorderPoint = (t: number) => {
                    const perimeter = 2 * (w + h) - 8 * radius + 2 * Math.PI * radius;
                    const pos = (t / (Math.PI * 2)) * perimeter;
                    let currentPos = 0;
                    
                    // Top edge
                    if (pos < w - 2 * radius) {
                        return { x: x + radius + pos, y: y };
                    }
                    currentPos += w - 2 * radius;
                    
                    // Top-right corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = -Math.PI / 2 + cornerPos / radius;
                        return {
                            x: x + w - radius + Math.cos(cornerAngle) * radius,
                            y: y + radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Right edge
                    if (pos < currentPos + h - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x + w, y: y + radius + edgePos };
                    }
                    currentPos += h - 2 * radius;
                    
                    // Bottom-right corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = cornerPos / radius;
                        return {
                            x: x + w - radius + Math.cos(cornerAngle) * radius,
                            y: y + h - radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Bottom edge
                    if (pos < currentPos + w - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x + w - radius - edgePos, y: y + h };
                    }
                    currentPos += w - 2 * radius;
                    
                    // Bottom-left corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = Math.PI / 2 + cornerPos / radius;
                        return {
                            x: x + radius + Math.cos(cornerAngle) * radius,
                            y: y + h - radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Left edge
                    if (pos < currentPos + h - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x, y: y + h - radius - edgePos };
                    }
                    currentPos += h - 2 * radius;
                    
                    // Top-left corner
                    const cornerPos = pos - currentPos;
                    const cornerAngle = Math.PI + cornerPos / radius;
                    return {
                        x: x + radius + Math.cos(cornerAngle) * radius,
                        y: y + radius + Math.sin(cornerAngle) * radius
                    };
                };
                
                const point = getBorderPoint(segAngle);
                const nextPoint = getBorderPoint((i + 1) / segments * Math.PI * 2);
                
                ctx.strokeStyle = color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(nextPoint.x, nextPoint.y);
                ctx.stroke();
            }
            
            ctx.globalAlpha = 1;
            
            animationFrame = requestAnimationFrame(drawBorder);
        };

        drawBorder();

        const resizeObserver = new ResizeObserver(() => {
            updateCanvasSize();
        });
        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
        };
    }, []);

    // Canvas animation for subscriptions block border
    useEffect(() => {
        const canvas = subscriptionsCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const container = canvas.parentElement;
        if (!container) return;

        const updateCanvasSize = () => {
            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            
            const dpr = window.devicePixelRatio || 1;
            const width = rect.width;
            const height = rect.height;
            
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.scale(dpr, dpr);
        };

        updateCanvasSize();

        let animationFrame: number;
        let startTime = Date.now();
        const duration = 20000; // 20 seconds

        const drawBorder = () => {
            const now = Date.now();
            const elapsed = (now - startTime) % duration;
            const progress = elapsed / duration;
            
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            
            ctx.clearRect(0, 0, width, height);
            
            const borderWidth = 2;
            const radius = 6; // Slightly smaller to fit inside
            const x = borderWidth / 2;
            const y = borderWidth / 2;
            const w = width - borderWidth;
            const h = height - borderWidth;
            
            // Calculate angle for light position (clockwise from top)
            const angle = progress * Math.PI * 2;
            const lightSize = (Math.PI / 1.5) * 7; // ~840 degrees - 7 times longer
            const segments = 600; // Increased segments for smoother rendering
            
            ctx.lineWidth = borderWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw border segments
            // The light moves clockwise, so the bright front is at 'angle', and the tail extends backwards
            for (let i = 0; i < segments; i++) {
                const segAngle = (i / segments) * Math.PI * 2;
                
                let alpha = 0;
                let color = 'transparent';
                
                // Calculate angular distance from segAngle to angle (clockwise)
                let angularDistance = 0;
                if (segAngle <= angle) {
                    angularDistance = angle - segAngle;
                } else {
                    angularDistance = (Math.PI * 2 - segAngle) + angle;
                }
                
                // Normalize lightSize to be within one full rotation for display
                const displayLightSize = Math.min(lightSize, Math.PI * 2);
                
                // Check if segment is within the light tail
                if (angularDistance <= displayLightSize && angularDistance >= 0) {
                    // Position 0 = tail start (dim, behind), position 1 = front (bright, at angle)
                    // We want bright at front (1) and fade to dim at tail start (0)
                    const positionInTail = angularDistance / displayLightSize;
                    // Very smooth fade using ease-in-out curve
                    // Using smoother easing function for more natural fade
                    const t = positionInTail;
                    const fadeIntensity = t < 0.5 
                        ? 2 * t * t * (3 - 2 * t) // Smooth ease-in-out
                        : 1 - Math.pow(-2 * t + 2, 3) / 2; // Smooth ease-out
                    alpha = fadeIntensity;
                    
                    // Only purple color, intensity controlled by alpha
                    color = '#7C3AED';
                }
                
                // Calculate position on rounded rectangle border
                const getBorderPoint = (t: number) => {
                    const perimeter = 2 * (w + h) - 8 * radius + 2 * Math.PI * radius;
                    const pos = (t / (Math.PI * 2)) * perimeter;
                    let currentPos = 0;
                    
                    // Top edge
                    if (pos < w - 2 * radius) {
                        return { x: x + radius + pos, y: y };
                    }
                    currentPos += w - 2 * radius;
                    
                    // Top-right corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = -Math.PI / 2 + cornerPos / radius;
                        return {
                            x: x + w - radius + Math.cos(cornerAngle) * radius,
                            y: y + radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Right edge
                    if (pos < currentPos + h - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x + w, y: y + radius + edgePos };
                    }
                    currentPos += h - 2 * radius;
                    
                    // Bottom-right corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = cornerPos / radius;
                        return {
                            x: x + w - radius + Math.cos(cornerAngle) * radius,
                            y: y + h - radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Bottom edge
                    if (pos < currentPos + w - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x + w - radius - edgePos, y: y + h };
                    }
                    currentPos += w - 2 * radius;
                    
                    // Bottom-left corner
                    if (pos < currentPos + Math.PI * radius / 2) {
                        const cornerPos = pos - currentPos;
                        const cornerAngle = Math.PI / 2 + cornerPos / radius;
                        return {
                            x: x + radius + Math.cos(cornerAngle) * radius,
                            y: y + h - radius + Math.sin(cornerAngle) * radius
                        };
                    }
                    currentPos += Math.PI * radius / 2;
                    
                    // Left edge
                    if (pos < currentPos + h - 2 * radius) {
                        const edgePos = pos - currentPos;
                        return { x: x, y: y + h - radius - edgePos };
                    }
                    currentPos += h - 2 * radius;
                    
                    // Top-left corner
                    const cornerPos = pos - currentPos;
                    const cornerAngle = Math.PI + cornerPos / radius;
                    return {
                        x: x + radius + Math.cos(cornerAngle) * radius,
                        y: y + radius + Math.sin(cornerAngle) * radius
                    };
                };
                
                const point = getBorderPoint(segAngle);
                const nextPoint = getBorderPoint((i + 1) / segments * Math.PI * 2);
                
                ctx.strokeStyle = color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(nextPoint.x, nextPoint.y);
                ctx.stroke();
            }
            
            ctx.globalAlpha = 1;
            
            animationFrame = requestAnimationFrame(drawBorder);
        };

        drawBorder();

        const resizeObserver = new ResizeObserver(() => {
            updateCanvasSize();
        });
        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
        };
    }, []);


    return (
        <div className="sidebar-menu">
            {/* sidebar-header removed */}
            
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    // Для страницы депозита проверяем все связанные пути
                    const isDepositPage = item.path === "/deposit" && (
                        location.pathname === "/deposit" ||
                        location.pathname === "/withdraw" ||
                        location.pathname === "/transaction-history"
                    );
                    const isActive = location.pathname === item.path || isDepositPage;
                    const to = item.path;
                    const key = item.path;
                    const isCopyTrading = item.path === "/copy-trading";
                    
                    // Скрываем Copy Trading на других страницах (только на графике)
                    if (isCopyTrading) {
                        if (!isTradingPage) {
                            return null;
                        }
                        return (
                            <button
                                key={key}
                                onClick={() => dispatch(setTopPartnersMenuOpen(true))}
                                className={`sidebar-item ${isTopPartnersMenuOpen ? 'active panel-open' : ''}`}
                                title={item.title}
                            >
                                <img
                                    src={item.icon}
                                    alt=""
                                    className="sidebar-icon"
                                    aria-hidden="true"
                                />
                                <span className="sidebar-label">{item.label}</span>
                            </button>
                        );
                    }
                    
                    return (
                        <Link
                            key={key}
                            to={to}
                            className={`sidebar-item ${isActive ? "active" : ""}`}
                            title={item.title}
                            onMouseEnter={() => !isActive && prefetchOnHover(to)}
                            onMouseLeave={cancelPrefetch}
                            onFocus={() => !isActive && prefetchOnHover(to)}
                            onBlur={cancelPrefetch}
                        >
                            <img
                                src={item.icon}
                                alt=""
                                className="sidebar-icon"
                                aria-hidden="true"
                            />
                            <span className="sidebar-label">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                                <span className="sidebar-badge">{item.badge}</span>
                            )}
                            {item.path === "/bots" && !hasActiveBots && bots.length > 0 && (
                                <div className="sidebar-warning">
                                    <span>⚠️</span>
                                </div>
                            )}
                        </Link>
                    );
                })}
                {/* Скрываем Chat на других страницах (только на графике) */}
                {isTradingPage && (
                    <button
                        onClick={openChat}
                        className={`sidebar-item ${isChatOpen ? 'active panel-open' : ''}`}
                        title={t('menu.chatTitle')}
                        aria-label={t('menu.chat')}
                    >
                        <img
                            src={supportIcon}
                            alt=""
                            className="sidebar-icon"
                            aria-hidden="true"
                        />
                        <span className="sidebar-label">{t('menu.chat')}</span>
                        {unreadNotificationsCount > 0 && (
                            <span className="sidebar-badge">{unreadNotificationsCount}</span>
                        )}
                    </button>
                )}
                <div 
                    className="sidebar-bonus-block"
                    onClick={() => {
                        setIsBonusPopupOpen(true);
                        // Закрываем другие попапы и сайдбары
                        window.dispatchEvent(new CustomEvent('closeLanguageCurrencyModal'));
                        window.dispatchEvent(new CustomEvent('closeSidebars'));
                    }}
                >
                    <canvas ref={bonusCanvasRef} className="sidebar-bonus-canvas" />
                    <img src={bonusImage} alt="Bonus" className="sidebar-bonus-image" />
                </div>
            </nav>

            <div className="sidebar-footer">
                {/* Скрываем кнопки на других страницах (только на графике) */}
                {isTradingPage && (
                    <>
                        <div 
                            className={`sidebar-subscriptions-block ${isSubscriptionsMenuOpen ? 'panel-open' : ''}`}
                            onClick={() => dispatch(setSubscriptionsMenuOpen(true))}
                            title={t('copyTrading.tabSubscriptions', { defaultValue: 'Subscriptions' })}
                        >
                            <canvas ref={subscriptionsCanvasRef} className="sidebar-subscriptions-canvas" />
                            <div className="sidebar-subscriptions-content">
                                <svg 
                                    width="24" 
                                    height="24" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className="sidebar-subscriptions-icon"
                                    aria-hidden="true"
                                >
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                        </div>
                        <button
                            onClick={openChat}
                            className="sidebar-help"
                            title={t('menu.helpTitle')}
                            aria-label={t('menu.help')}
                        >
                            <span className="sidebar-help__dot" />
                            <span className="sidebar-help__label">{t('menu.help')}</span>
                        </button>
                    </>
                )}
            </div>

            <BonusPopup 
                isOpen={isBonusPopupOpen}
                onClose={() => setIsBonusPopupOpen(false)}
            />
        </div>
    );
});