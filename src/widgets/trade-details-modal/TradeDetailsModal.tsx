import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './TradeDetailsModal.css';
import { syntheticQuotesApi } from '@src/shared/api/synthetic-quotes/syntheticQuotesApi';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { getServerTime } from '@src/shared/lib/serverTime';
import type { Currency } from '@src/shared/api';

interface ActiveTrade {
  id: string;
  price: number;
  direction: 'buy' | 'sell';
  amount: number;
  expiration_time: number;
  entry_price: number;
  current_price: number | null;
  created_at: number;
  symbol?: string | null;
  base_currency?: string | null;
  quote_currency?: string | null;
  profit_percentage?: number;
  completed_at?: number; // Для завершенных сделок - фактическое время завершения
}

interface TradeDetailsModalProps {
  trade: ActiveTrade | null;
  is_open: boolean;
  on_close: () => void;
  get_currency_info?: (base_currency: string) => Currency | undefined;
  user_currency: string;
}

interface Candle {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({
  trade,
  is_open,
  on_close,
  get_currency_info,
  user_currency,
}) => {
  const [candles, set_candles] = useState<Candle[]>([]);
  const [loading, set_loading] = useState(false);
  const canvas_ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!is_open || !trade) {
      return;
    }

    // Для активных сделок (без completed_at) не загружаем график
    if (!trade.completed_at) {
      console.log('[TradeDetailsModal] Активная сделка - график не загружается');
      set_loading(false);
      set_candles([]);
      return;
    }

