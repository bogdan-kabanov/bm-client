import { useState } from 'react';
import './ArbitrageAlerts.css';

interface AlertSetting {
  id: string;
  label: string;
  value: number | string;
  enabled: boolean;
  type: 'number' | 'toggle';
  unit?: string;
}

export function ArbitrageAlerts() {
  const [alerts, setAlerts] = useState<AlertSetting[]>([
    { id: 'spread', label: 'Spread Alert', value: 3.0, enabled: true, type: 'number', unit: '%' },
    { id: 'profit', label: 'Profit Alert', value: 20, enabled: true, type: 'number', unit: '$' },
    { id: 'volatility', label: 'High Volatility', value: '', enabled: true, type: 'toggle' },
    { id: 'volume', label: 'Large Trades', value: '', enabled: false, type: 'toggle' }
  ]);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
    ));
  };

  const updateValue = (id: string, value: number) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, value } : alert
    ));
  };

  return (
    <div className="arbitrage-alerts">
      <h3 className="panel-title">Smart Alerts</h3>
      
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div key={alert.id} className="alert-item">
            <div className="alert-header">
              <span className="alert-label">{alert.label}:</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={alert.enabled}
                  onChange={() => toggleAlert(alert.id)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            {alert.type === 'number' && (
              <div className="alert-input-group">
                <span className="input-prefix">When {'>'}</span>
                <input
                  type="number"
                  value={alert.value}
                  onChange={(e) => updateValue(alert.id, parseFloat(e.target.value))}
                  disabled={!alert.enabled}
                  className="alert-input"
                  step={alert.unit === '%' ? 0.1 : 1}
                />
                <span className="input-suffix">{alert.unit}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

