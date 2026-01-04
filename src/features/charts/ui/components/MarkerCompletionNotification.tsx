import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import './MarkerCompletionNotification.css';

interface MarkerCompletionNotification {
  id: string;
  tradeId?: string;
  direction: 'buy' | 'sell';
  amount: number;
  isWin: boolean;
  profit: number;
  profitPercent: number;
  exitPrice: number;
  currency?: string;
}

interface MarkerCompletionNotificationProps {
  notification: MarkerCompletionNotification;
  onClose: (id: string) => void;
}

export const MarkerCompletionNotificationComponent: React.FC<MarkerCompletionNotificationProps> = ({
  notification,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10);
    
    // Автоматическое закрытие через 5 секунд
    const timeout = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => onClose(notification.id), 300);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [notification.id, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(notification.id), 300);
  };

  const userCurrency = notification.currency || 'USD';
  const profitAmount = notification.isWin ? notification.profit : -notification.amount;

  return (
    <div 
      className={`marker-completion-notification ${notification.isWin ? 'win' : 'loss'} ${isVisible && !isClosing ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div className="marker-completion-notification-content">
        <div className="marker-completion-icon">
          {notification.isWin ? '✓' : '✗'}
        </div>
        <div className="marker-completion-info">
          <div className="marker-completion-header">
            <span className="marker-completion-direction">
              {notification.direction === 'buy' ? '↑ BUY' : '↓ SELL'}
            </span>
            <span className="marker-completion-amount">
              {formatCurrency(notification.amount, userCurrency)}
            </span>
          </div>
          <div className={`marker-completion-profit ${notification.isWin ? 'profit-positive' : 'profit-negative'}`}>
            {notification.isWin 
              ? `+${formatCurrency(profitAmount, userCurrency)} (+${notification.profitPercent.toFixed(2)}%)`
              : `${formatCurrency(profitAmount, userCurrency)} (${notification.profitPercent.toFixed(2)}%)`
            }
          </div>
        </div>
        <button 
          className="marker-completion-close"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