    const load_candles = async () => {
      set_loading(true);
      set_candles([]); // Очищаем предыдущие данные
      try {
        // Определяем базовую валюту: сначала из base_currency, затем из symbol
        let base_currency = trade.base_currency;
        if (!base_currency && trade.symbol) {
          // Пробуем разобрать символ в разных форматах: BTC_USDT, BTC/USDT, BTC-USDT
          const parts = trade.symbol.split(/[_\-\/]/);
          base_currency = parts[0] || 'BTC';
        }
        if (!base_currency) {
          base_currency = 'BTC';
        }

        console.log('[TradeDetailsModal] Загрузка свечей для сделки:', {
          tradeId: trade.id,
          base_currency,
          symbol: trade.symbol,
          base_currency_from_trade: trade.base_currency,
        });

        const currency_info = get_currency_info ? get_currency_info(base_currency) : null;
        
        if (!currency_info || !currency_info.id) {
          console.error('[TradeDetailsModal] Currency info not found for:', base_currency);
          set_loading(false);
          return;
        }

        // Нормализуем временные метки в миллисекунды
        let created_at = trade.created_at;
        let expiration_time = trade.expiration_time;
        
        // Конвертируем в миллисекунды, если значение меньше 1e12 (это секунды)
        if (created_at < 1e12) {
          created_at = created_at * 1000;
        }
        if (expiration_time < 1e12) {
          expiration_time = expiration_time * 1000;
        }
        
        const now = getServerTime();
        
        // Определяем end_time для запроса свечей
        // Для завершенных сделок используем completed_at, но не больше now (API не возвращает свечи для будущего)
        let end_time: number;
        if (trade.completed_at) {
          // Завершенная сделка - используем фактическое время завершения
          let completed_at = trade.completed_at;
          if (completed_at < 1e12) {
            completed_at = completed_at * 1000;
          }
          // Убеждаемся, что completed_at >= created_at
          if (completed_at < created_at) {
            console.warn('[TradeDetailsModal] completed_at < created_at, исправляем:', {
              created_at: new Date(created_at).toISOString(),
              completed_at: new Date(completed_at).toISOString(),
            });
            // Если completed_at некорректный, используем created_at + 5 минут
            completed_at = created_at + 5 * 60 * 1000;
          }
          // Используем completed_at, но не больше now (API не возвращает свечи для будущего)
          end_time = Math.min(completed_at, now);
        } else {
          // Активная сделка - используем now (API не возвращает свечи для будущего)
          end_time = now;
        }

        console.log('[TradeDetailsModal] Временные параметры:', {
          created_at: new Date(created_at).toISOString(),
          expiration_time: new Date(expiration_time).toISOString(),
          completed_at: trade.completed_at ? new Date(trade.completed_at < 1e12 ? trade.completed_at * 1000 : trade.completed_at).toISOString() : null,
          end_time: new Date(end_time).toISOString(),
          now: new Date(now).toISOString(),
          duration_ms: end_time - created_at,
          created_at_raw: trade.created_at,
          expiration_time_raw: trade.expiration_time,
          completed_at_raw: trade.completed_at,
        });

        // Рассчитываем необходимое количество свечей на основе таймфрейма 15s
        const duration_ms = end_time - created_at;
        if (duration_ms <= 0) {
          console.warn('[TradeDetailsModal] Некорректная длительность сделки:', duration_ms, {
            created_at: new Date(created_at).toISOString(),
            end_time: new Date(end_time).toISOString(),
            created_at_raw: trade.created_at,
            expiration_time_raw: trade.expiration_time,
          });
          set_loading(false);
          return;
        }

        const timeframe_ms = 15000; // 15s
        const estimated_candles = Math.ceil(duration_ms / timeframe_ms);
        const limit = Math.min(estimated_candles + 20, 1000); // Добавляем запас для гарантии

        console.log('[TradeDetailsModal] Запрос свечей:', {
          currencyId: currency_info.id,
          timeframe: '15s',
          limit,
          end_time,
          start_time: created_at,
          estimated_candles,
        });

        const response = await syntheticQuotesApi.getCandlesHistory(
          currency_info.id,
          '15s',
          limit,
          end_time,
          created_at,
          trade.id?.toString() || `trade_${trade.id}`
        );

        console.log('[TradeDetailsModal] Ответ API:', {
          response_type: Array.isArray(response) ? 'array' : typeof response,
          response_keys: response && typeof response === 'object' ? Object.keys(response) : null,
          response_data_length: response && typeof response === 'object' && 'data' in response && Array.isArray(response.data) 
            ? response.data.length 
            : (Array.isArray(response) ? response.length : 0),
        });

        let candles_data: Candle[] = [];
        
        if (Array.isArray(response)) {
          candles_data = response;
        } else if (response && typeof response === 'object' && 'data' in response) {
          if (response.success === false) {
            throw new Error('Failed to fetch candles: server returned error');
          }
          if (Array.isArray(response.data)) {
            candles_data = response.data;
          } else {
            console.warn('[TradeDetailsModal] Response.data is not an array:', response.data);
          }
        } else {
          console.warn('[TradeDetailsModal] Unexpected response format:', response);
        }

        console.log('[TradeDetailsModal] Получено свечей:', candles_data.length);

        // Фильтруем свечи, которые попадают в период ставки
        const mapped_candles = candles_data.map(candle => {
          // API возвращает поле 'time', а не 'start'
          const candle_time = candle.time || candle.start;
          const candle_start = typeof candle_time === 'number' ? candle_time : new Date(candle_time).getTime();
          return {
            start: candle_start,
            open: typeof candle.open === 'number' ? candle.open : parseFloat(String(candle.open)),
            high: typeof candle.high === 'number' ? candle.high : parseFloat(String(candle.high)),
            low: typeof candle.low === 'number' ? candle.low : parseFloat(String(candle.low)),
            close: typeof candle.close === 'number' ? candle.close : parseFloat(String(candle.close)),
          };
        });
        
        console.log('[TradeDetailsModal] 🔍 Маппинг свечей:', {
          totalCandles: candles_data.length,
          sampleCandle: candles_data.length > 0 ? {
            raw: candles_data[0],
            hasTime: 'time' in candles_data[0],
            hasStart: 'start' in candles_data[0],
            timeValue: candles_data[0].time,
            startValue: candles_data[0].start,
          } : null,
        });

        // Логируем первые несколько свечей для отладки
        if (mapped_candles.length > 0) {
          console.log('[TradeDetailsModal] Первые свечи до фильтрации:', {
            first_candle: {
              start: new Date(mapped_candles[0].start).toISOString(),
              start_ms: mapped_candles[0].start,
            },
            last_candle: mapped_candles.length > 0 ? {
              start: new Date(mapped_candles[mapped_candles.length - 1].start).toISOString(),
              start_ms: mapped_candles[mapped_candles.length - 1].start,
            } : null,
            created_at: new Date(created_at).toISOString(),
            created_at_ms: created_at,
            end_time: new Date(end_time).toISOString(),
            end_time_ms: end_time,
          });
        }

        const filtered_candles = mapped_candles
          .filter(candle => {
            // Включаем свечи, которые начинаются в период сделки (от created_at до end_time включительно)
            const inRange = candle.start >= created_at && candle.start <= end_time;
            // Логируем все свечи для отладки, если их не слишком много
            if (mapped_candles.length <= 20) {
              console.log('[TradeDetailsModal] Проверка свечи:', {
                candle_start: new Date(candle.start).toISOString(),
                candle_start_ms: candle.start,
                created_at: new Date(created_at).toISOString(),
                created_at_ms: created_at,
                end_time: new Date(end_time).toISOString(),
                end_time_ms: end_time,
                start_ge_created: candle.start >= created_at,
                start_le_end: candle.start <= end_time,
                inRange,
              });
            }
            return inRange;
          })
          .sort((a, b) => a.start - b.start);

        console.log('[TradeDetailsModal] Отфильтровано свечей для периода:', {
          total: candles_data.length,
          filtered: filtered_candles.length,
          first_candle: filtered_candles[0] ? new Date(filtered_candles[0].start).toISOString() : null,
          last_candle: filtered_candles.length > 0 ? new Date(filtered_candles[filtered_candles.length - 1].start).toISOString() : null,
        });

        if (filtered_candles.length === 0) {
          console.warn('[TradeDetailsModal] Нет свечей для отображения в период сделки');
        }

        set_candles(filtered_candles);
      } catch (error) {
        console.error('[TradeDetailsModal] Error loading candles:', error);
      } finally {
        set_loading(false);
      }
    };

