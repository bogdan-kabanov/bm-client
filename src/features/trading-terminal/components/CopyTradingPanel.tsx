import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { copyTradingApi, type CopyTradingTopTrader } from '@src/shared/api';
import { formatTraderCodeForDisplay } from '@src/shared/lib/traderCodeUtils';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import top1Icon from '@src/assets/TOP1.svg';
import top2Icon from '@src/assets/TOP2.svg';
import top3Icon from '@src/assets/TOP3.svg';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { 
  selectCopyTradingSubscriptions, 
  selectCopyTradingLoading, 
  selectCopyTradingError, 
  selectCopyTradingSuccess 
} from '@src/entities/copy-trading-signals/model/selectors';
import { 
  setSubscriptions, 
  setLoading, 
  setError, 
  setSuccess 
} from '@src/entities/copy-trading-signals/model/slice';
import type { CopySubscriptionItem } from '@src/entities/copy-trading-signals/model/types';
import './ChatPanel.css';
import './CopyTradingPanel.css';

interface CopyTradingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export const CopyTradingPanel: React.FC<CopyTradingPanelProps> = ({ isOpen, onClose, t }) => {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const userCurrency = profile?.currency || 'USD';
  
  const copySubscriptions = useAppSelector(selectCopyTradingSubscriptions);
  const isCopyLoading = useAppSelector(selectCopyTradingLoading);
  const copyError = useAppSelector(selectCopyTradingError);
  const copySuccess = useAppSelector(selectCopyTradingSuccess);
  
