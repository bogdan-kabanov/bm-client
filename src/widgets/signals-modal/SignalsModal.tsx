import React from 'react';
import { createPortal } from 'react-dom';
import { useSignalsModal } from '@src/shared/contexts/SignalsModalContext';
import { CopyTradingSignalsList } from '@/src/widgets/copy-trading-signals/CopyTradingSignalsList';
import { useLanguage } from '@src/app/providers/useLanguage';
import './SignalsModal.css';

interface SignalsModalProps {
  manualTradeAmount?: string;
}

export const SignalsModal: React.FC<SignalsModalProps> = React.memo(({
  manualTradeAmount = '0'
}) => {
  let contextValue;
  try {
    contextValue = useSignalsModal();
  } catch (error) {
    console.error('[SignalsModal] Ошибка при получении контекста:', error);
    return null;
  }

  const { isSignalsModalOpen, closeSignalsModal } = contextValue;
  const { t } = useLanguage();

  if (!isSignalsModalOpen) {
    return null;
  }

  const modalContent = (
    <div className="signals-modal-overlay" onClick={closeSignalsModal}>
      <div className="signals-modal" onClick={(e) => e.stopPropagation()}>
        <div className="signals-modal-header">
          <h2 className="signals-modal-title">{t('trading.copyTradingSignals') || 'Copy Trading'}</h2>
          <button 
            className="signals-modal-close"
            onClick={closeSignalsModal}
            aria-label={t('common.close') || 'Close'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="signals-modal-content">
          <CopyTradingSignalsList investmentAmount={parseFloat(manualTradeAmount.replace(',', '.')) || 0} />
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

SignalsModal.displayName = 'SignalsModal';

