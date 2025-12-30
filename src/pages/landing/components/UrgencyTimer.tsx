import React, { useState, useEffect } from 'react';
import styles from './UrgencyTimer.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

interface UrgencyTimerProps {
  onGetStarted: () => void;
}

const UrgencyTimer: React.FC<UrgencyTimerProps> = ({ onGetStarted }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({
    hours: 2,
    minutes: 30,
    seconds: 0
  });
  const [spotsLeft, setSpotsLeft] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              // Reset timer when it reaches 0
              hours = 2;
              minutes = 30;
              seconds = 0;
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    // Randomly decrease spots
    const spotsTimer = setInterval(() => {
      setSpotsLeft(prev => {
        if (prev > 2 && Math.random() > 0.7) {
          return prev - 1;
        }
        return prev;
      });
    }, 45000); // Check every 45 seconds

    return () => {
      clearInterval(timer);
      clearInterval(spotsTimer);
    };
  }, []);

  return (
    <div className={styles.urgencyTimerBanner}>
      <div className={styles.timerWrapper}>
        <div className={styles.timerContainer}>
        <div className={styles.timerContent}>
          <div className={styles.timerIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          
          <div className={styles.timerInfo}>
            <div className={styles.timerTitle}>
              🔥 {t('landing.urgencyTimer.specialOffer')} - <span className={styles.highlight}>{t('landing.urgencyTimer.firstMonth')}</span> ({t('landing.urgencyTimer.save')})
            </div>
            <div className={styles.timerSubtitle}>
              {t('landing.urgencyTimer.onlySpots')} <span className={styles.spotsLeft}>{spotsLeft} {t('landing.urgencyTimer.spotsLeft')}</span>
            </div>
          </div>
        </div>

        <div className={styles.timerDisplay}>
          <div className={styles.timeBlock}>
            <div className={styles.timeValue}>{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className={styles.timeLabel}>{t('landing.urgencyTimer.hours')}</div>
          </div>
          <div className={styles.timeSeparator}>:</div>
          <div className={styles.timeBlock}>
            <div className={styles.timeValue}>{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className={styles.timeLabel}>{t('landing.urgencyTimer.minutes')}</div>
          </div>
          <div className={styles.timeSeparator}>:</div>
          <div className={styles.timeBlock}>
            <div className={styles.timeValue}>{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className={styles.timeLabel}>{t('landing.urgencyTimer.seconds')}</div>
          </div>
        </div>

        <button className={styles.timerCtaBtn} onClick={onGetStarted}>
          {t('landing.urgencyTimer.claimNow')}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        </div>
      </div>
    </div>
  );
};

export default UrgencyTimer;
