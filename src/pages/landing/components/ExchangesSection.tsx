import React, { useState } from 'react';
import styles from './ExchangesSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const ExchangesSection: React.FC = () => {
  const { t } = useLanguage();
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index));
  };

  const exchanges = [
    {
      name: 'Binance',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png'
    },
    {
      name: 'Coinbase',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/89.png'
    },
    {
      name: 'Kraken',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/24.png'
    },
    {
      name: 'KuCoin',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png'
    },
    {
      name: 'Bybit',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/524.png'
    },
    {
      name: 'OKX',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png'
    },
    {
      name: 'Gate.io',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png'
    },
    {
      name: 'Huobi',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/102.png'
    },
    {
      name: 'Bitfinex',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/37.png'
    },
    {
      name: 'Bitstamp',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/70.png'
    },
    {
      name: 'Gemini',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/151.png'
    },
    {
      name: 'Crypto.com',
      logo: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png'
    }
  ];

  return (
    <section className={styles.exchangesSection}>
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitle}>{t('landing.supportedExchanges')}</h2>
        <p className={landingStyles.sectionSubtitle}>
          {t('landing.connectToMajor')}
        </p>

        <div className={styles.exchangesGrid}>
          {exchanges.map((exchange, index) => (
            <div key={index} className={styles.exchangeCard}>
              <div className={styles.exchangeLogo}>
                {imageErrors.has(index) ? (
                  <div className={styles.logoFallback}>
                    {exchange.name.charAt(0)}
                  </div>
                ) : (
                  <img 
                    src={exchange.logo} 
                    alt={exchange.name}
                    onError={() => handleImageError(index)}
                    loading="lazy"
                  />
                )}
              </div>
              <div className={styles.exchangeName}>{exchange.name}</div>
            </div>
          ))}
        </div>

        <div className={styles.exchangesCta}>
          <p>{t('landing.andManyMore')}</p>
        </div>
      </div>
    </section>
  );
};

export default ExchangesSection;
