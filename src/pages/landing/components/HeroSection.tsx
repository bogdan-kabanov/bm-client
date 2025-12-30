import React from 'react';
import styles from './HeroSection.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';
import LiveArbitrageFeed from './LiveArbitrageFeed';

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted }) => {
  const { t } = useLanguage();

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {t('landing.heroTitle')}
          </h1>
          <p className={styles.heroSubtitle}>
            {t('landing.heroSubtitle')}
          </p>
          <div className={styles.heroStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>99.9% </span>
              <span className={styles.statLabel}>{t('landing.uptime')}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>12ms </span>
              <span className={styles.statLabel}>{t('landing.latency')}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>24/7 </span>
              <span className={styles.statLabel}>{t('landing.monitoring')}</span>
            </div>
          </div>
          <div className={styles.heroButtons}>
            <button className={styles.primaryBtn} onClick={onGetStarted}>
              {t('landing.getStarted')}
            </button>
          </div>
        </div>
        <div className={styles.heroVisual}>
          {/* <div className={styles.floatingCards}>
            <div className={`${styles.card} ${styles.card1}`}>
              <span className={styles.cardProfit}>+$127</span>
              <span className={styles.cardPair}>BTC: Binance→Kraken</span>
            </div>
            <div className={`${styles.card} ${styles.card2}`}>
              <span className={styles.cardProfit}>+$85</span>
              <span className={styles.cardPair}>ETH: Coinbase→KuCoin</span>
            </div>
            <div className={`${styles.card} ${styles.card3}`}>
              <span className={styles.cardProfit}>+$43</span>
              <span className={styles.cardPair}>SOL: Bybit→Binance</span>
            </div>
          </div> */}

        <LiveArbitrageFeed />

        </div>
      </div>
    </section>
  );
};

export default HeroSection;