    load_candles();
  }, [is_open, trade, get_currency_info]);

  useEffect(() => {
    if (!is_open || !trade || candles.length === 0 || !canvas_ref.current) {
      return;
    }

    const canvas = canvas_ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Устанавливаем размеры canvas
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 40, bottom: 30, left: 50 };
    const chart_width = width - padding.left - padding.right;
    const chart_height = height - padding.top - padding.bottom;

    // Находим min и max цены
    let min_price = Math.min(...candles.map(c => c.low));
    let max_price = Math.max(...candles.map(c => c.high));
    const entry_price = trade.entry_price;

    // Добавляем небольшой отступ для визуализации
    const price_range = max_price - min_price;
    min_price = min_price - price_range * 0.1;
    max_price = max_price + price_range * 0.1;

    // Используем время сделки для масштабирования, а не время свечей
    const trade_start_time = trade.created_at;
    const trade_end_time = trade.completed_at || trade.expiration_time;
    const trade_time_range = trade_end_time - trade_start_time;

    // Функции преобразования координат
    const price_to_y = (price: number) => {
      return padding.top + chart_height - ((price - min_price) / (max_price - min_price)) * chart_height;
    };

    const time_to_x = (time: number) => {
      // Используем время сделки для масштабирования
      return padding.left + ((time - trade_start_time) / trade_time_range) * chart_width;
    };

    // Рисуем сетку
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Горизонтальные линии
    for (let i = 0; i <= 5; i++) {
      const price = min_price + (max_price - min_price) * (i / 5);
      const y = price_to_y(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chart_width, y);
      ctx.stroke();
    }

    // Вертикальные линии
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chart_width * i) / 5;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chart_height);
      ctx.stroke();
    }

    // Рисуем свечи (candlesticks)
    candles.forEach((candle) => {
      const x = time_to_x(candle.start);
      const candle_width = Math.max(2, chart_width / candles.length * 0.8);
      const candle_left = x - candle_width / 2;
      
      // Определяем цвет свечи (зеленая если close > open, красная если close < open)
      const is_up = candle.close >= candle.open;
      const candle_color = is_up ? '#32ac41' : '#f7525f';
      const wick_color = candle_color;
      
      // Высота тела свечи
      const body_top = price_to_y(Math.max(candle.open, candle.close));
      const body_bottom = price_to_y(Math.min(candle.open, candle.close));
      const body_height = body_bottom - body_top;
      
      // Рисуем тень (wick) - вертикальная линия от high до low
      ctx.strokeStyle = wick_color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, price_to_y(candle.high));
      ctx.lineTo(x, price_to_y(candle.low));
      ctx.stroke();
      
      // Рисуем тело свечи
      ctx.fillStyle = candle_color;
      ctx.fillRect(candle_left, body_top, candle_width, Math.max(1, body_height));
      
      // Обводка тела свечи
      ctx.strokeStyle = candle_color;
      ctx.lineWidth = 1;
      ctx.strokeRect(candle_left, body_top, candle_width, Math.max(1, body_height));
    });

    // Рисуем линию входа
    const entry_y = price_to_y(entry_price);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, entry_y);
    ctx.lineTo(padding.left + chart_width, entry_y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Подпись линии входа
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Вход: ${entry_price.toFixed(2)}`, padding.left - 10, entry_y + 4);

    // Рисуем метки на оси Y
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const price = min_price + (max_price - min_price) * (i / 5);
      const y = price_to_y(price);
      ctx.fillText(price.toFixed(2), padding.left - 10, y + 4);
    }

    // Рисуем метки на оси X - используем время сделки
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const ratio = i / 5;
      const time = trade_start_time + trade_time_range * ratio;
      const date = new Date(time);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const x = time_to_x(time);
      ctx.fillText(`${hours}:${minutes}:${seconds}`, x, padding.top + chart_height + 20);
    }

  }, [candles, trade, is_open]);

  if (!is_open || !trade) {
    return null;
  }

  const base_currency = trade.base_currency || (trade.symbol ? trade.symbol.split('/')[0] : 'BTC');
  const created_at = trade.created_at < 1e12 ? trade.created_at * 1000 : trade.created_at;
  const expiration_time = trade.expiration_time < 1e12 ? trade.expiration_time * 1000 : trade.expiration_time;
  const now = getServerTime();
  const is_expired = expiration_time <= now;

  const format_date = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const format_full_date = (timestamp: number) => {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const modal_content = (
    <div className="trade-details-modal-overlay" onClick={on_close}>
      <div className="trade-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trade-details-modal-header">
          <h2 className="trade-details-modal-title">Информация о ставке</h2>
          <button 
            className="trade-details-modal-close"
            onClick={on_close}
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="trade-details-modal-content">
          <div className="trade-details-info">
            <div className="trade-details-row">
              <span className="trade-details-label">Валюта:</span>
              <span className="trade-details-value">{base_currency}</span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Направление:</span>
              <span className={`trade-details-value trade-details-direction-${trade.direction}`}>
                {trade.direction === 'buy' ? '⬆ BUY' : '⬇ SELL'}
              </span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Сумма ставки:</span>
              <span className="trade-details-value">{formatCurrency(trade.amount, user_currency)}</span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Цена входа:</span>
              <span className="trade-details-value">{trade.entry_price.toFixed(8)}</span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Время начала:</span>
              <span className="trade-details-value">{format_full_date(created_at)}</span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Время окончания:</span>
              <span className="trade-details-value">{format_full_date(expiration_time)}</span>
            </div>
            <div className="trade-details-row">
              <span className="trade-details-label">Статус:</span>
              <span className="trade-details-value">{is_expired ? 'Завершена' : 'Активна'}</span>
            </div>
          </div>

          {trade.completed_at ? (
            <div className="trade-details-chart-container">
              <h3 className="trade-details-chart-title">График цены</h3>
              {loading ? (
                <div className="trade-details-chart-loading">Загрузка данных...</div>
              ) : candles.length === 0 ? (
                <div className="trade-details-chart-loading">Нет данных для отображения</div>
              ) : (
                <canvas ref={canvas_ref} className="trade-details-chart-canvas" />
              )}
            </div>
          ) : (
            <div className="trade-details-chart-container">
              <h3 className="trade-details-chart-title">График цены</h3>
              <div className="trade-details-chart-loading">График доступен только для завершенных сделок</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const [portal_container, set_portal_container] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      set_portal_container(document.body);
    }
  }, []);

  if (!portal_container) {
    return null;
  }

  return createPortal(modal_content, portal_container);
};

