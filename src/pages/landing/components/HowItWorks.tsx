import React, { useState } from 'react';
import styles from './HowItWorks.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

interface HowItWorksProps {
  onGetStarted: () => void;
}

const HowItWorks: React.FC<HowItWorksProps> = ({ onGetStarted }) => {
  const { t } = useLanguage();
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <>
      <section id="how-it-works" className={styles.howItWorksSection}>
        <div className={styles.sectionContainer}>

          <div className={styles.ctaSection}>
            <h3 className={styles.ctaTitle}>{t('landing.readyToExperience')}</h3>
            <p className={styles.ctaSubtitle}>{t('landing.joinThousands')}</p>
            <div className={styles.ctaButtons}>
              <button 
                className={`${styles.ctaButton} ${styles.primary}`}
                onClick={onGetStarted}
              >
                {t('landing.startTrading')}
              </button>
              <button 
                className={`${styles.ctaButton} ${styles.secondary}`}
                onClick={() => setIsPopupOpen(true)}
              >
                {t('landing.howDoesItWork')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Popup Modal */}
      {isPopupOpen && (
        <div className={styles.popupOverlay} onClick={() => setIsPopupOpen(false)}>
          <div className={styles.howItWorksPopup} onClick={e => e.stopPropagation()}>
            <button 
              className={styles.popupClose}
              onClick={() => setIsPopupOpen(false)}
            >
              ×
            </button>
            
            <h2 className={styles.popupTitle}>❔How does BlockMind work and what is crypto arbitrage?</h2>
            
            <div className={styles.popupContent}>
              <div className={styles.textSection}>
                <p>
                  Crypto arbitrage is a strategy for earning money on the difference in prices of the same cryptocurrency 
                  on different trading platforms, when an asset is bought cheaper and sold more expensive at the same time. 
                  This strategy is considered low-risk because it does not require market forecasting, but it does require 
                  quick action, the use of special scanners to find price discrepancies, and a significant initial investment 
                  to cover commissions and ensure high transaction speeds.
                </p>
              </div>

              <div className={styles.highlightSection}>
                <h3>Why do you need BlockMind for crypto arbitrage?</h3>
                <p>
                  Of course, you can do it manually. Search, buy, resell, search again, buy again, and resell. But how long would that take? Hours?
                </p>
                <p>
                  <strong>BlockMind analyzes hundreds of currencies on five exchanges in literally seconds and allows you to instantly buy cheaper and sell higher.</strong>
                </p>
              </div>

              <div className={styles.benefitsSection}>
                <h3>Why is this the best way to make money on cryptocurrencies?</h3>
                <p className={styles.benefitsIntro}>
                  Because you don't take any risks. You don't need to look for signals, you don't need to understand cryptocurrencies, 
                  you don't need to repeat other people's signals and lose your money.
                </p>
                <ul className={styles.benefitsList}>
                  <li>✔️ It's legal</li>
                  <li>✔️ You don't take any risks</li>
                  <li>✔️ You always control your money</li>
                </ul>
              </div>

              <div className={styles.ctaBox}>
                <p>
                  To launch the bot, top up your balance, just click <strong>"Start Trading,"</strong> and it will work for you and make money. 💲
                </p>
              </div>
            </div>

            <div className={styles.popupActions}>
              <button 
                className={`${styles.popupButton} ${styles.primary}`}
                onClick={() => setIsPopupOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HowItWorks;