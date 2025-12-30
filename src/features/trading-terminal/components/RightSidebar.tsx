import React from 'react';
import '@src/widgets/sidebar/SidebarMenu.css';
import signalsIcon from '@src/assets/right-sidebar/Signals.png';
import historyIcon from '@src/assets/right-sidebar/ActivHistoryTrading.png';
import { useLanguage } from '@src/app/providers/useLanguage';

interface RightSidebarProps {
  onToggleSignals: () => void;
  onToggleHistory: () => void;
  isSignalsOpen: boolean;
  isHistoryOpen: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  onToggleSignals,
  onToggleHistory,
  isSignalsOpen,
  isHistoryOpen,
}) => {
  const { t } = useLanguage();

  return (
    <div className="sidebar-menu">
      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${isHistoryOpen ? 'active' : ''}`}
          onClick={onToggleHistory}
          title={t('trading.tradeHistory')}
          aria-label={t('trading.tradeHistory')}
        >
          <div className="sidebar-item-content">
            <img
              src={historyIcon}
              alt=""
              className="sidebar-icon"
              aria-hidden="true"
            />
            <span className="sidebar-label">{t('trading.tradeHistory')}</span>
          </div>
        </button>
        <button
          className={`sidebar-item ${isSignalsOpen ? 'active' : ''}`}
          onClick={onToggleSignals}
          title={t('copyTrading.signalsTitle')}
          aria-label={t('copyTrading.signalsTitle')}
        >
          <div className="sidebar-item-content">
            <img
              src={signalsIcon}
              alt=""
              className="sidebar-icon"
              aria-hidden="true"
            />
            <span className="sidebar-label">{t('copyTrading.signalsTitle')}</span>
          </div>
        </button>
      </nav>
    </div>
  );
};

