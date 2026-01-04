import React from 'react';
import { CopyTradingSignalsList } from '@src/widgets/copy-trading-signals/CopyTradingSignalsList';
import { useLanguage } from '@src/app/providers/useLanguage';
import './SignalsPanel.css';

interface SignalsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBase?: string;
  investmentAmount?: number;
  onOpenAddSignalModal?: () => void;
  isBothOpen?: boolean;
}

export const SignalsPanel: React.FC<SignalsPanelProps> = ({
  isOpen,
  onClose,
  selectedBase,
  investmentAmount,
  onOpenAddSignalModal,
  isBothOpen = false,
}) => {
  const { t } = useLanguage();
  const [isOpening, setIsOpening] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsOpening(true);
      const timer = setTimeout(() => setIsOpening(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <aside
      className={`signals-panel ${isBothOpen ? 'split' : ''} ${!isOpen ? 'signals-panel--closing' : ''} ${isOpening ? 'signals-panel--opening' : ''}`}
      role="dialog"
      aria-label={t('copyTrading.signalsTitle')}
    >
      <div className="signals-panel__body">
        <CopyTradingSignalsList
          selectedBase={selectedBase}
          investmentAmount={investmentAmount}
          onOpenAddSignalModal={onOpenAddSignalModal}
        />
      </div>
    </aside>
  );
};

