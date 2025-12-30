import { useState, useEffect } from 'react';
import './ProfitStatsPanel.css';
import { statsApi } from '@/src/shared/api';

interface ProfitStats {
  totalEarned: number;
}

export function ProfitStatsPanel() {
  const [stats, setStats] = useState<ProfitStats>({
    totalEarned: 7664283
  });

  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const serverStats = await statsApi.getStats();
      setStats(serverStats);
    } catch (err) {

      setStats({
        totalEarned: 7664283
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Начальная загрузка статистики
    fetchStats();
    
    // Обработчик обновлений через WebSocket
    const handleStatsUpdate = (event: CustomEvent) => {
      const newStats = event.detail;

      setStats(newStats);
      setLoading(false);
    };

    // Подписываемся на событие обновления статистики
    window.addEventListener('stats_updated', handleStatsUpdate as EventListener);
    
    // Fallback: обновляем через API каждые 5 минут на случай проблем с WebSocket
    const interval = setInterval(fetchStats, 300000);
    
    return () => {
      window.removeEventListener('stats_updated', handleStatsUpdate as EventListener);
      clearInterval(interval);
    };
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="profit-stats-panel">
        <h3 className="panel-title">Weekly user income</h3>
        <div className="profit-stats-panel-row">
          <div className="stat-item">
            <div className="stat-content">
              <div className="stat-label">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profit-stats-panel">
      <h3 className="panel-title">Weekly user income</h3>
      
      <div className='profit-stats-panel-row'>
        <div className="stat-item">
          <div className="stat-icon">
            $
          </div>
          <div className="stat-content stat-label-green">
            <div className="stat-label">Total Earned</div>
            <div className="stat-value">${formatNumber(stats.totalEarned)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}