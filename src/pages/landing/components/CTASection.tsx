import React from 'react';
import styles from './CTASection.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

interface CTASectionProps {
  onGetStarted: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ onGetStarted }) => {
  const { t } = useLanguage();

  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaContainer}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>{t('landing.ctaTitle')}</h2>
          <p className={styles.ctaSubtitle}>{t('landing.ctaSubtitle')}</p>
          
          <div className={styles.ctaFeatures}>
            <div className={styles.ctaFeature}>
              <span className={styles.featureIcon}>✓</span>
              <span>{t('landing.ctaFeature1')}</span>
            </div>
            <div className={styles.ctaFeature}>
              <span className={styles.featureIcon}>✓</span>
              <span>{t('landing.ctaFeature2')}</span>
            </div>
            <div className={styles.ctaFeature}>
              <span className={styles.featureIcon}>✓</span>
              <span>{t('landing.ctaFeature3')}</span>
            </div>
          </div>

          <button className={styles.ctaButton} onClick={onGetStarted}>
            {t('landing.getStartedNow')}
            <span className={styles.buttonArrow}>→</span>
          </button>
        </div>

        <div className={styles.ctaVisual}>
          <div className={styles.profitAnimation}>
            <div className={styles.profitCard}>
              <div className={styles.profitLabel}>{t('landing.todayProfit')}</div>
              <div className={styles.profitAmount}>+$447.32</div>
              <div className={styles.profitPercentage}>+2.47%</div>
            </div>
            <div className={styles.profitCard}>
              <div className={styles.profitLabel}>{t('landing.thisWeek')}</div>
              <div className={styles.profitAmount}>+$2,823.45</div>
              <div className={styles.profitPercentage}>+18.23%</div>
            </div>
            <div className={styles.profitCard}>
              <div className={styles.profitLabel}>{t('landing.thisMonth')}</div>
              <div className={styles.profitAmount}>+$10,456.89</div>
              <div className={styles.profitPercentage}>+74.57%</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;

