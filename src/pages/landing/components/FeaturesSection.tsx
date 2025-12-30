import React from 'react';
import styles from './FeaturesSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const FeaturesSection: React.FC = () => {
  const { t } = useLanguage();

  const features = [
    {
      title: t('landing.feature1Title'),
      description: t('landing.feature1Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    },
    {
      title: t('landing.feature2Title'),
      description: t('landing.feature2Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      )
    },
    {
      title: t('landing.feature3Title'),
      description: t('landing.feature3Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      )
    },
    {
      title: t('landing.feature4Title'),
      description: t('landing.feature4Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      )
    },
    {
      title: t('landing.feature5Title'),
      description: t('landing.feature5Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
        </svg>
      )
    },
    {
      title: t('landing.feature6Title'),
      description: t('landing.feature6Desc'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      )
    }
  ];

  return (
    <section id="features" className={styles.featuresSection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitleWhite}>{t('landing.featuresTitle')}</h2>
        <p className={landingStyles.sectionSubtitleWhite}>
          {t('landing.blockMindDescription')}
        </p>
        
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.featureCard}>
              <div className={styles.featureIcon}>
                {feature.icon}
              </div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;