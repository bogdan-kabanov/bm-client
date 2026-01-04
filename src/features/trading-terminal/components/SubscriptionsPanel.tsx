import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@src/app/providers/useLanguage';
import { copyTradingApi } from '@src/shared/api';
import { formatTraderCodeForDisplay } from '@src/shared/lib/traderCodeUtils';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { selectTradingMode } from '@src/entities/trading/model/selectors';
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

interface SubscriptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export const SubscriptionsPanel: React.FC<SubscriptionsPanelProps> = ({ isOpen, onClose, t }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const profile = useAppSelector(selectProfile);
  const tradingMode = useAppSelector(selectTradingMode);
  const userCurrency = profile?.currency || 'USD';
  
  const copySubscriptions = useAppSelector(selectCopyTradingSubscriptions);
  const isCopyLoading = useAppSelector(selectCopyTradingLoading);
  const copyError = useAppSelector(selectCopyTradingError);
  const copySuccess = useAppSelector(selectCopyTradingSuccess);
  
  const [copyCodeInput, setCopyCodeInput] = useState('');
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'myCard'>('subscriptions');
  const [traderCodeCopied, setTraderCodeCopied] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const hasFetchedCopyDataRef = useRef(false);
  const subscriptionsListRef = useRef<HTMLDivElement>(null);

  // Проверки для отображения сообщений
  const isDemoMode = tradingMode === 'demo';
  const balance = Number(profile?.balance || 0);
  const hasZeroBalance = balance === 0;

  const handleCopyTraderCode = useCallback(async () => {
    if (!profile?.id) return;
    
    const traderCode = formatTraderCodeForDisplay(profile.id);
    try {
      await navigator.clipboard.writeText(traderCode);
      setTraderCodeCopied(true);
      setTimeout(() => setTraderCodeCopied(false), 2000);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = traderCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setTraderCodeCopied(true);
        setTimeout(() => setTraderCodeCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
      document.body.removeChild(textArea);
    }
  }, [profile?.id]);

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

  useEffect(() => {
    if (isOpen && !hasFetchedCopyDataRef.current) {
      fetchCopySubscriptions();
    }
  }, [isOpen, fetchCopySubscriptions]);

  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => dispatch(setSuccess(null)), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess, dispatch]);

  // Переключаем на вкладку subscriptions, если myCard выбрана, но profile?.id отсутствует
  useEffect(() => {
    if (activeTab === 'myCard' && !profile?.id) {
      setActiveTab('subscriptions');
    }
  }, [activeTab, profile?.id]);

  return (
    <aside
      className={`chat-panel copy-trading-panel subscriptions-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label={t('copyTrading.tabSubscriptions')}
    >
      <div className="chat-panel__header">
        <div className="chat-panel__header-wrapper">
          <div className="chat-panel__header-row">
            <div className="chat-panel__title">
              <h3>{t('copyTrading.tabSubscriptions')}</h3>
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
          <div className="chat-panel__tabs">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`chat-panel__tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
            >
              {t('copyTrading.tabSubscriptions')}
            </button>
            {profile?.id && (
              <button
                onClick={() => setActiveTab('myCard')}
                className={`chat-panel__tab-button ${activeTab === 'myCard' ? 'active' : ''}`}
              >
                {t('copyTrading.tabMyCard')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="chat-panel__body">
        <div className="chat-panel__tickets-sidebar">
          {/* Сообщение для демо счета в табе Подписки */}
          {activeTab === 'subscriptions' && isDemoMode && (
            <div className="chat-panel__info-message">
              <div className="chat-panel__info-message-text">
                {t('copyTrading.unavailableOnDemo')}
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const saved = localStorage.getItem('tradingMode');
                  if (saved !== 'manual') {
                    localStorage.setItem('tradingMode', 'manual');
                    window.dispatchEvent(new CustomEvent<'manual' | 'demo'>('tradingModeChange', { detail: 'manual' }));
                    window.location.reload();
                  }
                }}
                className="chat-panel__info-message-link"
              >
                {t('copyTrading.switchToReal')}
              </a>
            </div>
          )}
          {/* Сообщение для нулевого баланса в табе Подписки */}
          {activeTab === 'subscriptions' && !isDemoMode && hasZeroBalance && (
            <div className="chat-panel__info-message">
              <div className="chat-panel__info-message-text">
                {t('copyTrading.zeroBalance')}
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/deposit');
                  onClose();
                }}
                className="chat-panel__info-message-link"
              >
                {t('copyTrading.topUpBalance')}
              </a>
            </div>
          )}
          {copyError && activeTab === 'subscriptions' && (
            <div className="chat-panel__error-message">
              {copyError}
            </div>
          )}
          {copySuccess && activeTab === 'subscriptions' && (
            <div className="chat-panel__success-message">
              {copySuccess}
            </div>
          )}
          <div className="chat-panel__tickets-list" ref={subscriptionsListRef}>
            {activeTab === 'myCard' ? (
              <div className="chat-panel__my-card-content">
                {/* Блок с кодом трейдера */}
                {profile?.id && (
                  <div 
                    onClick={handleCopyTraderCode}
                    className={`chat-panel__trader-code-card ${traderCodeCopied ? 'copied' : ''}`}
                    title={traderCodeCopied ? t('common.copied') : t('common.copy')}
                  >
                    <span className="chat-panel__trader-code-text">
                      {formatTraderCodeForDisplay(profile.id)}
                    </span>
                    <span className={`chat-panel__trader-code-icon ${traderCodeCopied ? 'copied' : ''}`}>
                      {traderCodeCopied ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M20 6L9 17L4 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M16 8V5C16 3.89543 15.1046 3 14 3H5C3.89543 3 3 3.89543 3 5V14C3 15.1046 3.89543 16 5 16H8M10 8H19C20.1046 8 21 8.89543 21 10V19C21 20.1046 20.1046 21 19 21H10C8.89543 21 8 20.1046 8 19V10C8 8.89543 8.89543 8 10 8Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </div>
                )}
                
                <div className="chat-panel__description-card">
                  <div className="chat-panel__description-text">
                    {t('copyTrading.myCardDescription')}
                  </div>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowHowItWorks(!showHowItWorks);
                    }}
                    className="chat-panel__description-link"
                  >
                    {t('copyTrading.howItWorks')}
                  </a>
                </div>
                
                {/* Раскрывающаяся карточка "How it works" */}
                <div className={`chat-panel__how-it-works-card ${showHowItWorks ? '' : 'hidden'}`}>
                  <div className="chat-panel__how-it-works-text">
                    {t('copyTrading.howItWorksDescription')}
                  </div>
                </div>
                {isDemoMode && (
                  <div className="chat-panel__info-message">
                    <div className="chat-panel__info-message-text">
                      {t('copyTrading.unavailableOnDemo')}
                    </div>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        const saved = localStorage.getItem('tradingMode');
                        if (saved !== 'manual') {
                          localStorage.setItem('tradingMode', 'manual');
                          window.dispatchEvent(new CustomEvent<'manual' | 'demo'>('tradingModeChange', { detail: 'manual' }));
                          window.location.reload();
                        }
                      }}
                      className="chat-panel__info-message-link"
                    >
                      {t('copyTrading.switchToReal')}
                    </a>
                  </div>
                )}
              </div>
            ) : activeTab === 'subscriptions' ? (
              (!isDemoMode && !hasZeroBalance) ? (
                copySubscriptions.length > 0 ? (
              copySubscriptions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveSubscriptionId(item.id)}
                  className={`chat-panel__ticket-item subscription-item ${item.id === activeSubscriptionId ? 'active' : ''} ${!item.isActive ? 'inactive' : ''}`}
                >
                  <div className="subscription-item-content">
                    <div className={`chat-panel__ticket-subject ${!item.isActive ? 'inactive' : ''}`}>
                      {item.traderName}
                    </div>
                    <div className="chat-panel__ticket-status">
                      {t('copyTrading.codeLabel')}{item.code} • {item.isActive ? (
                        <span className="subscription-item-status-on">{t('copyTrading.on')}</span>
                      ) : (
                        <span className="subscription-item-status-off">{t('copyTrading.off')}</span>
                      )}
                    </div>
                    <div className="subscription-item-stats">
                      <span>{t('copyTrading.tradesLabel')}{item.totalCopiedTrades}</span>
                      <span className={`subscription-item-stats-profit ${item.totalProfit >= 0 ? '' : 'negative'}`}>
                        {t('copyTrading.profitLabel')}{item.totalProfit >= 0 ? '+' : ''}{formatCurrency(item.totalProfit, userCurrency)}
                      </span>
                    </div>
                  </div>
                  <div className="subscription-item-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSubscription(item.id, !item.isActive);
                      }}
                      disabled={isCopyLoading}
                      className="subscription-button"
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
                      className="subscription-button"
                    >
                      {t('copyTrading.remove')}
                    </button>
                  </div>
                </div>
              ))
                ) : (
                  <div className="chat-panel__empty-state">
                    {t('copyTrading.noActiveSubscriptions')}
                  </div>
                )
              ) : null
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
};

