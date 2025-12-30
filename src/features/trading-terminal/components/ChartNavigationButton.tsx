import React from 'react';
import './ChartNavigationButton.css';

interface ChartNavigationButtonProps {
  selectedBase: string;
  currencyIcon?: string | null;
  isMenuOpen: boolean;
  onClick: () => void;
  displayName?: string | null;
}

export const ChartNavigationButton: React.FC<ChartNavigationButtonProps> = ({
  selectedBase,
  currencyIcon,
  isMenuOpen,
  onClick,
  displayName,
}) => {
  const displayText = displayName || selectedBase;
  
  return (
    <button
      className={`chart-navigation-button ${isMenuOpen ? 'menu-open' : ''}`}
      onClick={onClick}
      aria-label="Открыть меню навигации по графикам"
    >
      <div className="chart-navigation-button__content">
        {currencyIcon ? (
          <img
            src={currencyIcon}
            alt={selectedBase}
            className="chart-navigation-button__icon"
          />
        ) : (
          <span className="chart-navigation-button__icon-placeholder">
            {selectedBase.substring(0, 2)}
          </span>
        )}
        <span className="chart-navigation-button__text">{displayText}</span>
        <svg
          className="chart-navigation-button__arrow"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M4.5 3L7.5 6L4.5 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </button>
  );
};

