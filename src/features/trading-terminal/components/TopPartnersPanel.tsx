import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { copyTradingApi, type CopyTradingTopTrader } from '@src/shared/api';
import { formatTraderCodeForDisplay } from '@src/shared/lib/traderCodeUtils';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import top1Icon from '@src/assets/images/TOP1.svg';
import top2Icon from '@src/assets/images/TOP2.svg';
import top3Icon from '@src/assets/images/TOP3.svg';
import userIcon from '@src/assets/icons/avatar.svg';
import './ChatPanel.css';
import './CopyTradingPanel.css';

interface TopPartnersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export const TopPartnersPanel: React.FC<TopPartnersPanelProps> = ({ isOpen, onClose, t }) => {
  const profile = useAppSelector(selectProfile);
  const userCurrency = profile?.currency || 'USD';
  
  const [topTraders, setTopTraders] = useState<CopyTradingTopTrader[]>([]);
  const [selectedTopTrader, setSelectedTopTrader] = useState<CopyTradingTopTrader | null>(null);
  const [isTopTradersLoading, setIsTopTradersLoading] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionSettings, setSubscriptionSettings] = useState({
    balancePercent: '',
    dailyLimitAmount: '',
    dailyLimitEnabled: false,
  });
  const hasFetchedRef = useRef(false);

  const fetchTopTraders = useCallback(async () => {
    setIsTopTradersLoading(true);
    try {
      const traders = await copyTradingApi.getTopTraders(20);
      console.log('[TopPartnersPanel] Fetched top traders:', traders);
      console.log('[TopPartnersPanel] Traders type:', typeof traders);
      console.log('[TopPartnersPanel] Is array:', Array.isArray(traders));
      console.log('[TopPartnersPanel] Traders length:', Array.isArray(traders) ? traders.length : 'not an array');
      
      // Обработка разных форматов ответа
      let tradersArray: CopyTradingTopTrader[] = [];
      if (Array.isArray(traders)) {
        tradersArray = traders;
      } else if (traders && typeof traders === 'object' && 'data' in traders && Array.isArray((traders as any).data)) {
        tradersArray = (traders as any).data;
      } else if (traders && typeof traders === 'object' && 'success' in traders && 'data' in traders) {
        tradersArray = Array.isArray((traders as any).data) ? (traders as any).data : [];
      }
      
      console.log('[TopPartnersPanel] Final traders array:', tradersArray);
      setTopTraders(tradersArray);
    } catch (error) {
      console.error('[TopPartnersPanel] Error loading top traders:', error);
      setTopTraders([]);
    } finally {
      setIsTopTradersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!hasFetchedRef.current) {
        fetchTopTraders();
        hasFetchedRef.current = true;
      } else {
        // Обновляем данные при каждом открытии
        fetchTopTraders();
      }
    }
  }, [isOpen, fetchTopTraders]);

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

  const isFullscreenDetailView = selectedTopTrader;

  return (
    <aside
      className={`chat-panel copy-trading-panel top-partners-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label={t('copyTrading.tabLeaderboard')}
    >
      <div className="chat-panel__header">
        <div className="chat-panel__header-row">
          <div className="chat-panel__title">
            <h3>{t('copyTrading.tabLeaderboard')}</h3>
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
      </div>

      <div className={`chat-panel__body ${isFullscreenDetailView ? 'has-fullscreen-detail' : ''}`}>
        {!isFullscreenDetailView && (
          <div className="chat-panel__tickets-sidebar">
            <div className="chat-panel__tickets-list">
              {isTopTradersLoading ? (
                <div className="chat-panel__loading">
                  {t('copyTrading.loading') || 'Loading...'}
                </div>
              ) : topTraders.length > 0 ? (
                topTraders.map((trader, index) => (
                  <div
                    key={trader.traderUserId || trader.code}
                    onClick={() => {
                      if (selectedTopTrader?.code === trader.code) {
                        setSelectedTopTrader(null);
                      } else {
                        setSelectedTopTrader(trader);
                      }
                    }}
                    className={`chat-panel__ticket-item ${selectedTopTrader?.code === trader.code ? 'active' : ''} ${index === 0 ? 'top-partner-shimmer top-partner-gold' : index === 1 ? 'top-partner-shimmer top-partner-silver' : index === 2 ? 'top-partner-shimmer top-partner-bronze' : ''} ${index % 2 === 0 ? 'partner-item-even' : 'partner-item-odd'}`}
                  >
                    <div className="partner-card">
                      <div className="partner-card__header">
                        <span className={`partner-card__rank ${index < 3 ? 'top-rank' : ''}`}>
                          #{index + 1}
                        </span>
                        <div className="partner-card__avatar">
                          {trader.avatarUrl ? (
                            <img 
                              src={trader.avatarUrl} 
                              alt={trader.traderName}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.partner-card__avatar-fallback')) {
                                  target.classList.add('hidden');
                                  const fallback = document.createElement('span');
                                  fallback.className = 'partner-card__avatar-fallback';
                                  fallback.textContent = trader.traderName[0]?.toUpperCase() || 'T';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <span className="partner-card__avatar-fallback">
                              {trader.traderName[0]?.toUpperCase() || 'T'}
                            </span>
                          )}
                        </div>
                        <div className="chat-panel__ticket-subject partner-card__name">
                          {trader.traderName}
                        </div>
                        {index < 3 && (
                          <div className="partner-card__trophy">
                            <img 
                              src={index === 0 ? top1Icon : index === 1 ? top2Icon : top3Icon}
                              alt={`Top ${index + 1}`}
                            />
                          </div>
                        )}
                      </div>
                      <div className="partner-card__footer">
                        <div className="partner-card__footer-left">
                          <div className="partner-card__code">
                            {t('copyTrading.codeLabel')}{trader.code}
                          </div>
                          <div className="partner-card__subscribers">
                            {t('copyTrading.subscribers') || 'Subscribers'}: {trader.subscribersCount}
                          </div>
                        </div>
                        <div className="partner-card__footer-right">
                          <div className="partner-card__profit-label">
                            {t('copyTrading.profitLabel')}
                          </div>
                          <div className={`partner-card__profit-value ${trader.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                            {trader.totalProfit >= 0 ? '+' : ''}{formatCurrency(trader.totalProfit, userCurrency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="chat-panel__empty">
                  {t('copyTrading.leaderboardEmpty')}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Полноэкранный вид для выбранного партнера */}
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
              </button>
              <h3>{selectedTopTrader.traderName}</h3>
              <div className="chat-panel__fullscreen-header-spacer"></div>
            </div>
            <div className="chat-panel__fullscreen-content">
              <div className="chat-panel__fullscreen-content-wrapper">
                <div className="info-card">
                  <div className="info-card-label">
                    {t('copyTrading.codeLabel')}
                  </div>
                  <div className="info-card-value info-card-code">
                    {formatTraderCodeForDisplay(selectedTopTrader.code)}
                  </div>
                </div>
                
                <div className="chat-panel__fullscreen-grid">
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
                    <div className={`info-card-value ${selectedTopTrader.isProfileActive ? 'positive' : ''} ${!selectedTopTrader.isProfileActive ? 'inactive' : ''}`}>
                      {selectedTopTrader.isProfileActive ? (t('copyTrading.on') || 'Active') : (t('copyTrading.off') || 'Inactive')}
                    </div>
                  </div>
                </div>
                
                {selectedTopTrader.lastCopiedAt && (
                  <div className="info-card">
                    <div className="info-card-label">
                      {t('copyTrading.lastCopied')}
                    </div>
                    <div className="chat-panel__fullscreen-date">
                      {formatCopyDate(selectedTopTrader.lastCopiedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Subscription Settings Form */}
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
              <div className="chat-panel__fullscreen-header-spacer"></div>
            </div>
            <div className="chat-panel__fullscreen-content">
              <div className="chat-panel__subscription-form-wrapper">
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
                    className="chat-panel__subscription-input"
                  />
                  <div className="chat-panel__subscription-hint">
                    {t('copyTrading.balancePercentHint') || 'Percentage of your balance to use for copying trades (0-100%)'}
                  </div>
                </div>

                <div className="info-card">
                  <label className="chat-panel__subscription-checkbox-label">
                    <input
                      type="checkbox"
                      checked={subscriptionSettings.dailyLimitEnabled}
                      onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, dailyLimitEnabled: e.target.checked })}
                      className="chat-panel__subscription-checkbox"
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
                        className="chat-panel__subscription-input"
                      />
                      <div className="chat-panel__subscription-hint">
                        {t('copyTrading.dailyLimitHint') || 'Maximum amount per day (e.g., 10% up to $100 per day)'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

