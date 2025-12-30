import React, { useState, useEffect } from 'react';
import styles from './LiveStats.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const LiveStats: React.FC = () => {
  const { t } = useLanguage();
  const [onlineUsers, setOnlineUsers] = useState(147);
  const [recentRegistrations, setRecentRegistrations] = useState(23);
  const [totalTrades, setTotalTrades] = useState(12450);

  useEffect(() => {
    // Simulate live user count changes
    const userInterval = setInterval(() => {
      setOnlineUsers(prev => {
        const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
        return Math.max(120, Math.min(200, prev + change));
      });
    }, 8000);

    // Simulate registration updates
    const regInterval = setInterval(() => {
      setRecentRegistrations(prev => {
        const change = Math.floor(Math.random() * 3);
        return Math.max(15, Math.min(35, prev + change));
      });
    }, 15000);

    // Simulate trade count increments
    const tradeInterval = setInterval(() => {
      setTotalTrades(prev => prev + Math.floor(Math.random() * 15) + 5);
    }, 3000);

    return () => {
      clearInterval(userInterval);
      clearInterval(regInterval);
      clearInterval(tradeInterval);
    };
  }, []);

  return (
    <div className={styles.liveStatsBanner}>
      <div className={styles.statsContainer}>
        <div className={styles.statItem}>
          <div className={`${styles.statIcon} ${styles.onlinePulse}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{onlineUsers}</div>
            <div className={styles.statLabel}>{t('landing.liveStats.usersOnline')}</div>
          </div>
        </div>

        <div className={styles.statDivider}></div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <div className={`${styles.statValue} ${styles.pulseNumber}`}>{recentRegistrations}</div>
            <div className={styles.statLabel}>{t('landing.liveStats.joinedLastHour')}</div>
          </div>
        </div>

        <div className={styles.statDivider}></div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{totalTrades.toLocaleString()}</div>
            <div className={styles.statLabel}>{t('landing.liveStats.tradesToday')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStats;
