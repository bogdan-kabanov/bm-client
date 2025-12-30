import React, { useState, useEffect, useRef } from 'react';
import { ActiveTrades } from '@/src/widgets/active-trades/ActiveTrades';
import { TradeHistory } from '@/src/widgets/trade-history/TradeHistory';
import { useLanguage } from '@src/app/providers/useLanguage';
import type { Currency } from '@src/shared/api';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectTradeHistoryByMode, selectTradingMode } from '@src/entities/trading/model/selectors';
import './TradesPanel.css';

interface ActiveTrade {
  id: string;
  price: number;
  direction: 'buy' | 'sell';
  amount: number;
  expirationTime: number;
  entryPrice: number;
  currentPrice: number | null;
  createdAt: number;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
}

interface TradeHistoryItem {
  id: string;
  price: number;
  direction: 'buy' | 'sell';
  amount: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  isWin: boolean;
  createdAt: number;
  completedAt: number;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
}

interface TradesPanelProps {
  selectedBase?: string;
  onTradeExpired?: (trade: ActiveTrade, isWin: boolean) => void;
  quoteCurrency?: string;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  onRequestActiveTrades?: () => void;
  onRequestTradeHistory?: () => void;
}

type TabType = 'active' | 'history';

export const TradesPanel: React.FC<TradesPanelProps> = ({
  selectedBase = 'BTC',
  onTradeExpired,
  quoteCurrency = 'USDT',
  onLoadMoreHistory,
  isLoadingMoreHistory = false,
  hasMoreHistory = false,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  onRequestActiveTrades,
  onRequestTradeHistory
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const prevTabRef = useRef<TabType>('active');
  const hasRequestedActiveTradesRef = useRef(false);
  const hasRequestedTradeHistoryRef = useRef(false);
  const tradeHistory = useAppSelector(selectTradeHistoryByMode);
  const tradingMode = useAppSelector(selectTradingMode);


  // Загружаем данные при смене вкладки
  useEffect(() => {
    if (activeTab === 'active' && onRequestActiveTrades && prevTabRef.current !== activeTab) {
      const timeoutId = setTimeout(() => {
        if (onRequestActiveTrades && !hasRequestedActiveTradesRef.current) {
          onRequestActiveTrades();
          hasRequestedActiveTradesRef.current = true;
          setTimeout(() => {
            hasRequestedActiveTradesRef.current = false;
          }, 5000);
        }
      }, 100);
      
      prevTabRef.current = activeTab;
      return () => {
        clearTimeout(timeoutId);
      };
    }
    if (activeTab === 'history' && onRequestTradeHistory && prevTabRef.current !== activeTab) {
      const timeoutId = setTimeout(() => {
        if (onRequestTradeHistory && !hasRequestedTradeHistoryRef.current) {
          onRequestTradeHistory();
          hasRequestedTradeHistoryRef.current = true;
          setTimeout(() => {
            hasRequestedTradeHistoryRef.current = false;
          }, 5000);
        }
      }, 100);
      
      prevTabRef.current = activeTab;
      return () => {
        clearTimeout(timeoutId);
      };
    }
    if (activeTab !== 'active' && activeTab !== 'history') {
      prevTabRef.current = activeTab;
    }
  }, [activeTab, onRequestActiveTrades, onRequestTradeHistory]);

  // Загружаем активные трейды при монтировании, если активна вкладка 'active'
  useEffect(() => {
    if (activeTab === 'active' && onRequestActiveTrades && !hasRequestedActiveTradesRef.current) {
      const timeoutId = setTimeout(() => {
        if (onRequestActiveTrades && !hasRequestedActiveTradesRef.current) {
          onRequestActiveTrades();
          hasRequestedActiveTradesRef.current = true;
          setTimeout(() => {
            hasRequestedActiveTradesRef.current = false;
          }, 5000);
        }
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [activeTab, onRequestActiveTrades]);

  // Загружаем историю при монтировании или при первом открытии вкладки истории, если история пустая
  useEffect(() => {
    if (activeTab === 'history' && onRequestTradeHistory && tradeHistory.length === 0 && !hasRequestedTradeHistoryRef.current) {
      const timeoutId = setTimeout(() => {
        if (onRequestTradeHistory && !hasRequestedTradeHistoryRef.current) {
          onRequestTradeHistory();
          hasRequestedTradeHistoryRef.current = true;
          setTimeout(() => {
            hasRequestedTradeHistoryRef.current = false;
          }, 5000);
        }
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [activeTab, onRequestTradeHistory, tradeHistory.length]);

  // Дополнительная проверка: загружаем историю при первом открытии вкладки, даже если она была активна изначально
  const hasLoadedHistoryRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'history' && onRequestTradeHistory && !hasLoadedHistoryRef.current) {
      hasLoadedHistoryRef.current = true;
      const timeoutId = setTimeout(() => {
        if (onRequestTradeHistory && tradeHistory.length === 0) {
          onRequestTradeHistory();
        }
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [activeTab, onRequestTradeHistory, tradeHistory.length]);


  return (
    <div className="trades-panel">
      <div className="trades-panel-header">
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('active');
            if (onRequestActiveTrades) {
              requestAnimationFrame(() => {
                onRequestActiveTrades();
              });
            }
          }}
        >
          {t('trading.activeTrades') || 'Active Trades'}
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={(e) => {
            const newTab: TabType = 'history';
            setActiveTab(newTab);
            if (onRequestTradeHistory) {
              requestAnimationFrame(() => {
                onRequestTradeHistory();
              });
            }
          }}
        >
          {t('trading.tradeHistory') || 'Trade History'}
        </button>
      </div>
      
      <div className="trades-panel-content">
        {activeTab === 'active' && (
          <ActiveTrades 
            getCurrencyInfo={getCurrencyInfo}
            resolveCurrencyIconUrls={resolveCurrencyIconUrls}
          />
        )}
        
        {activeTab === 'history' && (
          <TradeHistory 
            trades={tradeHistory} 
            selectedBase={selectedBase} 
            quoteCurrency={quoteCurrency}
            onLoadMore={onLoadMoreHistory}
            isLoadingMore={false}
            hasMore={hasMoreHistory}
            getCurrencyInfo={getCurrencyInfo}
            resolveCurrencyIconUrls={resolveCurrencyIconUrls}
          />
        )}
      </div>
    </div>
  );
};

