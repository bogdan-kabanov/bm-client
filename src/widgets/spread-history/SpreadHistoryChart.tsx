import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  ChartConfiguration,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js';
import './SpreadHistoryChart.css';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
);

if (Tooltip && Chart.registry.plugins.get('tooltip')) {
  Chart.unregister(Tooltip);
}

if (Chart.defaults?.plugins?.tooltip) {
  Chart.defaults.plugins.tooltip.enabled = false;
}

interface SpreadHistoryChartProps {
  selectedBase?: string;
}

export function SpreadHistoryChart({ selectedBase = 'BTC' }: SpreadHistoryChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [timeRange] = useState<'1h' | '6h' | '24h'>('1h');

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy previous chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Generate sample data
    const dataPoints = 12;
    const labels: string[] = [];
    const data: number[] = [];
    
    const now = Date.now();
    const interval = timeRange === '1h' ? 5 * 60 * 1000 : timeRange === '6h' ? 15 * 60 * 1000 : 30 * 60 * 1000;
    
    for (let i = dataPoints; i >= 0; i--) {
      const time = new Date(now - i * interval);
      labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      
      // Generate realistic spread data with some variation
      const baseSpread = 2.0;
      const variation = Math.sin(i / 5) * 1.0 + Math.random() * 0.5;
      data.push(Math.max(0.5, baseSpread + variation));
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Spread %',
          data,
          borderColor: '#45B734',
          backgroundColor: 'rgba(69, 183, 52, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#45B734',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: false
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
              lineWidth: 1,
              display: true
            },
            border: {
              color: 'rgba(255, 255, 255, 0.2)',
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 10,
                family: "'Inter', -apple-system, sans-serif",
                // weight: '500',
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              padding: 8
            }
          },
          y: {
            beginAtZero: true,
            position: 'right',
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
              lineWidth: 1,
              display: true
            },
            border: {
              color: 'rgba(255, 255, 255, 0.2)',
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 10,
                family: "'Inter', -apple-system, sans-serif",
                // weight: '500',
              },
              padding: 8,
              callback: (value) => `${Number(value).toFixed(1)}%`
            }
          }
        }
      }
    };

    chartInstanceRef.current = new Chart(ctx, config);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [timeRange, selectedBase]); // Добавили selectedBase в зависимости

  return (
    <div className="spread-history-chart">
      <div className="chart-header">
        <h4 className="panel-title">{selectedBase}/USDT Spread History</h4>
      </div>
      <div className="chart-container">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
}