  const [copyCodeInput, setCopyCodeInput] = useState('');
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'leaderboard'>('leaderboard');
  const [topTraders, setTopTraders] = useState<CopyTradingTopTrader[]>([]);
  const [selectedTopTrader, setSelectedTopTrader] = useState<CopyTradingTopTrader | null>(null);
  const [isTopTradersLoading, setIsTopTradersLoading] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionSettings, setSubscriptionSettings] = useState({
    balancePercent: '',
    dailyLimitAmount: '',
    dailyLimitEnabled: false,
  });
  const hasFetchedCopyDataRef = useRef(false);
  const subscriptionsListRef = useRef<HTMLDivElement>(null);

  const mapSubscriptionResponse = useCallback((raw: any): CopySubscriptionItem => {
    const subscription = raw?.subscription ?? {};
    const trader = raw?.trader ?? {};
    const profileData = raw?.profile ?? {};
    const stats = raw?.stats ?? {};

    const nameParts = [trader.firstname, trader.lastname].filter(Boolean);
    const traderName = nameParts.length
      ? nameParts.join(' ')
      : trader.email || `${t('copyTrading.traderDefault')}${formatTraderCodeForDisplay(subscription.trader_user_id ?? '')}`;

    return {
      id: subscription.id,
      traderUserId: subscription.trader_user_id,
      traderName,
      code: profileData.code ? formatTraderCodeForDisplay(profileData.code) : formatTraderCodeForDisplay(subscription.trader_user_id ?? ''),
      isActive: Boolean(subscription.is_active),
      totalCopiedTrades: Number(stats.totalCopiedTrades ?? 0),
      totalProfit: Number(stats.totalProfit ?? 0),
      totalVolume: Number(stats.totalVolume ?? 0),
      activeCopiedTrades: Number(stats.activeCopiedTrades ?? 0),
      lastCopiedAt: stats.lastCopiedAt ?? null,
    };
  }, [t]);

  const fetchCopySubscriptions = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await copyTradingApi.listSubscriptions();
      const mapped = Array.isArray(response) ? response.map(mapSubscriptionResponse) : [];
      dispatch(setSubscriptions(mapped));
      if (mapped.length > 0 && !activeSubscriptionId) {
        setActiveSubscriptionId(mapped[0].id);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'SESSION_EXPIRED') {
          return;
        }
        const errorMessage = error.message || t('copyTrading.failedToLoadSubscriptions');
        dispatch(setError(errorMessage.includes('NOT_FOUND') ? t('copyTrading.traderIdNotFound') : errorMessage));
      } else {
        dispatch(setError(t('copyTrading.failedToLoadSubscriptions')));
      }
    } finally {
      dispatch(setLoading(false));
      hasFetchedCopyDataRef.current = true;
    }
  }, [t, dispatch, mapSubscriptionResponse, activeSubscriptionId]);

  const handleCopyCodeSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!copyCodeInput.trim()) {
      return;
    }

    // For code input, subscribe with default settings (no form)
    dispatch(setLoading(true));
    dispatch(setError(null));
    dispatch(setSuccess(null));
    try {
      await copyTradingApi.createSubscription(copyCodeInput.trim());
      setCopyCodeInput('');
      dispatch(setSuccess(t('copyTrading.subscriptionActivated')));
      await fetchCopySubscriptions();
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message || t('copyTrading.failedToAddCode');
        dispatch(setError(errorMessage.includes('NOT_FOUND') ? t('copyTrading.traderIdNotFound') : errorMessage));
      } else {
        dispatch(setError(t('copyTrading.failedToAddCode')));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleSubscribeWithSettings = async (code: string, traderUserId?: number) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    dispatch(setSuccess(null));
    try {
      await copyTradingApi.createSubscription(
        formatTraderCodeForDisplay(code),
        traderUserId,
        {
          copyMode: subscriptionSettings.balancePercent ? 'balance_percent' : 'mirror',
          balancePercent: subscriptionSettings.balancePercent ? parseFloat(subscriptionSettings.balancePercent) : undefined,
          dailyLimitAmount: subscriptionSettings.dailyLimitEnabled && subscriptionSettings.dailyLimitAmount 
            ? parseFloat(subscriptionSettings.dailyLimitAmount) 
            : undefined,
          dailyLimitEnabled: subscriptionSettings.dailyLimitEnabled,
        }
      );
      dispatch(setSuccess(t('copyTrading.subscriptionActivated')));
      setShowSubscriptionForm(false);
      setSelectedTopTrader(null);
      await fetchCopySubscriptions();
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message || t('copyTrading.failedToAddCode');
        dispatch(setError(errorMessage.includes('NOT_FOUND') ? t('copyTrading.traderIdNotFound') : errorMessage));
      } else {
        dispatch(setError(t('copyTrading.failedToAddCode')));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleToggleSubscription = async (subscriptionId: number, nextState: boolean) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    dispatch(setSuccess(null));
    try {
      await copyTradingApi.toggleSubscription(subscriptionId, nextState);
      dispatch(setSuccess(nextState ? t('copyTrading.subscriptionEnabled') : t('copyTrading.subscriptionDisabled')));
      await fetchCopySubscriptions();
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message || t('copyTrading.failedToChangeStatus');
        dispatch(setError(errorMessage.includes('NOT_FOUND') ? t('copyTrading.traderIdNotFound') : errorMessage));
      } else {
        dispatch(setError(t('copyTrading.failedToChangeStatus')));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleRemoveSubscription = async (subscriptionId: number) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    dispatch(setSuccess(null));
    try {
      await copyTradingApi.deleteSubscription(subscriptionId);
      dispatch(setSuccess(t('copyTrading.subscriptionRemoved')));
      if (activeSubscriptionId === subscriptionId) {
        const remaining = copySubscriptions.filter(s => s.id !== subscriptionId);
        setActiveSubscriptionId(remaining.length > 0 ? remaining[0].id : null);
      }
      await fetchCopySubscriptions();
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message || t('copyTrading.failedToRemove');
        dispatch(setError(errorMessage.includes('NOT_FOUND') ? t('copyTrading.traderIdNotFound') : errorMessage));
      } else {
        dispatch(setError(t('copyTrading.failedToRemove')));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const fetchTopTraders = useCallback(async () => {
    setIsTopTradersLoading(true);
    try {
      const traders = await copyTradingApi.getTopTraders(20);
      console.log('[CopyTradingPanel] Fetched top traders:', traders);
      setTopTraders(Array.isArray(traders) ? traders : []);
    } catch (error) {
      console.error('[CopyTradingPanel] Error loading top traders:', error);
      setTopTraders([]);
    } finally {
      setIsTopTradersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !hasFetchedCopyDataRef.current) {
      fetchCopySubscriptions();
    }
  }, [isOpen, fetchCopySubscriptions]);

  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
      fetchTopTraders();
    }
  }, [isOpen, activeTab, fetchTopTraders]);

  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => dispatch(setSuccess(null)), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess, dispatch]);

  const formatCopyDate = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleString();
    } catch (error) {
      return value;
    }
  };

  const activeSubscription = copySubscriptions.find(s => s.id === activeSubscriptionId) || null;
  // Не показываем детальный вид для подписок
  const isDetailViewVisible = false;
  // Полноэкранный вид для выбранного партнера из leaderboard
  const isFullscreenDetailView = activeTab === 'leaderboard' && selectedTopTrader;

  return (
    <aside
      className={`chat-panel copy-trading-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label={t('copyTrading.tradingSignals')}
      style={{
        width: 'clamp(300px, 27.5vw, 450px)'
      }}
    >
      <div className="chat-panel__header">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="chat-panel__title">
              <h3>{t('copyTrading.tradingSignals')}</h3>
            </div>
            <button
              type="button"
              className="chat-panel__close"
              onClick={onClose}
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => {
                setActiveTab('leaderboard');
                setActiveSubscriptionId(null);
              }}
              style={{
                padding: '6px 12px',
                background: activeTab === 'leaderboard' ? '#2d3748' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: activeTab === 'leaderboard' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '11px',
                fontWeight: activeTab === 'leaderboard' ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'leaderboard') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'leaderboard') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              {t('copyTrading.tabLeaderboard')}
            </button>
            <button
              onClick={() => {
                setActiveTab('subscriptions');
                setSelectedTopTrader(null);
              }}
              style={{
                padding: '6px 12px',
                background: activeTab === 'subscriptions' ? '#2d3748' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: activeTab === 'subscriptions' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '11px',
                fontWeight: activeTab === 'subscriptions' ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'subscriptions') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'subscriptions') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              {t('copyTrading.tabSubscriptions')}
            </button>
          </div>
        </div>
      </div>

      <div className={`chat-panel__body ${isDetailViewVisible ? 'has-detail-view' : ''} ${isFullscreenDetailView ? 'has-fullscreen-detail' : ''}`}>
        {!isFullscreenDetailView && (
          <div className="chat-panel__tickets-sidebar">
            <div className="chat-panel__tickets-header">
              {activeTab === 'subscriptions' && (
                <>
                  <h4>{t('copyTrading.mySubscriptions')}</h4>
                  <form onSubmit={handleCopyCodeSubmit} style={{ display: 'flex', gap: '8px', marginTop: '8px', width: '100%', boxSizing: 'border-box' }}>
                    <input
                      type="text"
                      placeholder={t('copyTrading.enterTraderCode')}
                      value={copyCodeInput}
                      onChange={(e) => setCopyCodeInput(e.target.value)}
                      disabled={isCopyLoading}
                      className="chat-panel__message-input"
                      style={{ flex: 1, margin: 0, minWidth: 0 }}
                    />
                    <button 
                      type="submit" 
                      disabled={isCopyLoading}
                      className="chat-panel__send-btn"
                      style={{ margin: 0, flexShrink: 0 }}
                    >
                      {isCopyLoading ? t('copyTrading.waitButton') : '+'}
                    </button>
                  </form>
                </>
              )}
              {activeTab === 'leaderboard' && (
                <h4>{t('copyTrading.leaderboardTitle')}</h4>
              )}
            </div>
            {copyError && activeTab === 'subscriptions' && (
              <div style={{ padding: '8px 12px', background: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', fontSize: '12px', margin: '8px' }}>
                {copyError}
              </div>
            )}
            {copySuccess && activeTab === 'subscriptions' && (
              <div style={{ padding: '8px 12px', background: 'rgba(0, 255, 0, 0.1)', color: '#51cf66', fontSize: '12px', margin: '8px' }}>
                {copySuccess}
              </div>
            )}
            <div className="chat-panel__tickets-list" ref={subscriptionsListRef}>
            {activeTab === 'subscriptions' ? (
              copySubscriptions.length > 0 ? (
                copySubscriptions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveSubscriptionId(item.id)}
                    className={`chat-panel__ticket-item ${item.id === activeSubscriptionId ? 'active' : ''} ${!item.isActive ? 'inactive' : ''}`}
                    style={{
                      padding: '12px',
                      borderRadius: '0',
                      border: item.id === activeSubscriptionId 
                        ? '1px solid rgba(108, 144, 255, 0.3)' 
                        : !item.isActive 
                          ? '1px solid rgba(255, 255, 255, 0.05)' 
                          : '1px solid transparent',
                      background: item.id === activeSubscriptionId 
                        ? 'rgba(108, 144, 255, 0.1)' 
                        : !item.isActive 
                          ? 'rgba(255, 255, 255, 0.02)' 
                          : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: !item.isActive ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (item.id !== activeSubscriptionId) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (item.id !== activeSubscriptionId) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <div className="chat-panel__ticket-subject" style={{ 
                        marginBottom: '4px', 
                        fontWeight: 600,
                        color: !item.isActive ? 'rgba(255, 255, 255, 0.5)' : '#fff',
                      }}>
                        {item.traderName}
                      </div>
                      <div className="chat-panel__ticket-status" style={{ fontSize: '10px', marginBottom: '6px' }}>
                        {t('copyTrading.codeLabel')}{item.code} • {item.isActive ? (
                          <span style={{ color: '#51cf66' }}>{t('copyTrading.on')}</span>
                        ) : (
                          <span style={{ color: '#ff6b6b' }}>{t('copyTrading.off')}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                        <span>{t('copyTrading.tradesLabel')}{item.totalCopiedTrades}</span>
                        <span style={{ color: item.totalProfit >= 0 ? '#51cf66' : '#ff6b6b' }}>
                          {t('copyTrading.profitLabel')}{item.totalProfit >= 0 ? '+' : ''}{formatCurrency(item.totalProfit, userCurrency)}
                        </span>
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      alignItems: 'flex-end',
                      flexShrink: 0,
                      marginLeft: '12px',
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSubscription(item.id, !item.isActive);
                        }}
                        disabled={isCopyLoading}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ff6b6b',
                          cursor: isCopyLoading ? 'not-allowed' : 'pointer',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          opacity: isCopyLoading ? 0.5 : 1,
                          transition: 'opacity 0.2s',
                          textAlign: 'right',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCopyLoading) {
                            e.currentTarget.style.opacity = '0.7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCopyLoading) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                      >
                        {item.isActive ? t('copyTrading.disable') : t('copyTrading.enable')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmMessage = t('copyTrading.removeTitle') || 'Are you sure you want to remove the subscription?';
                          if (window.confirm(confirmMessage)) {
                            handleRemoveSubscription(item.id);
                          }
                        }}
                        disabled={isCopyLoading}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ff6b6b',
                          cursor: isCopyLoading ? 'not-allowed' : 'pointer',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          opacity: isCopyLoading ? 0.5 : 1,
                          transition: 'opacity 0.2s',
                          textAlign: 'right',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCopyLoading) {
                            e.currentTarget.style.opacity = '0.7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCopyLoading) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                      >
                        {t('copyTrading.remove')}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                  {t('copyTrading.noActiveSubscriptions')}
                </div>
              )
            ) : activeTab === 'leaderboard' ? (
              isTopTradersLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                  {t('copyTrading.loading') || 'Loading...'}
                </div>
              ) : topTraders.length > 0 ? (
                topTraders.map((trader, index) => (
                  <div
                    key={trader.traderUserId || trader.code}
                    onClick={() => {
                      // Toggle: если кликаем на уже выбранного партнера, закрываем детальную информацию
                      if (selectedTopTrader?.code === trader.code) {
                        setSelectedTopTrader(null);
                      } else {
                        setSelectedTopTrader(trader);
                      }
                    }}
                    className={`chat-panel__ticket-item ${selectedTopTrader?.code === trader.code ? 'active' : ''}`}
                    style={{
                      padding: '12px',
                      borderRadius: '0',
                      border: selectedTopTrader?.code === trader.code ? '1px solid rgba(108, 144, 255, 0.3)' : '1px solid transparent',
                      background: selectedTopTrader?.code === trader.code ? 'rgba(108, 144, 255, 0.1)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTopTrader?.code !== trader.code) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTopTrader?.code !== trader.code) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: index < 3 ? '#ffd700' : '#fff' }}>
                        #{index + 1}
                      </span>
                      <div className="chat-panel__ticket-subject" style={{ marginBottom: 0, fontWeight: 600 }}>
                        {trader.traderName}
                      </div>
                    </div>
                    <div className="chat-panel__ticket-status" style={{ fontSize: '10px', marginBottom: '6px' }}>
                      {t('copyTrading.codeLabel')}{trader.code}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      <span>{t('copyTrading.subscribers') || 'Subscribers'}: {trader.subscribersCount}</span>
                      <span style={{ color: trader.totalProfit >= 0 ? '#51cf66' : '#ff6b6b' }}>
                        {t('copyTrading.profitLabel')}{trader.totalProfit >= 0 ? '+' : ''}{formatCurrency(trader.totalProfit, userCurrency)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                  {t('copyTrading.leaderboardEmpty')}
                </div>
              )
            ) : null}
          </div>
        </div>
        )}
        
        {/* Полноэкранный вид для выбранного партнера из leaderboard */}
        {isFullscreenDetailView && selectedTopTrader && !showSubscriptionForm && (
          <div className="chat-panel__fullscreen-detail">
            <div className="chat-panel__fullscreen-header">
              <button
                type="button"
                onClick={() => setSelectedTopTrader(null)}
                className="back-button"
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>{t('common.back')}</span>
              </button>
              <h3>{selectedTopTrader.traderName}</h3>
              <div style={{ width: '100px' }}></div>
            </div>
            <div className="chat-panel__fullscreen-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '100%', margin: '0 auto', width: '100%' }}>
                <div className="info-card">
                  <div className="info-card-label">
                    {t('copyTrading.codeLabel')}
                  </div>
                  <div className="info-card-value info-card-code">
                    {formatTraderCodeForDisplay(selectedTopTrader.code)}
                  </div>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                  gap: '8px' 
                }}>
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.subscribers') || 'Subscribers'}
                    </div>
                    <div className="info-card-value">
                      {selectedTopTrader.subscribersCount}
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.activeSubscribers') || 'Active subscribers'}
                    </div>
                    <div className="info-card-value">
                      {selectedTopTrader.activeSubscribers}
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.profitLabel')}
                    </div>
                    <div className={`info-card-value ${selectedTopTrader.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                      {selectedTopTrader.totalProfit >= 0 ? '+' : ''}{formatCurrency(selectedTopTrader.totalProfit, userCurrency)}
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.volumeShort')}
                    </div>
                    <div className="info-card-value">
                      {formatCurrency(selectedTopTrader.totalVolume, userCurrency)}
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.tradesLabel')}
                    </div>
                    <div className="info-card-value">
                      {selectedTopTrader.totalTrades}
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.status') || 'Status'}
                    </div>
                    <div className={`info-card-value ${selectedTopTrader.isProfileActive ? 'positive' : ''}`} style={!selectedTopTrader.isProfileActive ? { color: 'rgba(255, 255, 255, 0.4)' } : {}}>
                      {selectedTopTrader.isProfileActive ? (t('copyTrading.on') || 'Active') : (t('copyTrading.off') || 'Inactive')}
                    </div>
                  </div>
                </div>
                
                {selectedTopTrader.lastCopiedAt && (
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.lastCopied')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
                      {formatCopyDate(selectedTopTrader.lastCopiedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Temporarily hidden */}
            {false && (
            <div className="chat-panel__fullscreen-actions">
              <button
                onClick={() => {
                  // Temporarily disabled
                  dispatch(setError('Copy trading is temporarily disabled'));
                  return;
                  setSubscriptionSettings({
                    balancePercent: '',
                    dailyLimitAmount: '',
                    dailyLimitEnabled: false,
                  });
                  setShowSubscriptionForm(true);
                }}
                disabled={true}
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: '8px 16px',
                  background: 'rgba(74, 144, 226, 0.2)',
                  border: '1px solid rgba(74, 144, 226, 0.4)',
                  borderRadius: '6px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'not-allowed',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  opacity: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}
              >
                {t('copyTrading.connectButton') || 'Connect'}
              </button>
            </div>
            )}
          </div>
        )}
        
        {/* Subscription Settings Form вместо детальной информации */}
        {isFullscreenDetailView && selectedTopTrader && showSubscriptionForm && (
          <div className="chat-panel__fullscreen-detail">
            <div className="chat-panel__fullscreen-header">
              <button
                type="button"
                onClick={() => setShowSubscriptionForm(false)}
                className="back-button"
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>{t('common.back')}</span>
              </button>
              <h3>{t('copyTrading.subscriptionSettings') || 'Subscription Settings'}</h3>
              <div style={{ width: '100px' }}></div>
            </div>
            <div className="chat-panel__fullscreen-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
                <div className="info-card">
                  <div className="info-card-label">
                    {t('copyTrading.balancePercent') || 'Balance Percentage (%)'}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={subscriptionSettings.balancePercent}
                    onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, balancePercent: e.target.value })}
                    placeholder="e.g. 10"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      marginTop: '8px',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '6px' }}>
                    {t('copyTrading.balancePercentHint') || 'Percentage of your balance to use for copying trades (0-100%)'}
                  </div>
                </div>

                <div className="info-card">
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    color: 'rgba(255, 255, 255, 0.7)', 
                    marginBottom: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={subscriptionSettings.dailyLimitEnabled}
                      onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, dailyLimitEnabled: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {t('copyTrading.dailyLimit') || 'Set Daily Limit'}
                  </label>
                  {subscriptionSettings.dailyLimitEnabled && (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={subscriptionSettings.dailyLimitAmount}
                        onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, dailyLimitAmount: e.target.value })}
                        placeholder={`e.g. 100 ${userCurrency}`}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          marginTop: '8px',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '6px' }}>
                        {t('copyTrading.dailyLimitHint') || 'Maximum amount per day (e.g., 10% up to $100 per day)'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="chat-panel__fullscreen-actions">
              <button
                onClick={async () => {
                  await handleSubscribeWithSettings(
                    selectedTopTrader.code,
                    selectedTopTrader.traderUserId > 0 ? selectedTopTrader.traderUserId : undefined
                  );
                  setShowSubscriptionForm(false);
                  if (activeTab === 'leaderboard') {
                    setActiveTab('subscriptions');
                  }
                }}
                disabled={isCopyLoading}
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: '8px 16px',
                  background: 'rgba(74, 144, 226, 0.2)',
                  border: '1px solid rgba(74, 144, 226, 0.4)',
                  borderRadius: '6px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'not-allowed',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  opacity: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}
              >
                {t('copyTrading.subscribe') || 'Subscribe'}
              </button>
            </div>
          </div>
        )}
        
      </div>
    </aside>
  );
};

