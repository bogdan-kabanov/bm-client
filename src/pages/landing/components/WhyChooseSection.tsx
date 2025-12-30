import React from 'react';
import styles from './WhyChooseSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const WhyChooseSection: React.FC = () => {
  const { t } = useLanguage();

  const advantages = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      ),
      title: t('landing.automationTitle'),
      description: t('landing.automationDesc'),
      highlight: '24/7'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: t('landing.securityTitle'),
      description: t('landing.securityDesc'),
      highlight: '100%'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      title: t('landing.analyticsTitle'),
      description: t('landing.analyticsDesc'),
      highlight: 'Real-time'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ),
      title: t('landing.profitabilityTitle'),
      description: t('landing.profitabilityDesc'),
      highlight: '50-300%'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
        </svg>
      ),
      title: t('landing.multiExchangeTitle'),
      description: t('landing.multiExchangeDesc'),
      highlight: '15+'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      title: t('landing.easyToUseTitle'),
      description: t('landing.easyToUseDesc'),
      highlight: '2 min'
    }
  ];

  return (
    <section id="why-choose" className={styles.whyChooseSection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitle}>{t('landing.whyChooseBlockMind')}</h2>
        <p className={landingStyles.sectionSubtitle}>
          {t('landing.whyChooseSubtitle')}
        </p>

        <div className={styles.advantagesGrid}>
          {advantages.map((advantage, index) => (
            <div key={index} className={styles.advantageCard}>
              <div className={styles.advantageIconWrapper}>
                <span className={styles.advantageIcon}>{advantage.icon}</span>
                <span className={styles.advantageHighlight}>{advantage.highlight}</span>
              </div>
              <h3 className={styles.advantageTitle}>{advantage.title}</h3>
              <p className={styles.advantageDescription}>{advantage.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.comparisonSection}>
          <h3 className={styles.comparisonTitle}>{t('landing.traditionalVsBlockMind')}</h3>
          <div className={styles.comparisonGrid}>
            <div className={`${styles.comparisonColumn} ${styles.traditional}`}>
              <div className={styles.columnHeader}>
                <h4>{t('landing.traditionalTrading')}</h4>
              </div>
              <ul className={styles.comparisonList}>
                <li>❌ {t('landing.traditional1')}</li>
                <li>❌ {t('landing.traditional2')}</li>
                <li>❌ {t('landing.traditional3')}</li>
                <li>❌ {t('landing.traditional4')}</li>
                <li>❌ {t('landing.traditional5')}</li>
                <li>❌ {t('landing.traditional6')}</li>
              </ul>
            </div>

            <div className={`${styles.comparisonColumn} ${styles.blockmind}`}>
              <div className={styles.columnHeader}>
                <h4>{t('landing.blockMindTrading')}</h4>
              </div>
              <ul className={styles.comparisonList}>
                <li>✅ {t('landing.blockmind1')}</li>
                <li>✅ {t('landing.blockmind2')}</li>
                <li>✅ {t('landing.blockmind3')}</li>
                <li>✅ {t('landing.blockmind4')}</li>
                <li>✅ {t('landing.blockmind5')}</li>
                <li>✅ {t('landing.blockmind6')}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}>
            <div className={styles.trustValue}>10,000+</div>
            <div className={styles.trustLabel}>{t('landing.activeUsers')}</div>
          </div>
          <div className={styles.trustItem}>
            <div className={styles.trustValue}>$50M+</div>
            <div className={styles.trustLabel}>{t('landing.tradingVolume')}</div>
          </div>
          <div className={styles.trustItem}>
            <div className={styles.trustValue}>99.9%</div>
            <div className={styles.trustLabel}>{t('landing.uptime')}</div>
          </div>
          <div className={styles.trustItem}>
            <div className={styles.trustValue}>4.9/5</div>
            <div className={styles.trustLabel}>{t('landing.userRating')}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;

