import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import "./BotsPage.css";
import {getTelegramUser, initializeTelegramWebApp} from "@src/shared/lib/telegramUtils";
import {fetchBots, updateBotConfig} from "@src/entities/bots/model/slice.ts";
import {selectBots, selectBotsError, selectBotsLoading} from "@src/entities/bots/model/selectors.ts";
import {Bot, BotConfig} from "@src/entities/bots/model/types.ts";
import { useNavigate } from "react-router-dom";
import {useLanguage} from "@src/app/providers/useLanguage.ts";
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

export function BotsPage() {
    const dispatch = useAppDispatch();
    const bots = useAppSelector(selectBots);
    const loading = useAppSelector(selectBotsLoading);
    const error = useAppSelector(selectBotsError);
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'my-bots' | 'payment'>('my-bots');
    const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editConfig, setEditConfig] = useState<BotConfig>({
        tradingPair: "",
        riskLevel: "",
        maxTradeAmount: 0,
    });
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [telegramUser, setTelegramUser] = useState<{
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
    } | null>(null);

    const allBotsDeactivated = bots.length > 0 && bots.every(bot => bot.status === 'DEACTIVATED');
    const telegramUsername = telegramUser?.username;

    useEffect(() => {
        const isTelegramInitialized = initializeTelegramWebApp();

        if (isTelegramInitialized) {
            const userData = getTelegramUser();
            if (userData) {
                setTelegramUser({
                    id: userData.id,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    username: userData.username,
                });
                dispatch(fetchBots());
            } else {

                dispatch(fetchBots());
            }
        } else {

            dispatch(fetchBots());
        }
    }, [dispatch]);

    useEffect(() => {
        if (selectedBot?.config) {
            setEditConfig({
                tradingPair: selectedBot.config.tradingPair || "BTC/USDT",
                riskLevel: selectedBot.config.riskLevel || "medium",
                maxTradeAmount: selectedBot.config.maxTradeAmount || 1000,
            });
        }
    }, [selectedBot]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleSave = async () => {
        if (!selectedBot) return;

        try {
            await dispatch(
                updateBotConfig({
                    botId: Number(selectedBot.id),
                    configData: editConfig,
                })
            ).unwrap();

            setIsEditing(false);
            setNotification({ type: 'success', message: t('bots.configUpdated') });
        } catch (err) {
            setNotification({ type: 'error', message: t('bots.configError') });

        }
    };

    const handlePayment = () => {
        setNotification({ type: 'success', message: t('bots.redirectingPayment') });
        navigate('/profile');
    };

    if (loading) {
        return (
            <MobileMenuProvider>
                <SidebarProvider>
                    <div className="wrapper-body">
                        <TradingHeader />
                        <div className="app-layout-wrapper">
                            <Sidebar />
                            <div className="page-content">
                                <div className="bots-page wrapper-page">
                                    <div className="bots-loading">
                                        <div className="loading-spinner large"></div>
                                        <p>{t('bots.loading')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SidebarProvider>
            </MobileMenuProvider>
        );
    }

    if (error) {
        return (
            <MobileMenuProvider>
                <SidebarProvider>
                    <div className="wrapper-body">
                        <TradingHeader />
                        <div className="app-layout-wrapper">
                            <Sidebar />
                            <div className="page-content">
                                <div className="bots-page wrapper-page">
                                    <div className="bots-error">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                                                stroke="#FF0000"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <h3>{t('bots.errorTitle')}</h3>
                                        <p>{error}</p>
                                        <button
                                            className="retry-btn"
                                            onClick={() => {
                                                dispatch(fetchBots());
                                            }}
                                        >
                                            {t('common.tryAgain')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SidebarProvider>
            </MobileMenuProvider>
        );
    }

    return (
        <MobileMenuProvider>
            <SidebarProvider>
                <div className="wrapper-body">
                    <TradingHeader />
                    <div className="app-layout-wrapper">
                        <Sidebar />
                        <div className="page-content">
                            <div className="bots-page wrapper-page">
            <div className="bots-header">
                <div className="bots-title-section">
                    <h1 className="bots-title">{t('bots.title')}</h1>
                    <p className="bots-subtitle">{t('bots.subtitle')}</p>
                </div>
                {telegramUsername && (
                    <div className="telegram-user-info">
                        <span className="user-username">@{telegramUsername}</span>
                    </div>
                )}
            </div>

            {notification && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)}>×</button>
                </div>
            )}

            <div className="bots-tabs">
                <button
                    className={`tab-button ${activeTab === 'my-bots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-bots')}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M12 11C13.6569 11 15 9.65685 15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8C9 9.65685 10.3431 11 12 11Z"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                        <path
                            d="M17 18C17 15.2386 14.7614 13 12 13C9.23858 13 7 15.2386 7 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                    {t('bots.myBots')}
                </button>

                {allBotsDeactivated && (
                    <button
                        className={`tab-button ${activeTab === 'payment' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payment')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M2 8.50563H22M6 16.5056H8M10.5 16.5056H14.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            <rect x="2" y="4.50562" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        {t('bots.paymentTab')}
                    </button>
                )}
            </div>

            <div className="bots-content">
                {activeTab === 'my-bots' && (
                    <div className="bots-grid">
                        {bots.map((bot) => (
                            <div key={bot.id} className="bot-card">
                                <div className="card-header">
                                    <h3 className="bot-name">{bot.name}</h3>
                                    <div className={`bot-status ${bot.status}`}>
                                        <span className="status-dot"></span>
                                        {bot.status === 'ACTIVATED'
                                            ? t('bots.status.active')
                                            : bot.status === 'DEACTIVATED'
                                                ? t('bots.status.deactivated')
                                                : t('bots.status.processing')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'payment' && (
                    <div className="payment-content">
                        <div className="payment-header">
                            <h2>{t('bots.activationTitle')}</h2>
                            <p>{t('bots.activationDescription')}</p>
                        </div>

                        <div className="payment-options">
                            <div className="payment-option">
                                <h3>{t('bots.monthlySubscription')}</h3>
                                <div className="price">$50.00/month</div>
                                <ul className="features">
                                    <li>✓ {t('bots.features.allBots')}</li>
                                    <li>✓ {t('bots.features.support')}</li>
                                    <li>✓ {t('bots.features.updates')}</li>
                                </ul>
                                <button className="pay-button" onClick={handlePayment}>
                                    {t('bots.payButton')}
                                </button>
                            </div>

                            <div className="payment-option recommended">
                                <div className="recommended-badge">{t('bots.recommended')}</div>
                                <h3>{t('bots.annualSubscription')}</h3>
                                <div className="price">$149.99/half year</div>
                                <div className="savings">{t('bots.savings', { amount: '$150.01' })}</div>
                                <ul className="features">
                                    <li>✓ {t('bots.features.allBots')}</li>
                                    <li>✓ {t('bots.features.prioritySupport')}</li>
                                    <li>✓ {t('bots.features.priorityAI')}</li>
                                    <li>✓ {t('bots.features.coinsGift', { amount: '200' })}</li>
                                </ul>
                                <button className="pay-button primary" onClick={handlePayment}>
                                    {t('bots.payButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedBot && isEditing && (
                <div className="bot-modal">
                    <div className="modal-content">
                        <h2>{t('bots.configureTitle', { botName: selectedBot.name })}</h2>
                        <div className="config-form">
                            <div className="info-group">
                                <label>{t('bots.tradingPair')}</label>
                                <input
                                    type="text"
                                    value={editConfig.tradingPair}
                                    onChange={(e) =>
                                        setEditConfig({ ...editConfig, tradingPair: e.target.value })
                                    }
                                    className="edit-input"
                                    placeholder={t('bots.enterTradingPair')}
                                />
                            </div>
                            <div className="info-group">
                                <label>{t('bots.riskLevel')}</label>
                                <select
                                    value={editConfig.riskLevel}
                                    onChange={(e) =>
                                        setEditConfig({ ...editConfig, riskLevel: e.target.value })
                                    }
                                    className="edit-input"
                                >
                                    <option value="low">{t('bots.lowRisk')}</option>
                                    <option value="medium">{t('bots.mediumRisk')}</option>
                                    <option value="high">{t('bots.highRisk')}</option>
                                </select>
                            </div>
                            <div className="info-group">
                                <label>{t('bots.maxTradeAmount')}</label>
                                <input
                                    type="number"
                                    value={editConfig.maxTradeAmount}
                                    onChange={(e) =>
                                        setEditConfig({
                                            ...editConfig,
                                            maxTradeAmount: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                    className="edit-input"
                                    placeholder={t('bots.enterTradeAmount')}
                                />
                            </div>
                        </div>
                        <div className="card-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => {
                                    setIsEditing(false);
                                    setSelectedBot(null);
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button className="save-btn" onClick={handleSave}>
                                {t('common.saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
                            </div>
                        </div>
                    </div>
                    <Header />
                </div>
            </SidebarProvider>
        </MobileMenuProvider>
    );
}