import React from 'react';
import { TradesPanel } from '@src/widgets/trades-panel/TradesPanel';
import { useLanguage } from '@src/app/providers/useLanguage';
import type { Currency } from '@src/shared/api';
import './TradesHistoryPanel.css';

interface TradesHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBase?: string;
  quoteCurrency?: string;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  onRequestActiveTrades?: () => void;
  onRequestTradeHistory?: () => void;
  isBothOpen?: boolean;
  onOpenTradeSidebar?: (trade: any) => void;
}

export const TradesHistoryPanel: React.FC<TradesHistoryPanelProps> = ({
  isOpen,
  onClose,
  selectedBase,
  quoteCurrency,
  onLoadMoreHistory,
  isLoadingMoreHistory,
  hasMoreHistory,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  onRequestActiveTrades,
  onRequestTradeHistory,
  isBothOpen = false,
  onOpenTradeSidebar,
}) => {
  const { t } = useLanguage();
  const [isOpening, setIsOpening] = React.useState(false);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const prevIsBothOpenRef = React.useRef(isBothOpen);

  React.useEffect(() => {
    if (isOpen) {
      setIsOpening(true);
      const timer = setTimeout(() => setIsOpening(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isBothOpen && !prevIsBothOpenRef.current) {
      // Переход с полной высоты на 50%
      setIsSplitting(true);
      const timer = setTimeout(() => setIsSplitting(false), 300);
      return () => clearTimeout(timer);
    }
    prevIsBothOpenRef.current = isBothOpen;
  }, [isBothOpen]);

  return (
    <aside
      className={`trades-history-panel ${isBothOpen ? 'split' : ''} ${!isOpen ? 'trades-history-panel--closing' : ''} ${isOpening ? 'trades-history-panel--opening' : ''} ${isSplitting ? 'trades-history-panel--splitting' : ''}`}
      role="dialog"
      aria-label={t('trading.tradeHistory')}
    >
      <div className="trades-history-panel__header">
        <div className="trades-history-panel__title">
          <h3>{t('trading.tradeHistory')}</h3>
        </div>
      </div>
      <div className="trades-history-panel__body">
        <TradesPanel
          selectedBase={selectedBase}
          quoteCurrency={quoteCurrency}
          onLoadMoreHistory={onLoadMoreHistory}
          isLoadingMoreHistory={isLoadingMoreHistory}
          hasMoreHistory={hasMoreHistory}
          getCurrencyInfo={getCurrencyInfo}
          resolveCurrencyIconUrls={resolveCurrencyIconUrls}
          onRequestActiveTrades={onRequestActiveTrades}
          onRequestTradeHistory={onRequestTradeHistory}
          onOpenTradeSidebar={onOpenTradeSidebar}
        />
      </div>
    </aside>
  );
};

