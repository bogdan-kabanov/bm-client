import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/src/app/providers/useLanguage';
import './PriceReachedNotification.css';

interface PriceReachedNotificationProps {
  id: string;
  price: number;
  currencyPair: string;
  onClose: (id: string) => void;
}

export const PriceReachedNotification: React.FC<PriceReachedNotificationProps> = ({
  id,
  price,
  currencyPair,
  onClose
}) => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10);
    
    // Автоматическое закрытие через 5 секунд
    const timeout = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => onClose(id), 300);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [id, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(id), 300);
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(5);
  };

  return (
    <div 
      className={`price-reached-notification ${isVisible && !isClosing ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div className="price-reached-notification-content">
        <div className="price-reached-icon">
          🔔
        </div>
        <div className="price-reached-info">
          <div className="price-reached-header">
            <span className="price-reached-label">
              {t('trading.priceLevel')} {t('trading.reached')}
            </span>
          </div>
          <div className="price-reached-pair">
            {currencyPair === 'default' ? 'N/A' : currencyPair.replace('_', '/').replace('-', '/')}
          </div>
          <div className="price-reached-price-label">
            {t('trading.priceLevelLabel')}:
          </div>
          <div className="price-reached-price-value">
            {formatPrice(price)}
          </div>
        </div>
        <button 
          className="price-reached-close"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          aria-label={t('common.close')}
        >
          ×
        </button>
      </div>
    </div>
  );
};

