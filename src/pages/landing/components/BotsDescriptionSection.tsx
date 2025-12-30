import React from 'react';
import styles from './BotsDescriptionSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const BotsDescriptionSection: React.FC = () => {
  const { t } = useLanguage();

  const botCategories = [
    {
      category: t('landing.analystBots'),
      description: t('landing.analystBotsDescription'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="20" x2="12" y2="10"/>
          <line x1="18" y1="20" x2="18" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
      ),
      bots: [
        {
          name: t('landing.momentumScanner'),
          description: t('landing.momentumScannerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          )
        },
        {
          name: t('landing.volatilityAnalyzer'),
          description: t('landing.volatilityAnalyzerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          )
        },
        {
          name: t('landing.liquidityHunter'),
          description: t('landing.liquidityHunterDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
            </svg>
          )
        }
      ]
    },
    {
      category: t('landing.signalBots'),
      description: t('landing.signalBotsDescription'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      bots: [
        {
          name: t('landing.whaleTracker'),
          description: t('landing.whaleTrackerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 11a9 9 0 0118 0v3a2 2 0 01-2 2h-2a2 2 0 00-2 2v2a2 2 0 01-4 0v-2a2 2 0 00-2-2H8a2 2 0 01-2-2v-3z"/>
              <path d="M9 10h.01M15 10h.01"/>
            </svg>
          )
        },
        {
          name: t('landing.patternRecognizer'),
          description: t('landing.patternRecognizerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          )
        },
        {
          name: t('landing.newsSentiment'),
          description: t('landing.newsSentimentDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-5 0"/>
              <path d="M7 10h4M7 14h4"/>
            </svg>
          )
        }
      ]
    },
    {
      category: t('landing.aiCoreBots'),
      description: t('landing.aiCoreBotsDescription'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
        </svg>
      ),
      bots: [
        {
          name: t('landing.neuralExecutor'),
          description: t('landing.neuralExecutorDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          )
        },
        {
          name: t('landing.riskManager'),
          description: t('landing.riskManagerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          )
        },
        {
          name: t('landing.portfolioBalancer'),
          description: t('landing.portfolioBalancerDesc'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="2" x2="12" y2="22"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          )
        }
      ]
    }
  ];

  return (
    <section id="bots" className={styles.botsDescriptionSection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitleWhite}>{t('landing.specializedTradingBots')}</h2>
        <p className={landingStyles.sectionSubtitleWhite}>
          {t('landing.eachBotSpecializes')}
        </p>

        <div className={styles.botsCategories}>
          {botCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className={styles.categoryBlock}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>{category.icon}</span>
                <div className={styles.categoryInfo}>
                  <h3 className={styles.categoryTitle}>{category.category}</h3>
                  <p className={styles.categoryDescription}>{category.description}</p>
                </div>
              </div>

              <div className={styles.botsGrid}>
                {category.bots.map((bot, botIndex) => (
                  <div key={botIndex} className={styles.botCard}>
                    <div className={styles.botIcon}>{bot.icon}</div>
                    <h4 className={styles.botName}>{bot.name}</h4>
                    <p className={styles.botDescription}>{bot.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.botsWorkflow}>
          <h3 className={styles.workflowTitle}>{t('landing.howBotsWork')}</h3>
          <div className={styles.workflowSteps}>
            <div className={styles.workflowStep}>
              <div className={styles.stepIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div className={styles.stepContent}>
                <h4>{t('landing.dataCollection')}</h4>
                <p>{t('landing.dataCollectionDesc')}</p>
              </div>
            </div>
            <div className={styles.workflowArrow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div className={styles.workflowStep}>
              <div className={styles.stepIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                </svg>
              </div>
              <div className={styles.stepContent}>
                <h4>{t('landing.aiAnalysis')}</h4>
                <p>{t('landing.aiAnalysisDesc')}</p>
              </div>
            </div>
            <div className={styles.workflowArrow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div className={styles.workflowStep}>
              <div className={styles.stepIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <div className={styles.stepContent}>
                <h4>{t('landing.decisionMaking')}</h4>
                <p>{t('landing.decisionMakingDesc')}</p>
              </div>
            </div>
            <div className={styles.workflowArrow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div className={styles.workflowStep}>
              <div className={styles.stepIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div className={styles.stepContent}>
                <h4>{t('landing.execution')}</h4>
                <p>{t('landing.executionDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BotsDescriptionSection;
