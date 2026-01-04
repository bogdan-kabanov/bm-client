import React from 'react';
import '@src/widgets/sidebar/SidebarMenu.css';
import signalsIcon from '@src/assets/images/sidebar/Signals.png';
import historyIcon from '@icons/icon-history.svg';
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
    <nav className="sidebar-nav">
      <button
        className={`sidebar-item ${isHistoryOpen ? 'active panel-open' : ''}`}
        onClick={onToggleHistory}
        title={t('trading.tradeHistory')}
        aria-label={t('trading.tradeHistory')}
      >
        <img
          src={historyIcon}
          alt=""
          className="sidebar-icon"
          aria-hidden="true"
        />
        <span className="sidebar-label">{t('trading.tradeHistory')}</span>
      </button>
      <button
        className={`sidebar-item ${isSignalsOpen ? 'active panel-open' : ''}`}
        onClick={onToggleSignals}
        title={t('copyTrading.signalsTitle')}
        aria-label={t('copyTrading.signalsTitle')}
      >
        <img
          src={signalsIcon}
          alt=""
          className="sidebar-icon"
          aria-hidden="true"
        />
        <span className="sidebar-label">{t('copyTrading.signalsTitle')}</span>
      </button>
    </nav>
  );
};

