import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { copyTradingApi } from '@src/shared/api';
import { formatTraderCodeForDisplay } from '@src/shared/lib/traderCodeUtils';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
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

interface CopyTradingSignalsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopyTradingSignalsMenu: React.FC<CopyTradingSignalsMenuProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const userCurrency = profile?.currency || 'USD';
  
  const copySubscriptions = useAppSelector(selectCopyTradingSubscriptions);
  const isCopyLoading = useAppSelector(selectCopyTradingLoading);
  const copyError = useAppSelector(selectCopyTradingError);
  const copySuccess = useAppSelector(selectCopyTradingSuccess);
  
  const [copyCodeInput, setCopyCodeInput] = useState('');
  const hasFetchedCopyDataRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const mapSubscriptionResponse = useCallback((raw: any): CopySubscriptionItem => {
    const subscription = raw?.subscription ?? {};
    const trader = raw?.trader ?? {};
    const profile = raw?.profile ?? {};
    const stats = raw?.stats ?? {};

    const nameParts = [trader.firstname, trader.lastname].filter(Boolean);
    const traderName = nameParts.length
      ? nameParts.join(' ')
      : trader.email || `${t('copyTrading.traderDefault')}${formatTraderCodeForDisplay(subscription.trader_user_id ?? '')}`;

    return {
      id: subscription.id,
      traderUserId: subscription.trader_user_id,
      traderName,
      code: profile.code ? formatTraderCodeForDisplay(profile.code) : formatTraderCodeForDisplay(subscription.trader_user_id ?? ''),
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
  }, [t, dispatch, mapSubscriptionResponse]);

  const handleCopyCodeSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!copyCodeInput.trim()) {
      return;
    }

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

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="copy-trading-signals-menu-backdrop visible"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        ref={menuRef}
        className="copy-trading-signals-menu open"
        role="dialog"
        aria-label={t('copyTrading.tradingSignals')}
      >
        <div className="copy-trading-signals-menu__header">
          <div className="copy-trading-signals-menu__title">
            <h3>{t('copyTrading.tradingSignals')}</h3>
            <span>
              {copySubscriptions.length > 0
                ? t('copyTrading.activeFromTotal', { active: copySubscriptions.filter(s => s.isActive).length.toString(), total: copySubscriptions.length.toString() })
                : t('copyTrading.addTradersToCopy')}
            </span>
          </div>
          <button
            type="button"
            className="copy-trading-signals-menu__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="copy-trading-signals-menu__content">
          <form className="copy-trading-signals-menu__input" onSubmit={handleCopyCodeSubmit}>
            <input
              type="text"
              placeholder={t('copyTrading.enterTraderCode')}
              value={copyCodeInput}
              onChange={(event) => setCopyCodeInput(event.target.value)}
              disabled={isCopyLoading}
            />
            <button type="submit" disabled={isCopyLoading}>
              {isCopyLoading ? t('copyTrading.waitButton') : t('copyTrading.addButton')}
            </button>
          </form>

          {copyError && <div className="copy-trading-signals-menu__message error">{copyError}</div>}
          {copySuccess && <div className="copy-trading-signals-menu__message success">{copySuccess}</div>}

          {copySubscriptions.length > 0 ? (
            <div className="copy-trading-signals-menu__list">
              {copySubscriptions.map((item) => {
                const lastCopied = formatCopyDate(item.lastCopiedAt);
                return (
                  <div key={item.id} className={`copy-trading-signals-menu__item ${item.isActive ? 'copy-trading-signals-menu__item--active' : ''}`}>
                    <div className="copy-trading-signals-menu__item-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <div className="copy-trading-signals-menu__item-info">
                      <span className="copy-trading-signals-menu__item-name">{item.traderName}</span>
                      <span className="copy-trading-signals-menu__item-desc">{t('copyTrading.codeLabel')}{item.code}</span>
                      <div className="copy-trading-signals-menu__item-stats">
                        <span>{t('copyTrading.tradesLabel')}{item.totalCopiedTrades}</span>
                        <span className={item.totalProfit >= 0 ? 'positive' : 'negative'}>
                          {t('copyTrading.profitLabel')}{item.totalProfit >= 0 ? '+' : ''}{formatCurrency(item.totalProfit, userCurrency)}
                        </span>
                      </div>
                    </div>
                    <div className="copy-trading-signals-menu__item-actions">
                      <button
                        type="button"
                        className={`copy-trading-signals-menu__item-toggle ${item.isActive ? 'active' : ''}`}
                        onClick={() => handleToggleSubscription(item.id, !item.isActive)}
                        disabled={isCopyLoading}
                      >
                        {item.isActive ? t('copyTrading.on') : t('copyTrading.off')}
                      </button>
                      <button
                        type="button"
                        className="copy-trading-signals-menu__item-remove"
                        onClick={() => handleRemoveSubscription(item.id)}
                        disabled={isCopyLoading}
                        title={t('copyTrading.remove')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="copy-trading-signals-menu__empty">
              <p>{t('copyTrading.noActiveSubscriptions')}</p>
              <p className="copy-trading-signals-menu__empty-hint">{t('copyTrading.enterTraderCodeHint')}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

