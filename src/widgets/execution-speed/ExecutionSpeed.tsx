import { useState, useEffect } from 'react';
import './ExecutionSpeed.css';

interface ExchangeLatency {
  name: string;
  latency: number;
  status: 'fast' | 'good' | 'slow';
}

export function ExecutionSpeed() {
  const [avgSpeed] = useState<number>(1.2);
  const [fastestTrade] = useState<number>(0.8);
  const [slowestTrade] = useState<number>(3.5);
  const [exchanges, setExchanges] = useState<ExchangeLatency[]>([
    { name: 'Binance', latency: 23, status: 'fast' },
    { name: 'Bybit', latency: 45, status: 'good' },
    { name: 'Kraken', latency: 120, status: 'slow' }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate latency updates
      setExchanges(prev => prev.map(ex => ({
        ...ex,
        latency: ex.latency + Math.floor(Math.random() * 10 - 5),
        status: ex.latency < 50 ? 'fast' : ex.latency < 100 ? 'good' : 'slow'
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fast': return '#45B734';
      case 'good': return '#FFA500';
      case 'slow': return '#FF0000';
      default: return '#888';
    }
  };

  return (
    <div className="execution-speed">
      <h3 className="panel-title">Execution Performance</h3>
      
      <div className="speed-stats">
        <div className="stat-row">
          <span className="stat-label">Avg Speed:</span>
          <span className="stat-value">{avgSpeed}s</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Fastest:</span>
          <span className="stat-value fast">{fastestTrade}s</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Slowest:</span>
          <span className="stat-value slow">{slowestTrade}s</span>
        </div>
      </div>

      <div className="exchange-latency">
        <h4 className="section-subtitle">Exchange Latency</h4>
        {exchanges.map((exchange) => (
          <div key={exchange.name} className="latency-item">
            <span 
              className="status-dot" 
              style={{ backgroundColor: getStatusColor(exchange.status) }}
            />
            <span className="exchange-name">{exchange.name}:</span>
            <span className="latency-value">{exchange.latency}ms</span>
            <span 
              className={`status-label ${exchange.status}`}
              style={{ color: getStatusColor(exchange.status) }}
            >
              {exchange.status === 'fast' ? 'Fast' : exchange.status === 'good' ? 'Good' : 'Slow'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

