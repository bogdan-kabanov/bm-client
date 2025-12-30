import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './LiveArbitrageFeed.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

interface ArbitrageTrade {
  id: string;
  crypto: string;
  fromExchange: string;
  toExchange: string;
  profit: number;
  percentage: number;
  timestamp: Date;
}

const CRYPTOS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC'];
const EXCHANGES = ['Binance', 'Coinbase', 'Kraken', 'KuCoin', 'Bybit', 'OKX', 'Gate.io', 'Huobi'];

const LiveArbitrageFeed: React.FC = () => {
  const { t } = useLanguage();
  const [trades, setTrades] = useState<ArbitrageTrade[]>([]);

  const tradeCounterRef = useRef(0);

  const generateTrade = useCallback((): ArbitrageTrade => {
    tradeCounterRef.current += 1;
    const crypto = CRYPTOS[Math.floor(Math.random() * CRYPTOS.length)];
    const fromIdx = Math.floor(Math.random() * EXCHANGES.length);
    let toIdx = Math.floor(Math.random() * EXCHANGES.length);
    while (toIdx === fromIdx) {
      toIdx = Math.floor(Math.random() * EXCHANGES.length);
    }
    
    return {
      id: `${Date.now()}-${tradeCounterRef.current}`,
      crypto,
      fromExchange: EXCHANGES[fromIdx],
      toExchange: EXCHANGES[toIdx],
      profit: Math.random() * 150 + 20, // $20-$170
      percentage: Math.random() * 0.8 + 0.3, // 0.3-1.1%
      timestamp: new Date()
    };
  }, []);

  useEffect(() => {
    // Initial trades
    const initialTrades = Array.from({ length: 8 }, generateTrade);
    setTrades(initialTrades);

    // Add new trade every 3-7 seconds
    const interval = setInterval(() => {
      const newTrade = generateTrade();
      setTrades(prev => [newTrade, ...prev].slice(0, 8)); // Keep only last 8
    }, Math.random() * 4000 + 3000); // 3-7 seconds

    return () => clearInterval(interval);
  }, [generateTrade]);

  return (
    <div className={styles.liveArbitrageFeed}>
      <div className={styles.feedContainer}>
        <div className={styles.feedHeader}>
        <div className={styles.headerContent}>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot}></span>
            <span className={styles.liveText}>{t('landing.liveArbitrage.live')}</span>
          </div>
          <h3>{t('landing.liveArbitrage.title')}</h3>
        </div>
      </div>
      
      <div className={styles.tradesList}>
        {trades.map((trade, index) => (
          <div 
            key={trade.id} 
            className={styles.tradeItem}
            style={{ 
              animationDelay: `${index * 0.1}s`,
              opacity: 1 - (index * 0.12)
            }}
          >
            <div className={styles.tradeCrypto}>
              <span className={styles.cryptoBadge}>{trade.crypto}</span>
            </div>
            <div className={styles.tradeRoute}>
              <span className={`${styles.exchange} ${styles.from}`}>{trade.fromExchange}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.arrow}>
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
              <span className={`${styles.exchange} ${styles.to}`}>{trade.toExchange}</span>
            </div>
            <div className={styles.tradeProfit}>
              <span className={styles.profitAmount}>+${trade.profit.toFixed(2)}</span>
              <span className={styles.profitPercent}>+{trade.percentage.toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

export default LiveArbitrageFeed;
