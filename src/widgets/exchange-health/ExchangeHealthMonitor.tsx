import { useState, useEffect } from 'react';
import './ExchangeHealthMonitor.css';

interface ExchangeStatus {
  name: string;
  status: 'online' | 'slow' | 'offline';
  latency: number | null;
}

export function ExchangeHealthMonitor() {
  const [exchanges, setExchanges] = useState<ExchangeStatus[]>([
    { name: 'Binance', status: 'online', latency: 23 },
    { name: 'Bybit', status: 'online', latency: 45 },
    { name: 'KuCoin', status: 'slow', latency: 320 },
    { name: 'Kraken', status: 'online', latency: 87 }
  ]);

  const [lastUpdated, setLastUpdated] = useState<number>(0);

  useEffect(() => {
    const updateExchanges = () => {
      setExchanges(prev => prev.map(ex => {
        // Simulate status changes
        const latencyChange = Math.floor(Math.random() * 40 - 20);
        const newLatency = ex.latency ? Math.max(10, ex.latency + latencyChange) : null;
        
        let newStatus: 'online' | 'slow' | 'offline' = 'online';
        if (newLatency === null || Math.random() < 0.05) {
          newStatus = 'offline';
        } else if (newLatency > 200) {
          newStatus = 'slow';
        }
        
        return {
          ...ex,
          latency: newStatus === 'offline' ? null : newLatency,
          status: newStatus
        };
      }));
      setLastUpdated(Date.now());
    };

    updateExchanges();
    const interval = setInterval(updateExchanges, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '●';
      case 'slow': return '⚠️';
      case 'offline': return '🔴';
      default: return '●';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#45B734';
      case 'slow': return '#FFA500';
      case 'offline': return '#FF0000';
      default: return '#888';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'slow': return 'Slow';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    return `${seconds}s ago`;
  };

  return (
    <div className="exchange-health-monitor">
      <h3 className="panel-title">Exchange Status</h3>
      
      <div className="exchanges-list">
        {exchanges.map((exchange) => (
          <div key={exchange.name} className="exchange-status-item">
            <span 
              className="status-icon" 
              style={{ color: getStatusColor(exchange.status) }}
            >
              {getStatusIcon(exchange.status)}
            </span>
            <span className="exchange-name">{exchange.name}:</span>
            <span 
              className="status-text" 
              style={{ color: getStatusColor(exchange.status) }}
            >
              {getStatusText(exchange.status)}
            </span>
            <span className="latency-value">
              {exchange.latency !== null ? `${exchange.latency}ms` : '-'}
            </span>
          </div>
        ))}
      </div>

      <div className="update-time">
        Last updated: {getTimeSinceUpdate()}
      </div>
    </div>
  );
}

