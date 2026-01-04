import React from 'react';
import { createPortal } from 'react-dom';
import { useTradesHistoryModal } from '@src/shared/contexts/TradesHistoryModalContext';
import { TradesPanel } from '@/src/widgets/trades-panel/TradesPanel';
import { useLanguage } from '@src/app/providers/useLanguage';
import type { Currency } from '@src/shared/api';
import './TradesHistoryModal.css';

interface TradesHistoryModalProps {
  selectedBase?: string;
  quoteCurrency?: string;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  onRequestActiveTrades?: () => void;
  onRequestTradeHistory?: () => void;
  manualTradeAmount?: string;
}

export const TradesHistoryModal: React.FC<TradesHistoryModalProps> = React.memo(({
  selectedBase = 'BTC',
  quoteCurrency = 'USDT',
  onLoadMoreHistory,
  isLoadingMoreHistory = false,
  hasMoreHistory = false,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  onRequestActiveTrades,
  onRequestTradeHistory,
  manualTradeAmount = '0'
}) => {
  let contextValue;
  try {
    contextValue = useTradesHistoryModal();
  } catch (error) {
    console.error('[TradesHistoryModal] Ошибка при получении контекста:', error);
    return null;
  }

  const { isTradesHistoryModalOpen, closeTradesHistoryModal } = contextValue;
  const { t } = useLanguage();

  if (!isTradesHistoryModalOpen) {
    return null;
  }

  const modalContent = (
    <div className="trades-history-modal-overlay" onClick={closeTradesHistoryModal}>
      <div className="trades-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trades-history-modal-header">
          <h2 className="trades-history-modal-title">{t('trading.tradeHistory') || 'Trades'}</h2>
          <button 
            className="trades-history-modal-close"
            onClick={closeTradesHistoryModal}
            aria-label={t('common.close') || 'Close'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="trades-history-modal-content">
          <TradesPanel
            selectedBase={selectedBase}
            quoteCurrency={quoteCurrency}
            onLoadMoreHistory={onLoadMoreHistory}
            isLoadingMoreHistory={isLoadingMoreHistory}
            hasMoreHistory={hasMoreHistory}
            getCurrencyInfo={getCurrencyInfo}
            resolveCurrencyIconUrls={resolveCurrencyIconUrls}
            onOpenTradeSidebar={(trade: any) => {
              if ((window as any).__tradingTerminalOpenTradeSidebar) {
                (window as any).__tradingTerminalOpenTradeSidebar(trade);
              }
            }}
            onRequestActiveTrades={onRequestActiveTrades}
            onRequestTradeHistory={onRequestTradeHistory}
          />
        </div>
      </div>
    </div>
  );

  // Рендерим модальное окно через Portal в body, чтобы избежать проблем с overflow: hidden
  // Используем useEffect для гарантии, что document.body существует
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      setPortalContainer(document.body);
    }
  }, []);

  if (!portalContainer) {
    return null;
  }

  return createPortal(modalContent, portalContainer);
});

TradesHistoryModal.displayName = 'TradesHistoryModal';

