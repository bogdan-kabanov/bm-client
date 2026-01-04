import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/src/app/providers/useLanguage';
import { useNavigate } from 'react-router-dom';
import bonusImage from '@src/assets/images/bonus/Bonus.png';
import './BonusPopup.css';

interface BonusPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BonusPopup: React.FC<BonusPopupProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60); // 24 hours in seconds

  useEffect(() => {
    if (!isOpen) return;

    // Load saved end time from localStorage or set new one
    const savedEndTime = localStorage.getItem('bonusTimerEndTime');
    let endTime: number;

    if (savedEndTime) {
      endTime = parseInt(savedEndTime, 10);
      // Check if timer has expired
      if (Date.now() > endTime) {
        // Timer expired, set new 24 hour timer
        endTime = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem('bonusTimerEndTime', endTime.toString());
      }
    } else {
      // First time, set 24 hour timer
      endTime = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem('bonusTimerEndTime', endTime.toString());
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        // Timer expired
        localStorage.removeItem('bonusTimerEndTime');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleDepositClick = () => {
    onClose();
    // Navigate with promo code and amount parameters
    navigate('/deposit?promoCode=WELCOME2026&amount=50');
  };

  if (!isOpen) return null;

  const popupContent = (
    <div className="bonus-popup-overlay" onClick={onClose}>
      <div className="bonus-popup" onClick={(e) => e.stopPropagation()}>
        <button 
          className="bonus-popup-close"
          onClick={onClose}
          aria-label={t('common.close') || 'Close'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="bonus-popup-content">
          <div className="bonus-popup-image-wrapper">
            <img src={bonusImage} alt="Bonus" className="bonus-popup-image" />
          </div>

          <h2 className="bonus-popup-title">
            {t('bonus.title', { defaultValue: '+100% to deposit' })}
          </h2>

          <p className="bonus-popup-subtitle">
            {t('bonus.subtitle', { defaultValue: 'Get a 100% bonus on your first deposit when you top up from $50' })}
          </p>

          <div className="bonus-popup-promocode">
            <div className="bonus-popup-promocode-label">
              {t('bonus.promoCodeLabel', { defaultValue: 'Promo code' })}
            </div>
            <div className="bonus-popup-promocode-value">
              WELCOME2026
            </div>
          </div>

          <div className="bonus-popup-timer">
            <div className="bonus-popup-timer-value">
              {formatTime(timeLeft)}
            </div>
          </div>

          <button 
            className="bonus-popup-button"
            onClick={handleDepositClick}
          >
            {t('bonus.depositButton', { defaultValue: 'Top up balance' })}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    // Try to find chart container first
    const chart_container = document.querySelector('.chart-section-wrapper');
    if (chart_container) {
      return createPortal(popupContent, chart_container);
    }
    // Fallback to body if chart container not found
    return createPortal(popupContent, document.body);
  }

  return null;
};

