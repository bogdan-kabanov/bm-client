import React, { useEffect, useState, useMemo } from 'react';
import { LOCAL_CURRENCY_ICONS } from '@src/features/trading-terminal/constants/currencyIcons';
import './TradeNotification.css';

export interface TradeNotificationData {
  id: string;
  symbol: string;
  baseCurrency?: string;
  amount: number;
  profit: number;
  direction: 'buy' | 'sell';
  isWin: boolean;
}

interface TradeNotificationProps {
  notification: TradeNotificationData;
  onClose: (id: string) => void;
}

export const TradeNotification: React.FC<TradeNotificationProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10);

    // Автоматическое закрытие через 5 секунд
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // Время для анимации исчезновения
  };

  const formatProfit = (profit: number): string => {
    const sign = profit >= 0 ? '+' : '';
    return `${sign}${profit.toFixed(2)}$`;
  };

  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  // Получаем иконку валюты из LOCAL_CURRENCY_ICONS
  const currencyIconUrl = useMemo(() => {
    const currency = notification.baseCurrency || notification.symbol?.split('/')[0] || notification.symbol?.split('_')[0] || 'BTC';
    const currencyUpper = currency.toUpperCase();
    return LOCAL_CURRENCY_ICONS[currencyUpper] || null;
  }, [notification.baseCurrency, notification.symbol]);

  return (
    <div
      className={`trade-notification ${isVisible && !isClosing ? 'visible' : ''} ${isClosing ? 'closing' : ''} ${notification.isWin ? 'win' : 'loss'}`}
    >
      <div className="trade-notification-content">
        <div className="trade-notification-icon">
          {currencyIconUrl ? (
            <img 
              src={currencyIconUrl} 
              alt={notification.baseCurrency || notification.symbol} 
              className="currency-icon-img"
            />
          ) : (
            <span className="currency-icon-fallback">
              {(notification.baseCurrency || notification.symbol?.split('/')[0] || notification.symbol?.split('_')[0] || 'BTC').toUpperCase().substring(0, 3)}
            </span>
          )}
        </div>
        
        <div className="trade-notification-info">
          <div className="trade-notification-amount">
            Ставка: {formatAmount(notification.amount)}$
          </div>
          <div className={`trade-notification-profit ${notification.isWin ? 'profit-positive' : 'profit-negative'}`}>
            {formatProfit(notification.profit)}
          </div>
        </div>

        <div className="trade-notification-direction">
          {notification.direction === 'buy' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 20L12 4M12 20L6 14M12 20L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        <button
          className="trade-notification-close"
          onClick={handleClose}
          aria-label="Закрыть уведомление"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

