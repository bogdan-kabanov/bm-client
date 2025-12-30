import { useState, useEffect } from 'react';
import './SpreadMonitor.css';

interface SpreadData {
  pair: string;
  current: number;
  avg1h: number;
  min: number;
  max: number;
  level: 'high' | 'medium' | 'low';
}

export function SpreadMonitor() {
  const [spreads, setSpreads] = useState<SpreadData[]>([
    {
      pair: 'BTC/USDT vs BTC/USDC',
      current: 2.3,
      avg1h: 1.8,
      min: 0.5,
      max: 3.2,
      level: 'high'
    },
    {
      pair: 'ETH/USDT vs ETH/USDC',
      current: 1.1,
      avg1h: 1.4,
      min: 0.3,
      max: 2.1,
      level: 'medium'
    }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpreads(prev => prev.map(spread => {
        const newCurrent = spread.current + (Math.random() - 0.5) * 0.5;
        return {
          ...spread,
          current: Math.max(0, newCurrent),
          level: newCurrent > 2 ? 'high' : newCurrent > 1 ? 'medium' : 'low'
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getProgressWidth = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'high': return '#45B734';
      case 'medium': return '#FFA500';
      case 'low': return '#FF6B6B';
      default: return '#888';
    }
  };

  return (
    <div className="spread-monitor">
      <h3 className="panel-title">Real-time Spread Monitor</h3>
      
      <div className="spreads-list">
        {spreads.map((spread, index) => (
          <div key={index} className="spread-item">
            <div className="spread-header">
              <span className="pair-name">{spread.pair}</span>
            </div>
            
            <div className="spread-current">
              <span className="current-label">Current:</span>
              <span 
                className="current-value" 
                style={{ color: getLevelColor(spread.level) }}
              >
                {spread.current.toFixed(2)}%
              </span>
              <span 
                className={`level-badge ${spread.level}`}
                style={{ backgroundColor: getLevelColor(spread.level) }}
              >
                {spread.level}
              </span>
            </div>

            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${getProgressWidth(spread.current, spread.max)}%`,
                  backgroundColor: getLevelColor(spread.level)
                }}
              />
            </div>

            <div className="spread-stats">
              <div className="stat-item">
                <span className="stat-label">Avg 1h:</span>
                <span className="stat-value">{spread.avg1h.toFixed(2)}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Min:</span>
                <span className="stat-value">{spread.min.toFixed(2)}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Max:</span>
                <span className="stat-value">{spread.max.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

