import React, { useState } from 'react';
import styles from './ProfitabilitySection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const ProfitabilitySection: React.FC = () => {
  const { t } = useLanguage();
  const [depositAmount, setDepositAmount] = useState(100);

  const calculateProfit = (amount: number) => {
    let dailyMin, dailyMax, monthlyMin, monthlyMax, yearlyMin, yearlyMax, cumulativeLevel, cumulativeEffect;

    if (amount < 100) {
      // 40-60% daily
      dailyMin = amount * 0.40;
      dailyMax = amount * 0.60;
      monthlyMin = amount * 12;
      monthlyMax = amount * 15;
      yearlyMin = amount * 90;
      yearlyMax = amount * 100;
      cumulativeLevel = 20;
      cumulativeEffect = 'weak';
    } else if (amount < 200) {
      // 50-70% daily
      dailyMin = amount * 0.50;
      dailyMax = amount * 0.70;
      monthlyMin = amount * 13;
      monthlyMax = amount * 17;
      yearlyMin = amount * 95;
      yearlyMax = amount * 105;
      cumulativeLevel = 35;
      cumulativeEffect = 'low';
    } else if (amount < 400) {
      // 60-80% daily
      dailyMin = amount * 0.60;
      dailyMax = amount * 0.80;
      monthlyMin = amount * 15;
      monthlyMax = amount * 20;
      yearlyMin = amount * 100;
      yearlyMax = amount * 110;
      cumulativeLevel = 50;
      cumulativeEffect = 'average';
    } else if (amount < 700) {
      // 70-90% daily
      dailyMin = amount * 0.70;
      dailyMax = amount * 0.90;
      monthlyMin = amount * 18;
      monthlyMax = amount * 22;
      yearlyMin = amount * 105;
      yearlyMax = amount * 115;
      cumulativeLevel = 65;
      cumulativeEffect = 'high';
    } else if (amount < 1000) {
      // 80-100% daily
      dailyMin = amount * 0.80;
      dailyMax = amount * 1.00;
      monthlyMin = amount * 20;
      monthlyMax = amount * 23;
      yearlyMin = amount * 108;
      yearlyMax = amount * 118;
      cumulativeLevel = 80;
      cumulativeEffect = 'very high';
    } else {
      // 100-120% daily - максимум до 5000
      dailyMin = amount * 1.00;
      dailyMax = amount * 1.20;
      monthlyMin = amount * 22;
      monthlyMax = amount * 25;
      yearlyMin = amount * 110;
      yearlyMax = amount * 120;
      // Плавно растет от 80% до 100% в диапазоне 1000-5000
      cumulativeLevel = Math.min(100, 80 + ((amount - 1000) / 4000) * 20);
      cumulativeEffect = 'maximum';
    }

    return {
      daily: { min: dailyMin.toFixed(2), max: dailyMax.toFixed(2) },
      monthly: { min: monthlyMin.toFixed(2), max: monthlyMax.toFixed(2) },
      yearly: { min: yearlyMin.toFixed(2), max: yearlyMax.toFixed(2) },
      cumulativeLevel,
      cumulativeEffect
    };
  };

  const profit = calculateProfit(depositAmount);

  return (
    <section id="profitability" className={styles.profitabilitySection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitle}>{t('landing.calculationOfProfitability')}</h2>
        <p className={landingStyles.sectionSubtitle}>
          {t('landing.aiSystemProcesses')}
        </p>

        <div className={styles.calculatorContainer}>
          <div className={styles.calculatorInput}>
            <label htmlFor="deposit-amount">{t('trading.investmentAmount')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.currencySymbol}>$</span>
              <input
                id="deposit-amount"
                type="range"
                min="50"
                max="5000"
                step="50"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className={styles.depositSlider}
              />
              <input
                type="number"
                min="50"
                max="5000"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className={styles.depositInput}
              />
            </div>
          </div>

          <div className={styles.profitDisplay}>
            <div className={styles.profitCard}>
              <h4>{t('landing.dailyProfit')}</h4>
              <p className={styles.profitValue}>${profit.daily.min} - ${profit.daily.max}</p>
            </div>
            <div className={styles.profitCard}>
              <h4>{t('landing.monthlyProfit')}</h4>
              <p className={styles.profitValue}>${profit.monthly.min} - ${profit.monthly.max}</p>
            </div>
            <div className={styles.profitCard}>
              <h4>{t('landing.yearlyProfit')}</h4>
              <p className={styles.profitValue}>${profit.yearly.min} - ${profit.yearly.max}</p>
            </div>
          </div>

          <div className={styles.riskInfo}>
            <div className={styles.riskItem}>
              <span className={styles.riskLabel}>{t('landing.cumulativeEffect')}:</span>
              <div className={styles.riskBar}>
                <div 
                  className={styles.riskFill} 
                  style={{ width: `${profit.cumulativeLevel}%` }}
                ></div>
              </div>
              <span className={styles.riskValue}>{Math.round(profit.cumulativeLevel)}%</span>
            </div>
            <div className={styles.riskItem}>
              <span className={styles.riskLabel}>{t('landing.cumulativeEffect')}:</span>
              <span className={styles.effectBadge}>{t(`landing.cumulativeEffect${profit.cumulativeEffect.charAt(0).toUpperCase() + profit.cumulativeEffect.slice(1).replace(' ', '')}`)}</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ProfitabilitySection;

