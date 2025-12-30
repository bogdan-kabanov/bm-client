// components/ArbitrageSection.tsx
import React, { useEffect, useState } from 'react';
import styles from './ArbitrageSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';
import StatsSection from './StatsSection';

const ArbitrageSection: React.FC = () => {
  const { t } = useLanguage();
  const [priceDiff, setPriceDiff] = useState(0);
  const [leftData, setLeftData] = useState<number[]>([]);
  const [rightData, setRightData] = useState<number[]>([]);

  useEffect(() => {
    const generateData = (count: number) => {
      const data = [];
      let value = 100 + Math.random() * 20;
      for (let i = 0; i < count; i++) {
        value += (Math.random() - 0.5) * 10;
        value = Math.max(80, Math.min(130, value));
        data.push(value);
      }
      return data;
    };

    const animatePriceDifference = () => {
      const newDiff = Math.random() * 2 - 1;
      setPriceDiff(newDiff);
      
      const leftChartData = generateData(20);
      const rightChartData = leftChartData.map(val => val * (1 + (Math.random() * 0.04 - 0.02)));
      
      setLeftData(leftChartData);
      setRightData(rightChartData);
    };

    animatePriceDifference();
    const interval = setInterval(animatePriceDifference, 3000);
    return () => clearInterval(interval);
  }, []);

  const renderChart = (data: number[], color: string) => {
    if (data.length === 0) return null;
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 80;
      return `${x},${y}`;
    }).join(' ');

    const pathD = `M0,100 L${points} L100,100 Z`;

    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.chartSvg}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill={`url(#gradient-${color})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
        />
      </svg>
    );
  };

  return (
    <section id="arbitrage" className={styles.arbitrageSection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitleWhite}>{t('trading.title')}</h2>
        <p className={landingStyles.sectionSubtitleWhite}>{t('landing.tradeCryptoDescription')}</p>
        
        <div className={styles.arbitrageDisplay}>
          <div className={`${styles.chartContainer} ${styles.leftChart}`}>
            {renderChart(leftData, '#10b981')}
            <div className={styles.chartOverlay}>
              <div className={styles.exchangeLabel}>
                <svg viewBox="0 0 32 32" fill="none" className={styles.exchangeIcon}>
                  <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
                  <g fill="white">
                    <path d="M16 6.5l3.5 3.5-3.5 3.5-3.5-3.5 3.5-3.5z"/>
                    <path d="M9.5 13l3.5 3.5-3.5 3.5L6 16.5l3.5-3.5z"/>
                    <path d="M22.5 13L26 16.5l-3.5 3.5-3.5-3.5 3.5-3.5z"/>
                    <path d="M16 19.5l3.5 3.5-3.5 3.5-3.5-3.5 3.5-3.5z"/>
                    <rect x="14.5" y="14.5" width="3" height="3"/>
                  </g>
                </svg>
                <span>Binance</span>
              </div>
              <div className={styles.priceInfo}>
                <div className={styles.price}>${leftData[leftData.length - 1]?.toFixed(2) || '0.00'}</div>
                <div className={`${styles.change} ${styles.positive}`}>+1.23%</div>
              </div>
            </div>
          </div>

          <div className={styles.centerAnimation}>
            <div className={styles.priceDiff}>
              <div className={styles.diffIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="7 13 12 18 17 13"/>
                  <polyline points="7 6 12 11 17 6"/>
                </svg>
              </div>
              <span className={`${styles.diffValue} ${priceDiff >= 0 ? styles.positive : styles.negative}`}>
                {priceDiff >= 0 ? '+' : ''}{priceDiff.toFixed(2)}%
              </span>
              <div className={styles.arbitrageOpportunity}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.profitIcon}>
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
                {t('trading.profit')}: ${(Math.abs(priceDiff) * 1000).toFixed(2)}
              </div>
            </div>
            <div className={styles.animationPulse}></div>
          </div>

          <div className={`${styles.chartContainer} ${styles.rightChart}`}>
            {renderChart(rightData, '#3b82f6')}
            <div className={styles.chartOverlay}>
              <div className={styles.exchangeLabel}>
                <svg viewBox="0 0 32 32" fill="none" className={styles.exchangeIcon}>
                  <circle cx="16" cy="16" r="16" fill="#0052FF"/>
                  <path d="M16 4C9.37 4 4 9.37 4 16s5.37 12 12 12 12-5.37 12-12S22.63 4 16 4zm5.5 13h-5v5h-1v-5h-5v-1h5v-5h1v5h5v1z" fill="white"/>
                </svg>
                <span>Coinbase</span>
              </div>
              <div className={styles.priceInfo}>
                <div className={styles.price}>${rightData[rightData.length - 1]?.toFixed(2) || '0.00'}</div>
                <div className={`${styles.change} ${styles.negative}`}>-0.87%</div>
              </div>
            </div>
          </div>
        </div>

        <StatsSection />
      </div>
    </section>
  );
};

export default ArbitrageSection;
