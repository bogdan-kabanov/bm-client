import React, { useState, useEffect } from 'react';
import './ChartNavigationButton.css';
import { getServerTime } from '@src/shared/lib/serverTime';

interface ChartNavigationButtonProps {
  selectedBase: string;
  currencyIcon?: string | null;
  isMenuOpen: boolean;
  onClick: () => void;
  displayName?: string | null;
  quoteCurrency?: string | null;
}

export const ChartNavigationButton: React.FC<ChartNavigationButtonProps> = ({
  selectedBase,
  currencyIcon,
  isMenuOpen,
  onClick,
  displayName,
  quoteCurrency,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('UTC');

  useEffect(() => {
    // Используем UTC таймзону, так как график работает с серверным временем в UTC
    setTimezone('UTC');

    // Обновляем время каждую секунду, используя серверное время
    const updateTime = () => {
      const serverTime = getServerTime();
      const date = new Date(serverTime);
      const timeStr = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC'
      });
      setCurrentTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Форматируем текст в формат "/RUB" (только вторая валюта)
  const formatDisplayText = (): string => {
    // Если есть quoteCurrency, показываем "/" + quoteCurrency
    if (quoteCurrency) {
      return `/${quoteCurrency.toUpperCase()}`;
    }
    
    // Если selectedBase уже в формате "BTC/USDT", извлекаем вторую валюту
    if (selectedBase.includes('/')) {
      const parts = selectedBase.split('/');
      if (parts.length >= 2) {
        return `/${parts[1].toUpperCase()}`;
      }
    }
    
    // Если есть displayName, пытаемся извлечь из него вторую валюту
    if (displayName) {
      // Пытаемся найти паттерн типа "BTC/USDT" или "Bitcoin / USDT"
      const match = displayName.match(/(\w+)\s*\/\s*(\w+)/i);
      if (match && match[2]) {
        return `/${match[2].toUpperCase()}`;
      }
    }
    
    // Если ничего не подошло, используем "/USDT" по умолчанию
    return '/USDT';
  };

  const displayText = formatDisplayText();
  // Проверяем, является ли это Bitcoin (может быть "BTC", "BTC/USDT" и т.д.)
  const baseCurrency = selectedBase.toUpperCase().split('/')[0];
  const isBitcoin = baseCurrency === 'BTC';
  
  return (
    <div className={`chart-navigation-button-wrapper ${isMenuOpen ? 'menu-open' : ''}`}>
      <button
        className="chart-navigation-button"
        onClick={onClick}
        aria-label="Открыть меню навигации по графикам"
      >
        <div className="chart-navigation-button__content">
          {currencyIcon ? (
            <div className="chart-navigation-button__icon-wrapper">
              <img
                src={currencyIcon}
                alt={selectedBase}
                className="chart-navigation-button__icon"
              />
            </div>
          ) : isBitcoin ? (
            <div className="chart-navigation-button__bitcoin-icon">
              <span className="chart-navigation-button__bitcoin-letter">B</span>
            </div>
          ) : (
            <span className="chart-navigation-button__icon-placeholder">
              {selectedBase.substring(0, 2).toUpperCase()}
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
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {currentTime && timezone && (
        <div className="chart-navigation-button__time-display">
          <span>{currentTime}</span>
          <span>{timezone}</span>
        </div>
      )}
    </div>
  );
};

