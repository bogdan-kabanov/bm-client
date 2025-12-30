import React, { useState, useEffect } from 'react';
import { traderBotApi, TraderBot } from '@src/shared/api';
import './TraderBotsAdminPage.css';

export const TraderBotsAdminPage: React.FC = () => {
  const [bots, setBots] = useState<TraderBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<TraderBot | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<TraderBot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<TraderBot>>({
    name: '',
    firstname: '',
    lastname: '',
    email: '',
    code: '',
    is_active: true,
    avatar_url: null,
    trades_per_day_min: 5,
    trades_per_day_max: 20,
    win_rate_min: 60,
    win_rate_max: 85,
    profit_per_trade_min: 10,
    profit_per_trade_max: 500,
    volume_per_trade_min: 50,
    volume_per_trade_max: 1000,
    trading_hours_start: 0,
    trading_hours_end: 23,
    timezone: 'UTC',
    symbols: ['BTC_USDT', 'ETH_USDT', 'LTC_USDT', 'BNB_USDT'],
    durations: [60, 180, 300],
  });

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await traderBotApi.getAll();
      setBots(data);
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки ботов');
    } finally {
      setLoading(false);
    }
  };

  const handleBotSelect = (bot: TraderBot) => {
    setSelectedBot(bot);
    setShowForm(false);
    setEditingBot(null);
  };

  const handleAddBot = () => {
    setEditingBot(null);
    setFormData({
      name: '',
      firstname: '',
      lastname: '',
      email: '',
      code: '',
      is_active: true,
      avatar_url: null,
      trades_per_day_min: 5,
      trades_per_day_max: 20,
      win_rate_min: 60,
      win_rate_max: 85,
      profit_per_trade_min: 10,
      profit_per_trade_max: 500,
      volume_per_trade_min: 50,
      volume_per_trade_max: 1000,
      trading_hours_start: 0,
      trading_hours_end: 23,
      timezone: 'UTC',
      symbols: ['BTC_USDT', 'ETH_USDT', 'LTC_USDT', 'BNB_USDT'],
      durations: [60, 180, 300],
    });
    setShowForm(true);
  };

  const handleEditBot = (bot: TraderBot) => {
    setEditingBot(bot);
    setFormData(bot);
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      if (editingBot) {
        await traderBotApi.update(editingBot.id, formData);
        setSuccess('Бот успешно обновлен');
      } else {
        await traderBotApi.create(formData);
        setSuccess('Бот успешно создан');
      }
      await loadBots();
      setShowForm(false);
      setEditingBot(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Ошибка сохранения бота');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого бота?')) {
      return;
    }

    try {
      setLoading(true);
      await traderBotApi.delete(id);
      setSuccess('Бот успешно удален');
      await loadBots();
      if (selectedBot?.id === id) {
        setSelectedBot(null);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Ошибка удаления бота');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTrades = async (id?: number) => {
    try {
      setLoading(true);
      setError(null);
      await traderBotApi.generateTrades(id);
      setSuccess(id ? 'Сделки для бота успешно сгенерированы' : 'Сделки для всех ботов успешно сгенерированы');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Ошибка генерации сделок');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trader-bots-admin-page">
      <div className="admin-header">
        <h1>Управление ботами-трейдерами</h1>
        <div className="admin-header-actions">
          <button onClick={handleAddBot} className="add-btn">
            + Добавить бота
          </button>
          <button onClick={() => handleGenerateTrades()} className="generate-btn" disabled={loading}>
            Генерировать сделки для всех
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="success-banner">
          {success}
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      <div className="admin-content">
        {showForm ? (
          <div className="form-container">
            <h2>{editingBot ? 'Редактировать бота' : 'Добавить бота'}</h2>
            <form onSubmit={handleFormSubmit} className="trader-bot-form">
              <div className="form-section">
                <h3>Основная информация</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Имя *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Имя (firstname) *</label>
                    <input
                      type="text"
                      value={formData.firstname || ''}
                      onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Фамилия (lastname) *</label>
                    <input
                      type="text"
                      value={formData.lastname || ''}
                      onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Код (TRD) *</label>
                    <input
                      type="text"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                      disabled={!!editingBot}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Аватар URL</label>
                    <input
                      type="url"
                      value={formData.avatar_url || ''}
                      onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value || null })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Активен</label>
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Настройки торговли</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Сделок в день (мин)</label>
                    <input
                      type="number"
                      value={formData.trades_per_day_min || 5}
                      onChange={(e) => setFormData({ ...formData, trades_per_day_min: parseInt(e.target.value) || 5 })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Сделок в день (макс)</label>
                    <input
                      type="number"
                      value={formData.trades_per_day_max || 20}
                      onChange={(e) => setFormData({ ...formData, trades_per_day_max: parseInt(e.target.value) || 20 })}
                      min="1"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Win Rate (мин) %</label>
                    <input
                      type="number"
                      value={formData.win_rate_min || 60}
                      onChange={(e) => setFormData({ ...formData, win_rate_min: parseFloat(e.target.value) || 60 })}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Win Rate (макс) %</label>
                    <input
                      type="number"
                      value={formData.win_rate_max || 85}
                      onChange={(e) => setFormData({ ...formData, win_rate_max: parseFloat(e.target.value) || 85 })}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Прибыль за сделку (мин)</label>
                    <input
                      type="number"
                      value={formData.profit_per_trade_min || 10}
                      onChange={(e) => setFormData({ ...formData, profit_per_trade_min: parseFloat(e.target.value) || 10 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>Прибыль за сделку (макс)</label>
                    <input
                      type="number"
                      value={formData.profit_per_trade_max || 500}
                      onChange={(e) => setFormData({ ...formData, profit_per_trade_max: parseFloat(e.target.value) || 500 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Объем за сделку (мин)</label>
                    <input
                      type="number"
                      value={formData.volume_per_trade_min || 50}
                      onChange={(e) => setFormData({ ...formData, volume_per_trade_min: parseFloat(e.target.value) || 50 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>Объем за сделку (макс)</label>
                    <input
                      type="number"
                      value={formData.volume_per_trade_max || 1000}
                      onChange={(e) => setFormData({ ...formData, volume_per_trade_max: parseFloat(e.target.value) || 1000 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Торговые часы (начало)</label>
                    <input
                      type="number"
                      value={formData.trading_hours_start || 0}
                      onChange={(e) => setFormData({ ...formData, trading_hours_start: parseInt(e.target.value) || 0 })}
                      min="0"
                      max="23"
                    />
                  </div>
                  <div className="form-group">
                    <label>Торговые часы (конец)</label>
                    <input
                      type="number"
                      value={formData.trading_hours_end || 23}
                      onChange={(e) => setFormData({ ...formData, trading_hours_end: parseInt(e.target.value) || 23 })}
                      min="0"
                      max="23"
                    />
                  </div>
                  <div className="form-group">
                    <label>Часовой пояс</label>
                    <input
                      type="text"
                      value={formData.timezone || 'UTC'}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Символы (через запятую)</label>
                    <input
                      type="text"
                      value={Array.isArray(formData.symbols) ? formData.symbols.join(', ') : ''}
                      onChange={(e) => setFormData({ ...formData, symbols: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="BTC_USDT, ETH_USDT, LTC_USDT"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Длительности в секундах (через запятую)</label>
                    <input
                      type="text"
                      value={Array.isArray(formData.durations) ? formData.durations.join(', ') : ''}
                      onChange={(e) => setFormData({ ...formData, durations: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
                      placeholder="60, 180, 300"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={loading} className="save-btn">
                  {loading ? 'Сохранение...' : editingBot ? 'Сохранить' : 'Создать'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingBot(null); }} className="cancel-btn">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bots-list">
            {loading && !bots.length ? (
              <div>Загрузка...</div>
            ) : bots.length === 0 ? (
              <div className="empty-state">
                <p>Боты не найдены</p>
                <button onClick={handleAddBot} className="add-btn">
                  Добавить первого бота
                </button>
              </div>
            ) : (
              <div className="bots-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Код</th>
                      <th>Email</th>
                      <th>Сделок/день</th>
                      <th>Win Rate</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map((bot) => (
                      <tr key={bot.id}>
                        <td>{bot.id}</td>
                        <td>{bot.name}</td>
                        <td>{bot.code}</td>
                        <td>{bot.email}</td>
                        <td>{bot.trades_per_day_min}-{bot.trades_per_day_max}</td>
                        <td>{bot.win_rate_min}%-{bot.win_rate_max}%</td>
                        <td>
                          <span className={`status ${bot.is_active ? 'active' : 'inactive'}`}>
                            {bot.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleEditBot(bot)}
                              className="edit-btn"
                            >
                              Редактировать
                            </button>
                            <button
                              onClick={() => handleGenerateTrades(bot.id)}
                              className="generate-btn"
                              disabled={loading}
                            >
                              Генерировать сделки
                            </button>
                            <button
                              onClick={() => handleDeleteBot(bot.id)}
                              className="delete-btn"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

