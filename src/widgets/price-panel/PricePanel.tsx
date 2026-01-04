import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { TradingTransactions } from '@/src/widgets/trading-transactions/TradingTransactions';
import { TradesPanel } from '@/src/widgets/trades-panel/TradesPanel';
import type { Currency } from '@src/shared/api';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectQuoteCurrency, selectTradingPrices } from '@src/entities/trading/model/selectors';
import { setMenuOpen, setSubscriptionsMenuOpen } from '@src/entities/copy-trading-signals/model/slice';
import './PricePanel.css';

interface PricePanelProps {
  tradingMode: 'manual' | 'demo';
  onTradingModeChange: (mode: 'manual' | 'demo') => void;
  isTradingActive: boolean;
  isProcessing: boolean;
  selectedDuration: string;
  onDurationSelect: (duration: string) => void;
  tradingDurations: any[];
  onStartTrading: () => void;
  manualTradeAmount: string;
  setManualTradeAmount: (value: string) => void;
  handleManualTrade: (direction: 'buy' | 'sell') => void;
  formatPrice: (price: number | null) => string;
  formatHMS: (totalSeconds: number) => string;
  parsedExpiration: number;
  changeExpiration: (delta: number) => void;
  setExpirationSeconds: (value: string) => void;
  quickPresets: Array<{ label: string; seconds: number }>;
  setHoveredButton: (button: 'buy' | 'sell' | null) => void;
  balance: number;
  currentPrice?: number | null;
  price1?: number | null;
  price2?: number | null;
  priceDiff?: number;
  priceDiffPercent?: number;
  spreadPercent?: number;
  quoteCurrency?: string;
  activeTrades?: any[];
  tradeHistory?: any[];
  selectedBase?: string;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  onRequestActiveTrades?: () => void;
  onRequestTradeHistory?: () => void;
  onOpenAddSignalModal?: () => void;
}

export const PricePanel = (props: PricePanelProps) => {
  const { t } = useLanguage();
  const dispatch = useAppDispatch();
  const quoteCurrencyStore = useAppSelector(selectQuoteCurrency);
  const prices = useAppSelector(selectTradingPrices);
  
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const durationMenuRef = useRef<HTMLDivElement>(null);

  const price1 = props.price1 ?? prices.price1;
  const price2 = props.price2 ?? prices.price2;
  const priceDiff = props.priceDiff ?? prices.priceDiff;
  const priceDiffPercent = props.priceDiffPercent ?? prices.priceDiffPercent;
  
  const formattedPrice1 = props.formatPrice(price1);
  const formattedPrice2 = props.formatPrice(price2);
  const formattedPriceDiff = props.formatPrice(priceDiff !== 0 ? Math.abs(priceDiff) : null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (durationMenuRef.current && !durationMenuRef.current.contains(event.target as Node)) {
        setShowDurationMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  return (
    <div className="price-panel">
      <div className="price-difference-panel">

        {(
          <TradesPanel
            selectedBase={props.selectedBase}
            quoteCurrency={quoteCurrencyStore}
            onTradeExpired={(trade, isWin) => {
            }}
            onLoadMoreHistory={props.onLoadMoreHistory}
            isLoadingMoreHistory={props.isLoadingMoreHistory}
            hasMoreHistory={props.hasMoreHistory}
            getCurrencyInfo={props.getCurrencyInfo}
            resolveCurrencyIconUrls={props.resolveCurrencyIconUrls}
            onRequestActiveTrades={props.onRequestActiveTrades}
            onOpenTradeSidebar={(trade: any) => {
              if ((window as any).__tradingTerminalOpenTradeSidebar) {
                (window as any).__tradingTerminalOpenTradeSidebar(trade);
              }
            }}
            onRequestTradeHistory={props.onRequestTradeHistory}
          />
        )}

        {/* Временно отключаем копирование сигналов */}
        {/* <div className="copy-trading-signals-wrapper copy-trading-signals-wrapper--bottom">
          <button
            className="copy-trading-signals-btn active"
            onClick={() => {
              dispatch(setSubscriptionsMenuOpen(true));
            }}
            title={t('trading.copyTradingSignals')}
          >
            <div className="copy-trading-icon-wrapper">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span className="activity-indicator"></span>
            </div>
            <div className="copy-trading-content">
              <span className="copy-trading-title">{t('trading.copyTradingSignals')}</span>
            </div>
            <span className="copy-trading-count">+</span>
          </button>
        </div> */}

      </div>
    </div>
  );
};

